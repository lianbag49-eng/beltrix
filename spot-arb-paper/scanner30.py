"""Read-only spot paper arbitrage scanner. Never submits orders or transfers."""
import concurrent.futures, datetime, json, os, sqlite3, time, urllib.request, urllib.parse
from decimal import Decimal as D
from pathlib import Path
from zoneinfo import ZoneInfo
from paper_engine import apply_paper

ASSETS=[x.strip().upper() for x in os.getenv("ASSETS","ETH,SOL,LINK,SUI,AVAX,ARB,ADA,XRP,CYBER,TEA,FORT,USTC,LUNC,INJ").split(",")]
EXCHANGES=[x.strip() for x in os.getenv("EXCHANGES","kucoin,gate,okx,binance,mexc,bybit,bitget").split(",")]
MAX_COST=D(os.getenv("MAX_TRADE_USDT","5000"))
FEE_BUY=D(os.getenv("BUY_FEE_PCT","0.1"))/100
FEE_SELL=D(os.getenv("SELL_FEE_PCT","0.1"))/100
REBALANCE=D(os.getenv("REBALANCE_USDT","2"))
MIN_ROI=D(os.getenv("MIN_NET_ROI_PCT","0.15"))/100
MAX_SKEW=5
DB=os.getenv("DB_PATH","paper.db")

def get(url):
    request=urllib.request.Request(url,headers={"User-Agent":"spot-paper-scanner/1.0","Accept":"application/json"})
    with urllib.request.urlopen(request,timeout=7) as response:
        return json.load(response)

def fetch(ex,coin):
    s=urllib.parse.quote(coin+"USDT")
    urls={
      "kucoin":f"https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol={coin}-USDT",
      "gate":f"https://api.gateio.ws/api/v4/spot/order_book?currency_pair={coin}_USDT&limit=20",
      "okx":f"https://www.okx.com/api/v5/market/books?instId={coin}-USDT&sz=20",
      "binance":f"https://api.binance.com/api/v3/depth?symbol={s}&limit=20",
      "mexc":f"https://api.mexc.com/api/v3/depth?symbol={s}&limit=20",
      "bybit":f"https://api.bybit.com/v5/market/orderbook?category=spot&symbol={s}&limit=20",
      "bitget":f"https://api.bitget.com/api/v2/spot/market/orderbook?symbol={s}&type=step0&limit=20"
    }
    t0=time.time()
    data=get(urls[ex])
    now=time.time()
    stamp=None
    if ex=="kucoin":
        if data.get("code")!="200000":raise ValueError("api error")
        obj=data["data"]; bids=obj["bids"];asks=obj["asks"];stamp=int(obj.get("time") or 0)/1000 or None
    elif ex=="gate":
        bids=data["bids"];asks=data["asks"];stamp=float(data.get("current") or 0)/1000 or None
    elif ex=="okx":
        if data.get("code")!="0":raise ValueError("api error")
        obj=data["data"][0];bids=obj["bids"];asks=obj["asks"];stamp=int(obj.get("ts") or 0)/1000 or None
    elif ex in ("binance","mexc"):
        bids=data["bids"];asks=data["asks"]
    elif ex=="bybit":
        if data.get("retCode")!=0:raise ValueError("api error")
        obj=data["result"];bids=obj["b"];asks=obj["a"];stamp=int(obj.get("ts") or 0)/1000 or None
    else:
        if data.get("code")!="00000":raise ValueError("api error")
        obj=data["data"];bids=obj["bids"];asks=obj["asks"];stamp=int(obj.get("ts") or 0)/1000 or None
    if now-t0>12 or (stamp and (now-stamp>12 or stamp-now>10)):raise ValueError("stale book")
    def parse(levels,reverse):
        return sorted([(D(str(row[0])),D(str(row[1]))) for row in levels if D(str(row[0]))>0 and D(str(row[1]))>0],key=lambda x:x[0],reverse=reverse)
    bids=parse(bids,True);asks=parse(asks,False)
    if not asks or not bids or bids[0][0]>=asks[0][0]:raise ValueError("invalid book")
    return {"bids":bids,"asks":asks,"at":now}

