#!/usr/bin/python3
"""Native messaging host for Web Blocker — kills macOS app processes."""

import json
import logging
import struct
import subprocess
import sys
import traceback

LOG_FILE = "/tmp/webblocker_native.log"
logging.basicConfig(filename=LOG_FILE, level=logging.DEBUG,
                    format="%(asctime)s %(message)s")


def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        logging.debug("No data on stdin, exiting")
        return None
    length = struct.unpack("=I", raw_length)[0]
    logging.debug("Reading message of length %d", length)
    data = sys.stdin.buffer.read(length)
    msg = json.loads(data.decode("utf-8"))
    logging.debug("Received: %s", msg)
    return msg


def send_message(msg):
    encoded = json.dumps(msg).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()
    logging.debug("Sent: %s", msg)


def kill_apps(app_names):
    results = {}
    for name in app_names:
        logging.debug("Killing: %s", name)
        ret = subprocess.run(
            ["pkill", "-if", name],
            capture_output=True,
        )
        logging.debug("pkill exit code: %d, stderr: %s", ret.returncode, ret.stderr)
        results[name] = "killed" if ret.returncode == 0 else "not_running"
    return results


def main():
    logging.debug("Native host started, argv: %s", sys.argv)
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
    try:
        main()
    except Exception:
        logging.error("CRASH: %s", traceback.format_exc())
        raise
