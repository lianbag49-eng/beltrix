"""Render web process with a 30-second read-only scanner loop and health endpoints."""
import json, os, signal, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
from scanner30 import scan_once

interval=max(30,float(os.getenv("SCAN_INTERVAL_SECONDS","30")))
state={"started":time.time(),"last_scan":None,"last_error":None,"attempts":0}
stop=threading.Event()
def background():
    while not stop.is_set():
        begun=time.monotonic()
        state["attempts"]+=1
        try:
            result=scan_once()
            state["last_scan"]=result["scan_at_kst"]
            state["last_error"]=None
            print("scan complete",result["scan_at_kst"],"books",result["books_ok"],"opportunities",len(result["opportunities"]),flush=True)
        except Exception as exc:
            state["last_error"]=str(exc)
            print("scan error",repr(exc),flush=True)
        stop.wait(max(0,interval-(time.monotonic()-begun)))

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path=urlsplit(self.path).path.rstrip("/") or "/"
        if path in ("/","/dashboard","/index.html") or path not in ("/health","/latest","/api/latest","/api/health"):
            # Mobile in-app browsers sometimes open URL aliases/trailing slashes.
            # Always serve a usable human-readable dashboard instead of a bare 404.
            raw=(Path(__file__).parent/"dashboard.html").read_bytes()
            self.send_response(200);self.send_header("Content-Type","text/html; charset=utf-8");self.send_header("Cache-Control","no-store");self.send_header("Content-Length",str(len(raw)));self.end_headers();self.wfile.write(raw);return
        payload={"status":"paper_only","scan_interval_seconds":interval,"last_scan":state["last_scan"],"attempts":state["attempts"],"last_error":state["last_error"]} if path not in ("/latest","/api/latest") else {"status":"no_scan_yet"}
        if path in ("/latest","/api/latest") and Path("latest.json").exists():
            try: payload=json.loads(Path("latest.json").read_text())
            except Exception as exc:payload={"error":str(exc)}
        encoded=json.dumps(payload,ensure_ascii=False,default=str).encode()
        self.send_response(200);self.send_header("Content-Type","application/json; charset=utf-8");self.send_header("Cache-Control","no-store");self.send_header("Content-Length",str(len(encoded)));self.end_headers();self.wfile.write(encoded)
    def log_message(self,*args):pass

if __name__=="__main__":
    threading.Thread(target=background,daemon=True).start()
    httpd=ThreadingHTTPServer(("0.0.0.0",int(os.getenv("PORT","10000"))),Handler)
    try:httpd.serve_forever()
    finally:stop.set();httpd.server_close()
