# Recording a race with OBS

HorseDraft is an ordinary window, so OBS Studio can capture it like any app.

## One-time setup

1. Open HorseDraft (`npm run app`, or the `.app` from `npm run dist:mac`).
2. Resize the window to the shape of your recording. 16:9 is ideal: the stage is drawn at
   1080 logical pixels tall and stretches sideways to fill whatever width it gets, so a
   1920×1080 window has no black bars. Fullscreen (`F`) also works.
3. In OBS: **Sources → + → macOS Screen Capture**, method *Window Capture*, pick **HorseDraft**.
   Grant Screen Recording permission if macOS asks (System Settings → Privacy & Security →
   Screen Recording).
4. Optional: right-click the source → *Transform → Fit to screen*.

## Each race

1. Type the names, give the race a name (it is painted on the sign board, so the recording
   explains itself), pick a race length.
2. Press `H` to hide the setup panel. The little toolbar disappears on its own while the race runs.
3. Start recording in OBS.
4. Press `Space`. Countdown, race, winner banner, results list.
5. Stop recording. The results dialog can stay on screen as the final frame, or press `Esc`.

## Tips

- The seed is printed under the sign board. Anyone can replay that exact race with
  `?seed=<number>` and the same names, so a recording is verifiable.
- For a fully bare screen (no toolbar even before the race) launch with `?clean=1`, e.g. in the
  browser: `http://localhost:5173/?clean=1&autostart=1`.
- Longer races (60 s and up) leave time for commentary; the lead changes are spread over the
  whole race, not just the end. Over about 30 s the camera travels with the field and the race
  call under the board names movers and lead changes, so a recording narrates itself.
- "Remove winner & race again" runs the next round immediately with the winner removed, which is
  what you want for a multi-prize raffle. Record it as one long take or one file per round.
