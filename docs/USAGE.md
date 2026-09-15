# Using HorseDraft

Everything the ultra-short README leaves out.

## What it does

Type up to 20 names, one per line (duplicates count as extra horses), give the race a name, press
Start. A field of cartoon horses runs a race that looks real (slow break, moves, lead changes, a
sprint to the line) and the finishing order is your draw. The result is a fair shuffle decided
*before* the race from a seed shown on screen; the animation only reveals it. Same names + same
seed = the same race, so a recording can be replayed and verified.

Race length is one setting (default 2 minutes, 3 s to 10 min). It only changes the pacing, never
the draw. Races over 30 s run on a track several screens long with the camera following the
leader; a race call under the sign board says who is moving and who leads.

## Keys

| Key | Action |
| --- | --- |
| `Space` / `Enter` | Start the race |
| `H` | Hide / show the setup panel |
| `F` | Fullscreen |
| `Esc` | Stop the race, back to setup |
| `R` | Race again (on the results screen) |

## Results

The results dialog lists the full order with times. *Race again* draws again with the same names,
*Remove winner & race again* drops the winner (raffles where everyone wins at most once), *Copy
results* puts the list plus the seed on the clipboard. Setup is remembered between launches.

## URL parameters

Work in the browser and in the app (handy for OBS scenes and scripts):

```
?names=Anna,Bob,Carl&title=Friday&duration=20&numbers=1&seed=42&autostart=1&countdown=0&clean=1
```

`seed` is a number or any word. `clean=1` hides the small toolbar so only the track is on screen.

## Race files

*Save race…* writes `<race-name>.horserace.json`; *Load race…* reads one back:

```json
{
  "format": "horsedraft-race",
  "version": 1,
  "title": "Friday raffle",
  "durationSec": 120,
  "showNumbers": true,
  "horses": [{ "name": "Anna", "color": "#e6194b" }, { "name": "Bob", "color": "#4363d8" }]
}
```

## Recording with OBS

See [RECORDING.md](RECORDING.md).

## Development

```bash
./scripts/bootstrap-mac.sh   # Node 22 (nvm or Homebrew), npm ci, Playwright Chromium
npm run dev                  # Vite dev server, http://localhost:5173
npm run check                # typecheck + unit tests + production build
npm run e2e                  # Playwright in a real browser, screenshots in test-results/shots
npm run e2e:app              # Playwright drives the real Electron app
npm run app                  # the desktop app
npm run dist:mac             # release/HorseDraft-<version>-arm64.dmg (unsigned: right-click → Open once)
./scripts/desktop-shortcut.sh   # shortcut to the built app on the Desktop
npm run race -- --names "Anna,Bob,Carl" --duration 10 --seed 42 --timeline   # a race in the terminal
npm run strip -- --seed 42   # a whole race as one PNG
```

Node 22 or newer is required (`nvm use` reads `.nvmrc`).

Layout: `src/core` is the pure simulation (unit-tested), `src/render` draws the scene on a canvas,
`src/ui` owns the panels and the state machine, `electron/` is the thin desktop shell (CommonJS
`.cts` files). Maintainer notes live encrypted under `ai/vault/`; `npm run vault:unlock` opens
them for whoever holds the key file.
