import os,json,threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import yfinance as yf
import pandas as pd
import numpy as np
import requests,io,time
state={"status":"starting","results":[],"errors":[]}
def load(ticker):
 errors=[]
 try:
  d=yf.Ticker(ticker).history(start="2015-01-01",auto_adjust=True,timeout=20)
  if len(d)>0: return d,"Yahoo adjusted"
 except Exception as e: errors.append(str(e))
 try:
  response=requests.get("https://stooq.com/q/d/l/",params={"s":ticker.lower()+".us","i":"d","d1":"20150101"},timeout=25)
  response.raise_for_status()
  d=pd.read_csv(io.StringIO(response.text),parse_dates=["Date"]).set_index("Date").sort_index()
  if len(d)<30 or not {"Open","High","Low","Close"}.issubset(d.columns): raise ValueError("invalid Stooq data")
  return d,"Stooq vendor-adjusted; adjustment basis not independently verified"
 except Exception as e: errors.append(str(e))
 raise ValueError("; ".join(errors) or "no data")
def run():
 state["status"]="running"
 for ticker in ["PLTR","META","VST","GRAB","INTC","PYPL","AMD","NVDA","QQQ","SPY"]:
  try:
   d,source=load(ticker)
   state.setdefault("sources",{})[ticker]=source
   c=d.Close; delta=c.diff(); gain=delta.clip(lower=0).ewm(alpha=1/14,adjust=False,min_periods=14).mean(); loss=(-delta.clip(upper=0)).ewm(alpha=1/14,adjust=False,min_periods=14).mean()
   rsi=100-100/(1+gain/loss); dd=c/c.rolling(252,min_periods=252).max()-1
   for drop in [.2,.3,.4,.5,.6]:
    for r in [25,30,35,40]:
     for h in [63,126,252,504,756,1260]:
      mask=(dd<=-drop)&(rsi<=r); entries=mask&~mask.shift(1,fill_value=False)
      returns=c.shift(-h-1)/d.Open.shift(-1)*.999/1.001-1
      v=returns[entries].dropna()
      if len(v): state["results"].append({"ticker":ticker,"drop":drop,"rsi":r,"days":h,"n":len(v),"mean":float(v.mean()),"win":float((v>0).mean())})
   state.setdefault("coverage",{})[ticker]=len(d)
   print("DVPS coverage",ticker,len(d),source,flush=True)
  except Exception as e:
   state["errors"].append({"ticker":ticker,"error":str(e)})
   print("DVPS error",ticker,str(e),flush=True)
 state["status"]="complete" if state["results"] else "failed"
 print("DVPS summary",state["status"],len(state["results"]),state.get("coverage",{}),flush=True)
class Handler(BaseHTTPRequestHandler):
 def do_HEAD(self):
  self.send_response(200); self.end_headers()
 def do_GET(self):
  b=json.dumps(state).encode(); self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(b)
threading.Thread(target=run,daemon=True).start()
ThreadingHTTPServer(("0.0.0.0",int(os.environ.get("PORT",10000))),Handler).serve_forever()
