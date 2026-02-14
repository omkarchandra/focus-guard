#!/usr/bin/env python3
"""Native messaging host for Web Blocker — kills macOS app processes."""

import json
import struct
import subprocess
import sys


def read_message():
    """Read a native messaging message from stdin."""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    length = struct.unpack("=I", raw_length)[0]
    data = sys.stdin.buffer.read(length)
    return json.loads(data.decode("utf-8"))


def send_message(msg):
    """Send a native messaging message to stdout."""
    encoded = json.dumps(msg).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def kill_apps(app_names):
    """Kill processes by name. Returns results per app."""
    results = {}
    for name in app_names:
        # Use pkill with exact match (-x) and case-insensitive (-i)
        ret = subprocess.run(
            ["pkill", "-xi", name],
            capture_output=True,
        )
        results[name] = "killed" if ret.returncode == 0 else "not_running"
    return results


def main():
    while True:
        msg = read_message()
        if msg is None:
            break

        action = msg.get("action", "")

        if action == "kill":
            apps = msg.get("apps", [])
            results = kill_apps(apps)
            send_message({"ok": True, "results": results})

        elif action == "ping":
            send_message({"ok": True, "pong": True})

        else:
            send_message({"ok": False, "error": f"unknown action: {action}"})


if __name__ == "__main__":
    main()
