# Changelog

## 0.1.0 – 2026-09-15

First version.

- Race up to 20 named horses; fair pre-drawn finishing order with an animated race that reveals it
- Realistic pacing: standing start with a gate break, running styles (frontrunner / stalker /
  closer) with a pace-setter and late kicks, slow drift plus a surge or lull every ~15 s so gaps
  open and close, a finish spread that grows with the race length; gallop cadence tied to time
  so long races do not look like slow motion; the sign-board clock runs up and stops on the
  winner's time
- Long races (over ~30 s) run on a track up to five screens long with the camera travelling
  with the leader; quarter-poles, fence posts and the ground scroll past. Short races keep the
  fixed full-track view
- Race call under the sign board: "And they're off!", lead changes, moves, the final stretch,
  photo finishes
- Default race length 2 minutes with presets 1 to 5 min (the length only changes the pacing)
- `npm run strip`: capture a whole race as one contact-sheet PNG (`docs/race-strip.png`)
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
