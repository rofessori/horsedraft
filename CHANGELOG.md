# Changelog

## 0.1.0 – 2026-09-15

First version.

- Race up to 20 named horses; fair pre-drawn finishing order with an animated race that reveals it
- Realistic pacing: standing start with a gate break, running styles (frontrunner / stalker /
  closer) with a pace-setter and late kicks, slow drift plus surges and lulls so gaps open and
  close, a finish spread that grows with the race length; gallop cadence tied to time so long
  races do not look like slow motion; the sign-board clock runs up and stops on the winner's time
- Default race length 60 s with presets 30 s to 3 min (the length only changes the pacing)
- Random coat colours, per-horse colour picker, random-all and shuffle-lanes
- Race name on the sign board, countdown clock, 3-2-1 countdown, winner banner, place badges,
  results dialog with copy-to-clipboard
- Race again / remove winner & race again / back to setup
- Save and load `.horserace.json` files; setup remembered between launches
- URL parameters for scripted starts (`names`, `title`, `duration`, `seed`, `autostart`,
  `countdown`, `numbers`, `clean`)
- Keyboard: Space, H, F, Esc, R
- Electron shell for macOS (`npm run app`, `npm run dist:mac`)
- Terminal race runner (`npm run race`)
- Unit tests for the simulation, Playwright end-to-end tests with screenshots, CI
- Playwright test that drives the real Electron app (`npm run e2e:app`); the shell is compiled to
  `.cjs` so it loads correctly under the package's `"type": "module"`
- `HORSEDRAFT_USER_DATA` (separate profile directory) and `HORSEDRAFT_INACTIVE=1` (open the window
  without taking keyboard focus) environment variables for automation
