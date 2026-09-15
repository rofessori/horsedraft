# Changelog

## 0.1.0 – 2026-09-15

First version.

- Race up to 20 named horses; fair pre-drawn finishing order with an animated race that reveals it
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
