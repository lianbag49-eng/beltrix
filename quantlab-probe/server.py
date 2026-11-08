"""QuantLab read-only historical data probe. Never places orders."""
import os,json,threading,datetime,time,traceback
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
STATE={"status":"starting","results":{},"paper_only":True}
START="2023-11-08T00:00:00Z"
def worker():
 import ccxt
 for venue in ("bingx","lbank","bybit"):
  for coin in ("BTC","ETH"):
   key=f"{venue}:{coin}"
   try:
    ex=getattr(ccxt,venue)({"enableRateLimit":True,"timeout":12000,"options":{"defaultType":"swap"}})
    ex.load_markets()
    symbol=f"{coin}/USDT:USDT"
    if symbol not in ex.markets or not ex.market(symbol).get("swap"):
     STATE["results"][key]={"status":"unsupported_swap"};continue
    rows=ex.fetch_ohlcv(symbol,"1h",since=ex.parse8601(START),limit=10)
    STATE["results"][key]={"status":"ok" if rows else "empty","candles":len(rows),"first":datetime.datetime.fromtimestamp(rows[0][0]/1000,datetime.timezone.utc).isoformat() if rows else None}
   except Exception as e:
    STATE["results"][key]={"status":"error","detail":str(e)[:300]}
 STATE["status"]="probe_finished"
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  if self.path not in ("/","/health","/status"):
   self.send_response(404);self.end_headers();return
  body=json.dumps(STATE,ensure_ascii=False).encode()
  self.send_response(200);self.send_header("Content-Type","application/json");self.send_header("Cache-Control","no-store");self.send_header("Content-Length",str(len(body)));self.end_headers();self.wfile.write(body)
if __name__=="__main__":
 STATE["status"]="probing";threading.Thread(target=worker,daemon=True).start()
 ThreadingHTTPServer(("0.0.0.0",int(os.environ.get("PORT","10000"))),Handler).serve_forever()
