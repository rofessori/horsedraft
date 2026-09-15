import type { App, RaceOutcome } from "./app";
import { formatClock, ordinal } from "../render/text";
import { $, el, toast } from "./dom";

export function formatResultsText(outcome: RaceOutcome): string {
  const lines = [outcome.config.title.trim() || "HorseDraft race", `seed ${outcome.plan.seed}`, ""];
  for (const r of outcome.results) {
    const horse = outcome.config.horses[r.horse];
    lines.push(`${ordinal(r.place).padStart(4)}  ${horse?.name ?? "?"}`);
  }
  return lines.join("\n");
}

export function mountResultsPanel(app: App): void {
  const modal = $("results");
  const list = $("results-list");
  const winnerLine = $("winner-line");
  const heading = $("results-title");
  let current: RaceOutcome | undefined;

  const hide = (): void => {
    modal.hidden = true;
  };

  app.on("finished", (outcome) => {
    current = outcome;
    heading.textContent = outcome.config.title.trim() ? `${outcome.config.title} – results` : "Results";
    const winner = outcome.config.horses[outcome.results[0]?.horse ?? 0];
    winnerLine.textContent = winner ? `🏆 ${winner.name} wins!` : "";
    list.replaceChildren(
      ...outcome.results.map((r) => {
        const horse = outcome.config.horses[r.horse];
        const li = el("li", { className: `place-${r.place}` }, [
          el("span", { className: "place", text: ordinal(r.place) }),
          el("span", { className: "swatch" }),
          el("span", { className: "name", text: horse?.name ?? "?" }),
          el("span", { className: "time", text: formatClock(r.timeSec) }),
        ]);
        (li.querySelector(".swatch") as HTMLElement).style.background = horse?.color ?? "#fff";
        return li;
      }),
    );
    modal.hidden = false;
    $("again").focus();
  });

  app.on("phase", (phase) => {
    if (phase !== "finished") hide();
  });

  $("again").addEventListener("click", () => {
    hide();
    app.raceAgain();
  });
  $("remove-winner").addEventListener("click", () => {
    hide();
    if (!app.removeWinnerAndRaceAgain()) toast("Not enough names left for another race");
  });
  $("back").addEventListener("click", () => {
    hide();
    app.stop();
  });
  $("copy-results").addEventListener("click", async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(formatResultsText(current));
      toast("Results copied");
    } catch {
      toast("Clipboard not available");
    }
  });
}
