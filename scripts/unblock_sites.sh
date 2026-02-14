#!/usr/bin/env bash
# Removes web-app-blocker entries from /etc/hosts
# Usage: sudo bash unblock_sites.sh

set -euo pipefail

MARKER_START="# >>> WEB-APP-BLOCKER START <<<"
MARKER_END="# >>> WEB-APP-BLOCKER END <<<"
HOSTS="/etc/hosts"

if grep -q "$MARKER_START" "$HOSTS" 2>/dev/null; then
  sudo sed -i '' "/$MARKER_START/,/$MARKER_END/d" "$HOSTS"
  sudo dscacheutil -flushcache
  sudo killall -HUP mDNSResponder 2>/dev/null || true
  echo "All blocked websites removed from /etc/hosts. DNS cache flushed."
else
  echo "No web-app-blocker entries found in /etc/hosts."
fi
