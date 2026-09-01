#!/usr/bin/env python3
"""Serve the local web build of Drive and bridge it to a running writer.

    python3 serve.py                 # http://127.0.0.1:8787/
    python3 serve.py --port 9000
    python3 serve.py --host 0.0.0.0  # reach it from a phone on the same Wi-Fi

Writer discovery mirrors the Swift app (AppConfiguration.initialWriterURL):
DRIVEMODE_WRITER_URL / DRIVE_WRITER_URL, then ~/.drivemode/writer.json
(DRIVEMODE_WRITER_DISCOVERY overrides the path). No magic port. The page asks
`/discovery`; when a writer is known, `/writer/*` proxies to it so a phone on
the LAN can reach a loopback-only writer and no CORS or mixed-content rule
gets in the way.

Standard library only — nothing to install.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def discover_writer_url() -> str:
    for key in ("DRIVEMODE_WRITER_URL", "DRIVE_WRITER_URL"):
        value = os.environ.get(key, "").strip()
        if value:
            return value.rstrip("/")
    explicit = os.environ.get("DRIVEMODE_WRITER_DISCOVERY", "").strip()
    path = Path(explicit) if explicit else Path.home() / ".drivemode" / "writer.json"
    try:
        data = json.loads(path.read_text())
        url = str(data.get("url", "")).strip().rstrip("/")
        if url:
            return url
    except (OSError, ValueError):
        pass
    return ""


class Handler(SimpleHTTPRequestHandler):
    server_version = "DriveLocal/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):  # quieter: only non-200s and proxy errors
        if args and str(args[1:2] and args[1]).startswith(("2", "3")):
            return
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/discovery":
            return self._json({"url": discover_writer_url(), "proxy": "/writer"})
        if self.path.startswith("/writer/"):
            return self._proxy("GET")
        if self.path.split("?")[0] == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/writer/"):
            return self._proxy("POST")
        self.send_error(405)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, payload, status=200):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _proxy(self, method):
        base = discover_writer_url()
        if not base:
            return self._json({"ok": False, "error": "no writer discovered"}, 503)
        target = base + self.path[len("/writer"):]
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(target, data=body, method=method)
        req.add_header("Content-Type", self.headers.get("Content-Type", "application/json"))
        try:
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as err:
            data = err.read()
            self.send_response(err.code)
            self.send_header("Content-Type", err.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (urllib.error.URLError, OSError) as err:
            self._json({"ok": False, "error": f"writer unreachable: {err}"}, 502)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    writer = discover_writer_url()
    print(f"Drive (local web build)  →  http://{args.host}:{args.port}/")
    print(f"Writer: {writer or 'none discovered — the app runs the labeled preview world'}")
    if args.host == "0.0.0.0":
        print("Open the LAN address of this machine on your phone, then Share → Add to Home Screen.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
