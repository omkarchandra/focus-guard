#!/usr/bin/env python3
"""Cross-platform installer for Focus Guard kill server.
Sets up the server to run automatically on startup.

Usage: python3 install.py
"""

import json
import os
import platform
import shutil
import stat
import subprocess
import sys

SYSTEM = platform.system()
HOME = os.path.expanduser("~")
SERVER_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")


def install_macos():
    """Install LaunchAgent for macOS."""
    dest_dir = os.path.join(HOME, ".webblocker")
    os.makedirs(dest_dir, exist_ok=True)
    dest_script = os.path.join(dest_dir, "server.py")
    shutil.copy2(SERVER_SCRIPT, dest_script)
    os.chmod(dest_script, os.stat(dest_script).st_mode | stat.S_IEXEC)

    plist_path = os.path.join(HOME, "Library", "LaunchAgents", "com.webblocker.killserver.plist")
    python_path = shutil.which("python3") or "/usr/bin/python3"

    plist = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>Label</key>
\t<string>com.webblocker.killserver</string>
\t<key>ProgramArguments</key>
\t<array>
\t\t<string>{python_path}</string>
\t\t<string>{dest_script}</string>
\t</array>
\t<key>RunAtLoad</key>
\t<true/>
\t<key>KeepAlive</key>
\t<true/>
\t<key>StandardOutPath</key>
\t<string>/tmp/webblocker-server.log</string>
\t<key>StandardErrorPath</key>
\t<string>/tmp/webblocker-server.log</string>
</dict>
</plist>"""

    os.makedirs(os.path.dirname(plist_path), exist_ok=True)
    with open(plist_path, "w") as f:
        f.write(plist)

    subprocess.run(["launchctl", "unload", plist_path], capture_output=True)
    subprocess.run(["launchctl", "load", plist_path], check=True)

    print(f"  Server: {dest_script}")
    print(f"  LaunchAgent: {plist_path}")
    print(f"  Log: /tmp/webblocker-server.log")


def install_linux():
    """Install systemd user service for Linux."""
    dest_dir = os.path.join(HOME, ".webblocker")
    os.makedirs(dest_dir, exist_ok=True)
    dest_script = os.path.join(dest_dir, "server.py")
    shutil.copy2(SERVER_SCRIPT, dest_script)
    os.chmod(dest_script, os.stat(dest_script).st_mode | stat.S_IEXEC)

    python_path = shutil.which("python3") or "/usr/bin/python3"
    service_dir = os.path.join(HOME, ".config", "systemd", "user")
    os.makedirs(service_dir, exist_ok=True)
    service_path = os.path.join(service_dir, "webblocker.service")

    service = f"""[Unit]
Description=Focus Guard Kill Server
After=network.target

[Service]
ExecStart={python_path} {dest_script}
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
"""

    with open(service_path, "w") as f:
        f.write(service)

    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "--user", "enable", "webblocker.service"], check=True)
    subprocess.run(["systemctl", "--user", "restart", "webblocker.service"], check=True)

    print(f"  Server: {dest_script}")
    print(f"  Service: {service_path}")
    print(f"  Logs: journalctl --user -u webblocker.service")


def install_windows():
    """Install Windows Task Scheduler task."""
    dest_dir = os.path.join(HOME, ".webblocker")
    os.makedirs(dest_dir, exist_ok=True)
    dest_script = os.path.join(dest_dir, "server.py")
    shutil.copy2(SERVER_SCRIPT, dest_script)

    python_path = shutil.which("python3") or shutil.which("python") or "python"

    # Remove existing task if any
    subprocess.run(
        ["schtasks", "/Delete", "/TN", "FocusGuardKillServer", "/F"],
        capture_output=True,
    )

    # Create task that runs at logon
    subprocess.run([
        "schtasks", "/Create",
        "/TN", "FocusGuardKillServer",
        "/TR", f'"{python_path}" "{dest_script}"',
        "/SC", "ONLOGON",
        "/RL", "HIGHEST",
        "/F",
    ], check=True)

    # Also start it now
    subprocess.run(
        ["schtasks", "/Run", "/TN", "FocusGuardKillServer"],
        capture_output=True,
    )

    print(f"  Server: {dest_script}")
    print(f"  Task: FocusGuardKillServer (runs at logon)")


def main():
    print(f"[FocusGuard] Installing kill server on {SYSTEM}...\n")

    if SYSTEM == "Darwin":
        install_macos()
    elif SYSTEM == "Linux":
        install_linux()
    elif SYSTEM == "Windows":
        install_windows()
    else:
        print(f"Unsupported platform: {SYSTEM}")
        sys.exit(1)

    print(f"\nDone! Server listens on http://127.0.0.1:7532")


if __name__ == "__main__":
    main()
