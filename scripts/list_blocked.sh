#!/usr/bin/env bash
# Displays the current blocklist
# Usage: bash list_blocked.sh [path/to/blocklist.json]

set -euo pipefail

BLOCKLIST="${1:-$(dirname "$0")/../blocklist.json}"

if [[ ! -f "$BLOCKLIST" ]]; then
  echo "No blocklist found."
  exit 0
fi

python3 -c "
import json
with open('$BLOCKLIST') as f:
    data = json.load(f)

sites = data.get('websites', [])
apps = data.get('apps', [])

print('=== Blocked Websites ===')
if sites:
    for s in sites:
        print(f'  - {s}')
else:
    print('  (none)')

print()
print('=== Blocked Apps ===')
if apps:
    for a in apps:
        print(f'  - {a}')
else:
    print('  (none)')
"
