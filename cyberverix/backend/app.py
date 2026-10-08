#!/usr/bin/env python3
"""
CyberVeriX - application server

Runs the JSON API and serves the frontend from a single process:

    python backend/app.py            # http://127.0.0.1:8000
    python backend/app.py --port 9000
    python backend/app.py --reset    # rebuild the database from scratch

Standard library only. No pip install, no build step, no internet access needed.
"""
import argparse
import json
import mimetypes
import os
import posixpath
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import api  # noqa: E402
import db  # noqa: E402
import seed  # noqa: E402

FRONTEND_DIR = os.path.join(db.PROJECT_DIR, "frontend")
MAX_BODY = 256 * 1024

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")


class Handler(BaseHTTPRequestHandler):
    server_version = "CyberVeriX/1.0"
    protocol_version = "HTTP/1.1"

    # ---------------- helpers ----------------
    def log_message(self, fmt, *args):
        sys.stderr.write("[cyberverix] %s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, status, payload, content_type="application/json; charset=utf-8",
              extra_headers=None):
        if isinstance(payload, (dict, list)):
            payload = json.dumps(payload).encode("utf-8")
        elif isinstance(payload, str):
            payload = payload.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "no-referrer")
        for key, value in (extra_headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def _bearer(self):
        header = self.headers.get("Authorization", "")
        if header.lower().startswith("bearer "):
            return header[7:].strip()
        return None

    def _read_body(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return {}
        if length <= 0:
            return {}
        if length > MAX_BODY:
            raise api.ApiError(413, "Request body is too large.")
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            raise api.ApiError(400, "Request body must be valid JSON.")

    # ---------------- verbs ----------------
    def do_GET(self):
        self._route("GET")

    def do_HEAD(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def do_PUT(self):
        self._route("PUT")

    def do_DELETE(self):
        self._route("DELETE")

    def _route(self, method):
        path = urlparse(self.path).path
        try:
            if path.startswith("/api/"):
                body = self._read_body() if method in ("POST", "PUT") else {}
                status, payload = api.dispatch(method, path, body, self._bearer())
                self._send(status, payload)
            elif method == "GET":
                self._serve_static(path)
            else:
                self._send(405, {"error": "Method not allowed."})
        except api.ApiError as err:
            self._send(err.status, {"error": err.message, "details": err.details})
        except BrokenPipeError:
            pass
        except Exception:
            traceback.print_exc()
            self._send(500, {"error": "Unexpected server error. Check the server console."})

    # ---------------- static files ----------------
    def _safe_path(self, path):
        path = unquote(urlparse(path).path)
        path = posixpath.normpath(path).lstrip("/")
        target = os.path.normpath(os.path.join(FRONTEND_DIR, path))
        if not target.startswith(os.path.normpath(FRONTEND_DIR)):
            return None
        return target

    def _serve_static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        target = self._safe_path(path)
        if target is None:
            self._send(403, {"error": "Forbidden."})
            return
        if os.path.isdir(target):
            target = os.path.join(target, "index.html")
        if not os.path.isfile(target):
            # single page app fallback so deep links keep working
            target = os.path.join(FRONTEND_DIR, "index.html")
            if not os.path.isfile(target):
                self._send(404, {"error": "Not found."})
                return
        ctype = mimetypes.guess_type(target)[0] or "application/octet-stream"
        with open(target, "rb") as fh:
            data = fh.read()
        headers = {"Cache-Control": "no-cache"}
        self._send(200, data, content_type=ctype, extra_headers=headers)


def main():
    parser = argparse.ArgumentParser(description="CyberVeriX server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reset", action="store_true", help="delete and rebuild the database")
    args = parser.parse_args()

    if args.reset and os.path.exists(db.DB_PATH):
        os.remove(db.DB_PATH)
        print("[cyberverix] old database removed")

    count = db.init_db()
    seed.seed_demo()
    print("[cyberverix] database ready at %s" % db.DB_PATH)
    print("[cyberverix] %d challenges loaded" % count)
    print("[cyberverix] serving on http://%s:%d  (Ctrl+C to stop)" % (args.host, args.port))

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[cyberverix] shutting down")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
