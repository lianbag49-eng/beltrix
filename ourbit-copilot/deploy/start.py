"""Run migrations, then supervise the internal API and public Next.js process."""
import os
import signal
import subprocess
import sys
import time

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
