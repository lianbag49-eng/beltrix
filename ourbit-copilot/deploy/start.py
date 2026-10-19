"""Run migrations, then supervise the internal API and public Next.js process."""
import os
import signal
import subprocess
import sys
import time
import urllib.request
import urllib.error
from html.parser import HTMLParser

subprocess.run([sys.executable,'-m','alembic','upgrade','head'],cwd='/app/backend',check=True)
processes = [subprocess.Popen([sys.executable,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000','--no-access-log'],cwd='/app/backend'),
             subprocess.Popen(['node','server.js'],cwd='/app/web',env={**os.environ,'PORT':os.environ.get('PORT','10000'),'HOSTNAME':'0.0.0.0'})]


def stop(*_):
    for process in processes:
        if process.poll() is None:
            process.terminate()


signal.signal(signal.SIGTERM,stop)
signal.signal(signal.SIGINT,stop)
try:
    port=os.environ.get('PORT','10000')
    base='http://127.0.0.1:'+port
    for attempt in range(60):
        try:
            with urllib.request.urlopen(base+'/api/health',timeout=5) as response:
                if response.status==200:
                    break
        except (urllib.error.URLError,TimeoutError):
            if any(p.poll() is not None for p in processes):
                raise RuntimeError('A service process exited before readiness')
            time.sleep(1)
    else:
        raise RuntimeError('DB-backed readiness probe failed')
    for path in ['/api/auth/me','/api/kols']:
        try:
            urllib.request.urlopen(base+path,timeout=5)
            raise RuntimeError('Unauthenticated CRM data was accessible')
        except urllib.error.HTTPError as error:
            if error.code!=401:
                raise RuntimeError('Authentication probe failed with status '+str(error.code)) from None
    with urllib.request.urlopen(base,timeout=5) as response:
        html=response.read().decode()
    class Scripts(HTMLParser):
        sources=[]
        def handle_starttag(self,tag,attrs):
            if tag=='script':
                source=dict(attrs).get('src','')
                if source.startswith('/_next/'):
                    self.sources.append(source)
    parser=Scripts();parser.feed(html)
    if not parser.sources:
        raise RuntimeError('Client scripts missing from rendered page')
    for source in parser.sources:
        with urllib.request.urlopen(base+source,timeout=5) as response:
            if response.status!=200 or 'javascript' not in response.headers.get('Content-Type',''):
                raise RuntimeError('A client script could not be loaded')
    print('LIVE_SMOKE_PASS: DB readiness 200; unauthenticated CRM 401; page and all client scripts 200',flush=True)
    while all(process.poll() is None for process in processes):
        time.sleep(.5)
finally:
    stop()
    for process in processes:
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()
    sys.exit(next((p.returncode for p in processes if p.returncode and p.returncode>0),0))
