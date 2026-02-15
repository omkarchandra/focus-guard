#!/usr/bin/env python3
"""Local HTTP server for Web Blocker — kills blocked app processes.
Works on macOS, Linux, and Windows.
"""

import json
import platform
import subprocess
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 7532
KILL_INTERVAL = 2  # seconds
SYSTEM = platform.system()  # "Darwin", "Linux", "Windows"

blocked_apps = []
blocked_lock = threading.Lock()


def kill_app(name):
    """Kill a process by name. Returns True if killed."""
    if SYSTEM == "Windows":
        ret = subprocess.run(
            ["taskkill", "/F", "/IM", f"{name}.exe"],
            capture_output=True,
        )
        if ret.returncode != 0:
            # Try without .exe suffix in case user included it
            ret = subprocess.run(
                ["taskkill", "/F", "/IM", name],
                capture_output=True,
            )
        return ret.returncode == 0
    else:
        # macOS and Linux: pkill with case-insensitive pattern match
        ret = subprocess.run(
            ["pkill", "-if", name],
            capture_output=True,
        )
        return ret.returncode == 0


def kill_loop():
    """Background thread that kills blocked apps every KILL_INTERVAL seconds."""
    while True:
        with blocked_lock:
            apps = list(blocked_apps)
        for name in apps:
            kill_app(name)
        time.sleep(KILL_INTERVAL)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))

        if self.path == "/kill":
            apps = body.get("apps", [])
            results = {}
            for name in apps:
                results[name] = "killed" if kill_app(name) else "not_running"
            self._respond(200, {"ok": True, "results": results})

        elif self.path == "/block":
            with blocked_lock:
                blocked_apps.clear()
                blocked_apps.extend(body.get("apps", []))
            for name in blocked_apps:
                kill_app(name)
            self._respond(200, {"ok": True, "blocking": list(blocked_apps)})

        elif self.path == "/unblock":
            with blocked_lock:
                blocked_apps.clear()
            self._respond(200, {"ok": True, "blocking": []})

        else:
            self._respond(404, {"ok": False, "error": "not found"})

    def do_GET(self):
        if self.path == "/ping":
            with blocked_lock:
                self._respond(200, {"ok": True, "blocking": list(blocked_apps)})
        else:
            self._respond(404, {"ok": False})

    def _respond(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    t = threading.Thread(target=kill_loop, daemon=True)
    t.start()
    HTTPServer.allow_reuse_address = True
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"[WebBlocker] Kill server running on http://127.0.0.1:{PORT} ({SYSTEM}, poll every {KILL_INTERVAL}s)")
    server.serve_forever()
