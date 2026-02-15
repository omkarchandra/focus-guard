# Focus Guard

A Chrome/Chromium browser extension that blocks distracting websites and apps for a set duration. One control point for both web and app blocking.

## How It Works

- **Website blocking**: Uses Chrome's `declarativeNetRequest` API to redirect blocked sites to a "blocked" page with a countdown timer.
- **App blocking**: A local Python server kills blocked app processes every 2 seconds. The extension communicates with the server via HTTP on `localhost:7532`.

## Features

- Block websites and macOS/Linux/Windows apps from a single popup
- Configurable duration: 5, 10, 15, 20, 25, 30, 45, 60, 90, or 120 minutes
- Add/remove sites and apps while a blocking session is active
- Blocked websites show a countdown page
- Blocked apps are terminated every 2 seconds if reopened

## Installation

### 1. Install the Extension

1. Open `chrome://extensions` in your Chromium-based browser
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo

### 2. Install the Kill Server

The kill server is a small Python HTTP server that handles app blocking. It requires Python 3.6+.

```bash
python3 server/install.py
```

This will:
- **macOS**: Copy the server to `~/.webblocker/` and register a LaunchAgent (auto-starts on login)
- **Linux**: Copy the server to `~/.webblocker/` and create a systemd user service (auto-starts on login)
- **Windows**: Copy the server to `~/.webblocker/` and create a Task Scheduler entry (auto-starts on logon)

### Manual Server Start

If you prefer to run the server manually instead of auto-starting:

```bash
python3 server/server.py
```

## Usage

1. Click the extension icon in the toolbar
2. **Sites tab**: Add website domains to block (e.g. `reddit.com`, `x.com`)
3. **Apps tab**: Add app names to block (e.g. `WhatsApp`, `Discord`)
4. Set the blocking duration with the slider
5. Click **Start Blocking**

## Managing the Kill Server

**macOS:**
```bash
# Stop
launchctl unload ~/Library/LaunchAgents/com.webblocker.killserver.plist

# Start
launchctl load ~/Library/LaunchAgents/com.webblocker.killserver.plist
```

**Linux:**
```bash
# Stop
systemctl --user stop webblocker.service

# Start
systemctl --user start webblocker.service

# View logs
journalctl --user -u webblocker.service
```

**Windows (PowerShell):**
```powershell
# Stop
schtasks /End /TN FocusGuardKillServer

# Start
schtasks /Run /TN FocusGuardKillServer
```

## Project Structure

```
extension/          Chrome extension (load this in your browser)
  background/       Service worker for blocking logic
  blocked/          "Blocked" page shown for blocked sites
  popup/            Extension popup UI
  icons/            Extension icons
server/             Kill server (handles app blocking)
  server.py         Cross-platform HTTP server
  install.py        Cross-platform auto-start installer
```
