#!/usr/bin/env bash
# One-time setup on a Mac (Apple Silicon or Intel). Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is missing. Install it from https://brew.sh and re-run." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "Installing Node 22 via Homebrew..."
  brew install node@22
  brew link --overwrite node@22 || true
fi

echo "Installing npm dependencies (includes the Electron runtime, ~100 MB)..."
npm install

echo "Installing the Playwright Chromium used by the screenshot tests..."
npx playwright install chromium

echo
echo "Done. Next:"
echo "  npm run dev        # open http://localhost:5173 in a browser"
echo "  npm run app        # run the desktop app"
echo "  npm run dist:mac   # build release/HorseDraft-*.dmg"
echo "  npm run check      # typecheck + unit tests + build"