def match(coin,buy_ex,sell_ex,buy,sell):
    if abs(buy["at"]-sell["at"])>MAX_SKEW:return None
    asks=buy["asks"];bids=sell["bids"]
    i=j=0
    aq=asks[0][1];bq=bids[0][1]
    qty=cost=proceeds=D("0")
    best=None
    while i<len(asks) and j<len(bids):
        ap=asks[i][0];bp=bids[j][0]
        if bp<=ap:break
        unit=min(aq,bq,(MAX_COST-cost)/ap)
        if unit<=0:break
        qty+=unit;cost+=unit*ap;proceeds+=unit*bp
        fees=cost*FEE_BUY+proceeds*FEE_SELL
        net=proceeds-cost-fees-REBALANCE
        roi=net/cost
        if roi>=MIN_ROI and (best is None or net>best["net_raw"]):
            best={"coin":coin,"buy":buy_ex,"sell":sell_ex,"qty":str(qty),"buy_vwap":str(cost/qty),"sell_vwap":str(proceeds/qty),"best_ask":str(asks[0][0]),"best_bid":str(bids[0][0]),"buy_cost":str(cost),"sell_proceeds":str(proceeds),"fees":str(fees),"rebalance_reserve":str(REBALANCE),"net":str(net),"net_roi_pct":str(roi*100),"net_raw":net,"observed_utc":datetime.datetime.fromtimestamp(max(buy["at"],sell["at"]),datetime.timezone.utc).isoformat(),"status":"NETWORK_AND_INVENTORY_UNVERIFIED"}
        aq-=unit;bq-=unit
        if aq==0:
            i+=1
            if i<len(asks):aq=asks[i][1]
        if bq==0:
            j+=1
            if j<len(bids):bq=bids[j][1]
    if best:
        del best["net_raw"]
    return best

def scan_once():
    started=datetime.datetime.now(datetime.timezone.utc)
    books={}; errors={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        jobs={pool.submit(fetch,ex,coin):(ex,coin) for coin in ASSETS for ex in EXCHANGES}
        for future in concurrent.futures.as_completed(jobs):
            key=jobs[future]
            try:books[key]=future.result()
            except Exception as exc:errors["/".join(key)]=str(exc)[:100]
    opportunities=[]
    for coin in ASSETS:
        for buy_ex in EXCHANGES:
            for sell_ex in EXCHANGES:
                if buy_ex==sell_ex:continue
                b=books.get((buy_ex,coin));s=books.get((sell_ex,coin))
                if b and s:
                    candidate=match(coin,buy_ex,sell_ex,b,s)
                    if candidate:opportunities.append(candidate)
    opportunities.sort(key=lambda x:(not(x["buy"]=="kucoin" and x["sell"]=="gate"),-D(x["net"])))
    report={"scan_at_kst":started.astimezone(ZoneInfo("Asia/Seoul")).isoformat(),"books_ok":len(books),"books_failed":len(errors),"opportunities":opportunities,"verified_fills":0,"errors":errors,"note":"Book-matched opportunities and synthetic paper fills only; network, inventory and rebalancing are not verified. No live orders."}
    Path(DB).parent.mkdir(parents=True,exist_ok=True)
    # Strict verification gate: no hypothetical fill without confirmed network, transfers, and pre-positioned inventory.
    report.update({"assumed_fills_total":0,"assumed_realized_usdt":"0","assumed_equity_usdt":"10000","verified_fills":0,"verified_realized_usdt":"0","recent_paper_fills":[],"new_paper_fill":None,"verification_status":"UNVERIFIED_OBSERVATIONS_ONLY","ledger_warning":"No simulated fills: network, transfer status, and available pre-positioned inventory have not been verified."})
    Path("latest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
    with sqlite3.connect(DB) as db:
        db.execute("create table if not exists snapshots (ts text primary key, report_json text not null)")
        db.execute("insert or replace into snapshots values (?,?)",(started.isoformat(),json.dumps(report)))
    return report
