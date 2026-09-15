import { DURATION_PRESETS_SEC, MAX_HORSES, MIN_HORSES, clampDuration } from "../core/limits";
import { countDuplicates, parseNames } from "../core/names";
import { RaceFileError, parseRace, raceFileName, serializeRace } from "../core/raceFile";
import type { App } from "./app";
import { $, downloadText, el, toast } from "./dom";

/** Wires the static markup in index.html to the App. */
export function mountSetupPanel(app: App): { toggle: () => void; show: (visible: boolean) => void } {
  const panel = $("setup-panel");
  const title = $<HTMLInputElement>("title");
  const names = $<HTMLTextAreaElement>("names");
  const nameCount = $("name-count");
  const namesHint = $("names-hint");
  const duration = $<HTMLInputElement>("duration");
  const presets = $("duration-presets");
  const showNumbers = $<HTMLInputElement>("show-numbers");
  const horseList = $("horse-list");
  const startBtn = $<HTMLButtonElement>("start");
  const loadFile = $<HTMLInputElement>("load-file");

  for (const sec of DURATION_PRESETS_SEC) {
    const b = el("button", { type: "button", text: `${sec}s` });
    b.addEventListener("click", () => app.updateSetup({ durationSec: sec }));
    presets.append(b);
  }

  title.addEventListener("input", () => app.updateSetup({ title: title.value }));
  names.addEventListener("input", () => app.updateSetup({ namesText: names.value }));
  duration.addEventListener("change", () => app.updateSetup({ durationSec: clampDuration(Number(duration.value)) }));
  showNumbers.addEventListener("change", () => app.updateSetup({ showNumbers: showNumbers.checked }));
  $("randomize-colors").addEventListener("click", () => app.randomizeAllColors());
  $("shuffle-names").addEventListener("click", () => app.shuffleNames());
  startBtn.addEventListener("click", () => {
    if (app.canStart()) app.start();
  });

  $("save-race").addEventListener("click", () => {
    const config = app.config();
    downloadText(raceFileName(config.title), serializeRace(config));
    toast("Race file saved");
  });
  $("load-race").addEventListener("click", () => loadFile.click());
  loadFile.addEventListener("change", async () => {
    const file = loadFile.files?.[0];
    loadFile.value = "";
    if (!file) return;
    try {
      app.applyConfig(parseRace(await file.text()));
      toast(`Loaded "${file.name}"`);
    } catch (err) {
      toast(err instanceof RaceFileError ? err.message : "Could not read that file");
    }
  });

  const render = (): void => {
    const s = app.setup;
    if (document.activeElement !== title) title.value = s.title;
    if (document.activeElement !== names) names.value = s.namesText;
    duration.value = String(s.durationSec);
    showNumbers.checked = s.showNumbers;
    for (const b of presets.querySelectorAll("button")) {
      b.setAttribute("aria-pressed", b.textContent === `${s.durationSec}s` ? "true" : "false");
    }

    const parsed = parseNames(s.namesText);
    const n = parsed.names.length;
    nameCount.textContent = `${n} / ${MAX_HORSES}`;
    const hints: string[] = [];
    if (parsed.overflow.length > 0) hints.push(`Only the first ${MAX_HORSES} names race; ${parsed.overflow.length} ignored.`);
    const dupes = countDuplicates(parsed.names);
    if (dupes > 0) hints.push(`${dupes} duplicate name${dupes > 1 ? "s" : ""}: they get extra horses (extra chances).`);
    if (n > 0 && n < MIN_HORSES) hints.push(`Need at least ${MIN_HORSES} names.`);
    namesHint.textContent = hints.join(" ");
    namesHint.hidden = hints.length === 0;
    namesHint.classList.toggle("warn", parsed.overflow.length > 0);

    startBtn.disabled = !app.canStart();
    startBtn.textContent = n >= MIN_HORSES ? `▶ Start race (${n} horses)` : "▶ Start race";

    horseList.replaceChildren(
      ...app.horses().map((h, i) => {
        const color = el("input", { type: "color", value: h.color, title: "Pick a colour" });
        color.addEventListener("input", () => app.setColor(i, color.value));
        const dice = el("button", { type: "button", className: "dice", text: "🎲", title: "Random colour" });
        dice.addEventListener("click", () => app.randomizeColor(i));
        return el("div", { className: "horse-row" }, [
          el("span", { className: "num", text: `${i + 1}.` }),
          color,
          el("span", { className: "name", text: h.name }),
          dice,
        ]);
      }),
    );
  };

  app.on("setup", render);
  render();

  const show = (visible: boolean): void => {
    panel.hidden = !visible;
  };
  app.on("phase", (phase) => {
    if (phase === "countdown" || phase === "racing") show(false);
    if (phase === "setup") show(true);
  });

  return { toggle: () => show(panel.hidden), show };
}
