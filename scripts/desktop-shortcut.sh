#!/usr/bin/env bash
# Put a shortcut to the built app on the Desktop (macOS). Re-run after `npm run dist:mac`; safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."
APP="$PWD/release/mac-arm64/HorseDraft.app"
LINK="$HOME/Desktop/HorseDraft.app"
if [ ! -d "$APP" ]; then
  echo "No built app at $APP. Run: npm run dist:mac" >&2
  exit 1
fi
ln -sfn "$APP" "$LINK"
echo "Desktop shortcut: $LINK -> $APP"
