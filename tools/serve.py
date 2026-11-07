#!/usr/bin/env python3
"""Serve this repo on the phone's localhost so Chrome can open it before anything is pushed.

    python3 tools/serve.py           start in the background (keeps running after the session ends)
    python3 tools/serve.py --fg      run in the foreground
    python3 tools/serve.py --stop    stop it

Then open http://localhost:8080/ (or /preview/) in Chrome on the same phone.
Absolute paths like /lad.css work because the repo root is the server root, like on GitHub Pages.
Unknown paths get the repo's 404.html, like GitHub Pages.
"""
import http.server, os, signal, socketserver, sys

PORT = int(os.environ.get("PORT", "8080"))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIDFILE = os.path.expanduser("~/.cache/lad-serve.pid")
LOG = os.path.expanduser("~/.cache/lad-serve.log")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")   # always the latest file while iterating
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        page = os.path.join(ROOT, "404.html")
        if code == 404 and os.path.exists(page):
            body = open(page, "rb").read()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().send_error(code, message, explain)


def stop():
    try:
        pid = int(open(PIDFILE).read())
        os.kill(pid, signal.SIGTERM)
        print("stopped", pid)
    except (OSError, ValueError):
        print("not running")
    try:
        os.remove(PIDFILE)
    except OSError:
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), Handler) as httpd:
        httpd.serve_forever()


if __name__ == "__main__":
    os.makedirs(os.path.dirname(PIDFILE), exist_ok=True)
    if "--stop" in sys.argv:
        stop()
    elif "--fg" in sys.argv:
        print(f"serving {ROOT} on http://localhost:{PORT}/")
        serve()
    else:
        stop() if os.path.exists(PIDFILE) else None
        if os.fork():                      # detach twice so it survives the shell that started it
            print(f"serving {ROOT} on http://localhost:{PORT}/  (log: {LOG})")
            sys.exit(0)
        os.setsid()
        if os.fork():
            os._exit(0)
        open(PIDFILE, "w").write(str(os.getpid()))
        log = open(LOG, "a", buffering=1)
        os.dup2(log.fileno(), 1)
        os.dup2(log.fileno(), 2)
        devnull = open(os.devnull)
        os.dup2(devnull.fileno(), 0)
        serve()
