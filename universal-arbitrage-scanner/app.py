import asyncio, os, json, time, logging
from datetime import datetime, timezone
from decimal import Decimal
from contextlib import asynccontextmanager
from collections import defaultdict
import asyncpg, websockets
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

logging.basicConfig(level=logging.INFO)
log=logging.getLogger("scanner")
SYMS=[s.strip().upper() for s in os.getenv("SYMBOLS","BTC,ETH,SOL,ARB,LINK").split(",") if s.strip()]
SIZES=(100,1000,2000,5000)
URL=os.environ["DATABASE_URL"]
BOOKS={}
COUNT={"messages":0,"snapshots":0,"paper":0}
FEEDS={"Binance":"connecting","OKX":"connecting"}
DB=None
TASKS=[]
LAST=defaultdict(float)
D=lambda x: Decimal(str(x))
FEE={"Binance":D(os.getenv("BINANCE_SPOT_FEE","0.001")),"OKX":D(os.getenv("OKX_SPOT_FEE","0.001"))}
REB={"Binance":D(os.getenv("BINANCE_REBATE","0")),"OKX":D(os.getenv("OKX_REBATE","0"))}
RESERVE=D(os.getenv("INVENTORY_RESERVE_USD","1"))
def ingest(ex,sym,bids,asks,ts=None):
    try:
        b=sorted([(D(p),D(q)) for p,q in bids if D(p)>0 and D(q)>0],reverse=True)
        a=sorted([(D(p),D(q)) for p,q in asks if D(p)>0 and D(q)>0])
        if not a or not b or a[0][0]<=b[0][0]: return
        BOOKS[(ex,sym)]={"bids":b,"asks":a,"received":time.monotonic(),"timestamp":datetime.now(timezone.utc),"source_ts":ts}
        COUNT["messages"]+=1
        FEEDS[ex]="connected"
    except Exception as e: log.warning("invalid book %s %s %s",ex,sym,e)
async def binance():
    streams="/".join(f"{s.lower()}usdt@depth20@100ms" for s in SYMS)
    while True:
        try:
            async with websockets.connect("wss://stream.binance.com:9443/stream?streams="+streams,ping_interval=20,ping_timeout=20) as ws:
                FEEDS["Binance"]="connected"
                async for raw in ws:
                    obj=json.loads(raw); stream=obj.get("stream",""); sym=stream.split("usdt@")[0].upper()
                    if sym in SYMS:
                        data=obj.get("data",{})
                        ingest("Binance",sym,data.get("bids",[]),data.get("asks",[]))
        except asyncio.CancelledError: raise
        except Exception as exc:
            FEEDS["Binance"]="retrying: "+str(exc)[:100];log.warning("Binance reconnect %s",exc);await asyncio.sleep(5)
async def okx():
    args=[{"channel":"books5","instId":s+"-USDT"} for s in SYMS]
    while True:
        try:
            async with websockets.connect("wss://ws.okx.com:8443/ws/v5/public",ping_interval=20,ping_timeout=20) as ws:
                await ws.send(json.dumps({"op":"subscribe","args":args}))
                FEEDS["OKX"]="connected"
                async for raw in ws:
                    if raw=="pong":continue
                    obj=json.loads(raw); sym=obj.get("arg",{}).get("instId","").split("-")[0]
                    for item in obj.get("data",[]):
                        if sym in SYMS:ingest("OKX",sym,[v[:2] for v in item.get("bids",[])],[v[:2] for v in item.get("asks",[])],item.get("ts"))
        except asyncio.CancelledError:raise
        except Exception as exc:
            FEEDS["OKX"]="retrying: "+str(exc)[:100];log.warning("OKX reconnect %s",exc);await asyncio.sleep(5)
def simulate(sym,buy,sell,size):
    x=BOOKS.get((buy,sym));y=BOOKS.get((sell,sym))
    if not x or not y or max(time.monotonic()-x["received"],time.monotonic()-y["received"])>4:return None
    remaining=D(size);base=D(0);spent=D(0)
    for price,qty in x["asks"]:
        take=min(remaining,price*qty);base+=take/price;spent+=take;remaining-=take
        if remaining<=D("0.00000001"):break
    if remaining>D("0.00000001"):return None
    rem=base;received=D(0)
    for price,qty in y["bids"]:
        take=min(rem,qty);received+=take*price;rem-=take
        if rem<=D("0.00000000001"):break
    if rem>D("0.00000000001"):return None
    gross=received-spent
    fees=spent*FEE[buy]+received*FEE[sell]
    rebate=spent*FEE[buy]*REB[buy]+received*FEE[sell]*REB[sell]
    net=gross-fees+rebate-RESERVE
    return {"gross":gross,"fees":fees,"rebate":rebate,"other":RESERVE,"net":net,"age":max(time.monotonic()-x["received"],time.monotonic()-y["received"])}
