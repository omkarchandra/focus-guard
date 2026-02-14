#!/usr/bin/env bash
# Installs the native messaging host for the Web Blocker extension in Comet.
# Usage: bash install-native-host.sh <extension-id>
#
# To find your extension ID:
#   1. Open chrome://extensions in Comet
#   2. Find "Web Blocker"
#   3. Copy the "ID" value

set -euo pipefail

EXTENSION_ID="${1:-}"
if [[ -z "$EXTENSION_ID" ]]; then
  echo "Usage: bash install-native-host.sh <extension-id>"
  echo ""
  echo "Find your extension ID at chrome://extensions under Web Blocker."
  exit 1
fi

HOST_NAME="com.webblocker.appblocker"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/native-host/run_host.sh"
NATIVE_DIR="$HOME/Library/Application Support/Comet/NativeMessagingHosts"

# Create NativeMessagingHosts directory
mkdir -p "$NATIVE_DIR"

# Make the Python script executable
chmod +x "$HOST_SCRIPT"

# Write the native messaging host manifest
cat > "$NATIVE_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "App blocker for Web Blocker extension",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "Native messaging host installed:"
echo "  Manifest: $NATIVE_DIR/$HOST_NAME.json"
echo "  Script:   $HOST_SCRIPT"
echo "  Extension: $EXTENSION_ID"
echo ""
echo "Now reload the Web Blocker extension in chrome://extensions"
