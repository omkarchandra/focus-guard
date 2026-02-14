#!/usr/bin/env bash
# Reads apps from blocklist.json and kills their processes
# Usage: bash block_apps.sh [path/to/blocklist.json]

set -euo pipefail

BLOCKLIST="${1:-$(dirname "$0")/../blocklist.json}"

if [[ ! -f "$BLOCKLIST" ]]; then
  echo "Error: blocklist.json not found at $BLOCKLIST"
  exit 1
fi

APPS=$(python3 -c "
import json
with open('$BLOCKLIST') as f:
    data = json.load(f)
for app in data.get('apps', []):
    print(app)
")

if [[ -z "$APPS" ]]; then
  echo "No apps in blocklist. Nothing to block."
  exit 0
fi

KILLED=0
while IFS= read -r app; do
  if pgrep -xiq "$app" 2>/dev/null; then
    pkill -xiq "$app" 2>/dev/null && echo "Killed: $app" && ((KILLED++))
  else
    echo "Not running: $app"
  fi
done <<< "$APPS"

echo "Killed $KILLED app(s)."