async def store_loop():
    while True:
        try:
            await asyncio.sleep(2)
            rows=[(ex,sym,b) for (ex,sym),b in list(BOOKS.items()) if time.monotonic()-b["received"]<4]
            if not rows:continue
            async with DB.acquire() as c:
                async with c.transaction():
                    for ex,sym,b in rows:
                        bid,bidq=b["bids"][0];ask,askq=b["asks"][0]
                        await c.execute("INSERT INTO market_quotes(exchange,symbol,bid,ask,bid_size,ask_size,source) VALUES($1,$2,$3,$4,$5,$6,'websocket')",ex,sym,bid,ask,bidq,askq)
                        await c.execute("INSERT INTO orderbook_snapshots(exchange,symbol,bids,asks,source,market_timestamp) VALUES($1,$2,$3::jsonb,$4::jsonb,'websocket',$5)",ex,sym,json.dumps([[str(p),str(q)] for p,q in b["bids"]]),json.dumps([[str(p),str(q)] for p,q in b["asks"]]),b["timestamp"])
                COUNT["snapshots"]+=len(rows)
        except asyncio.CancelledError:raise
        except Exception as exc:log.exception("store error %s",exc)
async def paper_loop():
    while True:
        try:
            await asyncio.sleep(1)
            for sym in SYMS:
                for buy,sell in (("Binance","OKX"),("OKX","Binance")):
                    for size in SIZES:
                        key=(sym,buy,sell,size)
                        if time.monotonic()-LAST[key]<30:continue
                        v=simulate(sym,buy,sell,size)
                        if not v or v["net"]<D(os.getenv("MIN_NET_USD","0.01")):continue
                        async with DB.acquire() as c:
                            await c.execute("""INSERT INTO paper_trades(strategy,symbol,buy_exchange,sell_exchange,notional_usd,gross_usd,fees_usd,rebate_usd,other_costs_usd,net_usd,status,reason,assumptions) VALUES('CEX_CEX',$1,$2,$3,$4,$5,$6,$7,$8,$9,'PAPER_FILLED','hypothetical prefunded inventory, no real execution',$10::jsonb)""",sym,buy,sell,size,v["gross"],v["fees"],v["rebate"],v["other"],v["net"],json.dumps({"fee":{k:str(a) for k,a in FEE.items()},"rebate":{k:str(a) for k,a in REB.items()},"sampled_depth":"Binance20/OKX5","paper_only":True}))
                        LAST[key]=time.monotonic();COUNT["paper"]+=1
        except asyncio.CancelledError:raise
        except Exception as exc:log.exception("paper error %s",exc)
@asynccontextmanager
async def lifespan(app):
    global DB
    DB=await asyncpg.create_pool(URL,ssl="require",min_size=1,max_size=3)
    TASKS.extend([asyncio.create_task(binance()),asyncio.create_task(okx()),asyncio.create_task(store_loop()),asyncio.create_task(paper_loop())])
    yield
    for t in TASKS:t.cancel()
    await asyncio.gather(*TASKS,return_exceptions=True)
    await DB.close()
app=FastAPI(lifespan=lifespan,title="Universal Arbitrage Scanner / paper only")
@app.get("/health")
async def health():
    fresh=sum(time.monotonic()-b["received"]<4 for b in BOOKS.values())
    return {"ok":True,"db_connected":DB is not None,"fresh_books":fresh,"feeds":FEEDS,"paper_only":True}
@app.get("/api/status")
async def status():return {"feeds":FEEDS,"counters":COUNT,"symbols":SYMS,"sizes":SIZES,"mode":"PAPER_ONLY"}
@app.get("/api/quotes")
async def quotes():return [{"exchange":e,"coin":s,"bid":float(b["bids"][0][0]),"ask":float(b["asks"][0][0]),"age_seconds":round(time.monotonic()-b["received"],2)} for (e,s),b in BOOKS.items() if time.monotonic()-b["received"]<4]
@app.get("/api/opportunities")
async def opportunities():
    out=[]
    for sym in SYMS:
        for a,b in (("Binance","OKX"),("OKX","Binance")):
            for size in SIZES:
                v=simulate(sym,a,b,size)
                if v:out.append({"coin":sym,"buy":a,"sell":b,"size":size,**{k:round(float(t),6) for k,t in v.items()}})
    return sorted(out,key=lambda x:x["net"],reverse=True)
