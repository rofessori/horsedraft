#!/usr/bin/env bash
# One-time setup on a Mac (Apple Silicon or Intel). Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_MAJOR_REQUIRED=22

node_ok() {
  command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge "$NODE_MAJOR_REQUIRED" ]
}

# Prefer nvm when the machine already uses it (respects .nvmrc), otherwise Homebrew.
if ! node_ok; then
  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    echo "Installing Node $NODE_MAJOR_REQUIRED via nvm..."
    # shellcheck disable=SC1091
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    nvm install "$NODE_MAJOR_REQUIRED"
    nvm use "$NODE_MAJOR_REQUIRED"
  elif command -v brew >/dev/null 2>&1; then
    echo "Installing Node $NODE_MAJOR_REQUIRED via Homebrew..."
    brew install node@$NODE_MAJOR_REQUIRED
    brew link --overwrite node@$NODE_MAJOR_REQUIRED || true
  else
    echo "Node $NODE_MAJOR_REQUIRED+ is required. Install nvm (https://github.com/nvm-sh/nvm) or Homebrew (https://brew.sh) and re-run." >&2
    exit 1
  fi
fi
if ! node_ok; then
  echo "Node $(node -v 2>/dev/null || echo '(none)') is still active; need $NODE_MAJOR_REQUIRED+. If you use nvm, run: nvm use" >&2
  exit 1
fi
echo "Using Node $(node -v)"

echo "Installing npm dependencies (includes the Electron runtime, ~100 MB)..."
npm ci

# npm occasionally skips Electron's binary download; fetch it explicitly so `npm run app` works.
if [ ! -f node_modules/electron/path.txt ]; then
  echo "Fetching the Electron binary..."
  node node_modules/electron/install.js
fi

echo "Installing the Playwright Chromium used by the screenshot tests..."
npx playwright install chromium

echo
echo "Done. Next:"
echo "  npm run dev        # open http://localhost:5173 in a browser"
echo "  npm run app        # run the desktop app"
echo "  npm run e2e:app    # drive the desktop app with Playwright (screenshots in test-results/shots)"
echo "  npm run dist:mac   # build release/HorseDraft-*.dmg"
echo "  npm run check      # typecheck + unit tests + build"
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  echo
  echo "nvm users: run 'nvm use' in each new shell (reads .nvmrc)."
fi
