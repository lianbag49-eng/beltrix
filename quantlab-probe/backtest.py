"""Read-only QuantLab historical backtest, hourly candles, 4 deterministic strategies."""
import ccxt,datetime,math,time
def ema(v,n):
 a=2/(n+1);o=[];x=None
 for z in v:
  x=z if x is None else a*z+(1-a)*x;o.append(x)
 return o
def candles(venue,coin,years=3):
 ex=getattr(ccxt,venue)({"enableRateLimit":True,"timeout":15000,"options":{"defaultType":"swap"}})
 ex.load_markets();symbol=f"{coin}/USDT:USDT"
 if symbol not in ex.markets or not ex.market(symbol).get("swap"):raise ValueError("swap market unsupported")
 since=ex.parse8601("2023-11-08T00:00:00Z");end=int(time.time()*1000);out=[];attempt=0
 while since<end and len(out)<28000:
  batch=ex.fetch_ohlcv(symbol,"1h",since=since,limit=500)
  if not batch:break
  valid=[r for r in batch if len(r)>=6 and r[0]>=since and r[0]<end]
  if not valid:break
  out.extend(valid);nxt=valid[-1][0]+3600000
  if nxt<=since:break
  since=nxt;attempt+=1
  if attempt>90:break
 out=sorted({r[0]:r for r in out}.values(),key=lambda r:r[0])
 return out
def run(rows,variant,fee=0.0005,slip=0.0002):
 if len(rows)<100:raise ValueError("insufficient candles")
 c=[r[4] for r in rows];h=[r[2] for r in rows];l=[r[3] for r in rows];v=[r[5] for r in rows]
 e20=ema(c,20);e50=ema(c,50)
 tr=[h[0]-l[0]]+[max(h[i]-l[i],abs(h[i]-c[i-1]),abs(l[i]-c[i-1])) for i in range(1,len(c))]
 atr=ema(tr,14);equity=10000.;peak=equity;mdd=0;trades=[];pos=None
 # Signals calculated from prior completed candle; next-bar open execution.
 for i in range(60,len(rows)):
  j=i-1;op=rows[i][1];hi=h[i];lo=l[i]
  if pos:
   stophit=lo<=pos["stop"] if pos["side"]==1 else hi>=pos["stop"]
   targethit=hi>=pos["target"] if pos["side"]==1 else lo<=pos["target"]
   if stophit or targethit:
    exitprice=pos["stop"] if stophit else pos["target"]
    exitprice*=1-slip*pos["side"]
    pnl=pos["qty"]*pos["side"]*(exitprice-pos["entry"])-fee*pos["qty"]*(pos["entry"]+exitprice)
    equity+=pnl;peak=max(peak,equity);mdd=max(mdd,1-equity/peak)
    trades.append({"pnl":round(pnl,4),"exit_ts":rows[i][0]});pos=None
  if pos:continue
  top=max(h[j-20:j]);bot=min(l[j-20:j]);volavg=sum(v[j-20:j])/20
  up=e20[j]>e50[j];down=e20[j]<e50[j];side=0
  if variant=="V1":side=1 if up and c[j]>top else (-1 if down and c[j]<bot else 0)
  elif variant=="V2":side=1 if c[j]<bot*1.003 and c[j]>e50[j]*0.96 else (-1 if c[j]>top*0.997 and c[j]<e50[j]*1.04 else 0)
  elif variant=="V3":side=1 if up and c[j]>max(h[j-10:j]) and v[j]>volavg else (-1 if down and c[j]<min(l[j-10:j]) and v[j]>volavg else 0)
  elif variant=="V4":
   if v[j]>volavg*1.2:side=1 if up and c[j]>top else (-1 if down and c[j]<bot else 0)
   else:side=1 if c[j]<bot*1.003 and up else (-1 if c[j]>top*.997 and down else 0)
  if not side or atr[j]<=0:continue
  entry=op*(1+slip*side);dist=atr[j]*1.5
  qty=min((equity*.005)/dist,equity/entry)
  if qty<=0:continue
  pos={"side":side,"entry":entry,"stop":entry-side*dist,"target":entry+side*dist*1.5,"qty":qty}
 wins=[t["pnl"] for t in trades if t["pnl"]>0];loss=[t["pnl"] for t in trades if t["pnl"]<0]
 return {"trades":len(trades),"win_rate_pct":round(len(wins)/len(trades)*100,2) if trades else None,"profit_factor":round(sum(wins)/-sum(loss),3) if loss else None,"return_pct":round((equity/10000-1)*100,2),"closed_trade_mdd_pct":round(mdd*100,2),"warning":"MDD excludes unrealized PnL; no funding/liquidation; intrabar stop priority; exploratory only"}