@app.get("/api/trades")
async def trades():
    async with DB.acquire() as c:
        data=await c.fetch("SELECT evaluated_at,symbol,buy_exchange,sell_exchange,notional_usd,net_usd FROM paper_trades ORDER BY id DESC LIMIT 50")
    return [{"at":r["evaluated_at"].isoformat(),"coin":r["symbol"],"route":r["buy_exchange"]+" → "+r["sell_exchange"],"size":float(r["notional_usd"]),"net":float(r["net_usd"])} for r in data]
@app.get("/",response_class=HTMLResponse)
async def home():
    return """<!doctype html><html lang='ko'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Universal Arbitrage Scanner</title><style>body{font:14px system-ui;background:#061321;color:#e4faff;margin:22px}h1{color:#21ebdc}.box{background:#0b2840;border:1px solid #20647d;border-radius:12px;padding:14px;margin:12px 0}table{width:100%;border-collapse:collapse;min-width:700px}td,th{padding:8px;border-bottom:1px solid #265069;text-align:left}th{color:#a7bdd1}.scroll{overflow:auto}.good{color:#1aeab1}.bad{color:#ff9c91}</style><h1>∞ Universal Arbitrage Scanner</h1><p>REAL PUBLIC ORDER BOOKS · PAPER ONLY · NO ORDERS OR WITHDRAWALS</p><div class='box' id='summary'>Connecting...</div><div class='box'><h3>Live Quotes</h3><div class='scroll'><table><thead><tr><th>Exchange</th><th>Coin</th><th>Bid</th><th>Ask</th><th>Age</th></tr></thead><tbody id='quotes'></tbody></table></div></div><div class='box'><h3>4 Sizes × Cross Exchange Routes</h3><div class='scroll'><table><thead><tr><th>Coin</th><th>Route</th><th>Size</th><th>Gross</th><th>Fees</th><th>Rebate</th><th>Other</th><th>Net Estimate</th></tr></thead><tbody id='opps'></tbody></table></div></div><div class='box'><h3>Persisted Paper Trades</h3><div class='scroll'><table><thead><tr><th>Time</th><th>Coin</th><th>Route</th><th>Size</th><th>Net</th></tr></thead><tbody id='trades'></tbody></table></div></div><small>Displayed spreads are observational and may disappear before fill. Fee rebates default to zero unless eligibility is verified. Two CEX fills are not atomic.</small><script>const $=id=>document.getElementById(id);async function tick(){try{let [s,q,o,t]=await Promise.all(['/api/status','/api/quotes','/api/opportunities','/api/trades'].map(p=>fetch(p).then(r=>r.json())));$('summary').textContent='Feeds: '+JSON.stringify(s.feeds)+' | Received: '+s.counters.messages+' | Stored snapshots: '+s.counters.snapshots+' | Paper trades: '+s.counters.paper;$('quotes').innerHTML=q.map(x=>'<tr><td>'+x.exchange+'</td><td>'+x.coin+'</td><td>'+x.bid+'</td><td>'+x.ask+'</td><td>'+x.age_seconds+'s</td></tr>').join('');$('opps').innerHTML=o.slice(0,80).map(x=>'<tr><td>'+x.coin+'</td><td>'+x.buy+' → '+x.sell+'</td><td>$'+x.size+'</td><td>$'+x.gross.toFixed(2)+'</td><td>$'+x.fees.toFixed(2)+'</td><td>$'+x.rebate.toFixed(2)+'</td><td>$'+x.other.toFixed(2)+'</td><td class="'+(x.net>=0?'good':'bad')+'">$'+x.net.toFixed(2)+'</td></tr>').join('');$('trades').innerHTML=t.map(x=>'<tr><td>'+x.at+'</td><td>'+x.coin+'</td><td>'+x.route+'</td><td>$'+x.size+'</td><td>$'+x.net.toFixed(2)+'</td></tr>').join('')}catch(e){$('summary').textContent='Connection error: '+e.message}}tick();setInterval(tick,3000)</script></html>"""
