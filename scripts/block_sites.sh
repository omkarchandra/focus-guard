#!/usr/bin/env bash
# Reads websites from blocklist.json and adds them to /etc/hosts
# Usage: sudo bash block_sites.sh [path/to/blocklist.json]

set -euo pipefail

BLOCKLIST="${1:-$(dirname "$0")/../blocklist.json}"
MARKER_START="# >>> WEB-APP-BLOCKER START <<<"
MARKER_END="# >>> WEB-APP-BLOCKER END <<<"
HOSTS="/etc/hosts"

if [[ ! -f "$BLOCKLIST" ]]; then
  echo "Error: blocklist.json not found at $BLOCKLIST"
  exit 1
fi

# Extract website list (requires python3 for JSON parsing)
SITES=$(python3 -c "
import json, sys
with open('$BLOCKLIST') as f:
    data = json.load(f)
for site in data.get('websites', []):
    print(site)
")

if [[ -z "$SITES" ]]; then
  echo "No websites in blocklist. Nothing to block."
  exit 0
fi

# Remove old block if present
if grep -q "$MARKER_START" "$HOSTS" 2>/dev/null; then
  sudo sed -i '' "/$MARKER_START/,/$MARKER_END/d" "$HOSTS"
fi

# Build new block entries
{
  echo "$MARKER_START"
  while IFS= read -r site; do
    echo "127.0.0.1  $site"
    echo "127.0.0.1  www.$site"
  done <<< "$SITES"
  echo "$MARKER_END"
} | sudo tee -a "$HOSTS" > /dev/null

# Flush DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder 2>/dev/null || true

echo "Blocked $(echo "$SITES" | wc -l | tr -d ' ') website(s). DNS cache flushed."
