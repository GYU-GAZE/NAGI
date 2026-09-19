import type { Settings } from "../shared/model";
export class TurnOptimizer {
  private marked = new Set<HTMLElement>();
  private style = document.createElement("style");
  metrics = {
    supported: CSS.supports("content-visibility", "auto"),
    eligible: 0,
    total: 0,
    updateMs: 0,
  };
  constructor() {
    this.style.dataset.nagiOwned = "performance";
    this.style.textContent =
      "[data-nagi-contain] {content-visibility:auto;contain-intrinsic-size:auto 600px}";
    document.head.append(this.style);
  }
  apply(s: Settings, turns: HTMLElement[]) {
    const start = performance.now();
    const eligible =
      s.enabled && s.performance && this.metrics.supported
        ? turns.slice(0, Math.max(0, turns.length - s.keepTurns))
        : [];
    const next = new Set(
      eligible.filter(
        (el) =>
          !el.contains(document.activeElement) &&
          !el.querySelector(
            'iframe,video,audio,canvas,[contenteditable="true"]',
          ),
      ),
    );
    for (const el of this.marked)
      if (!next.has(el)) el.removeAttribute("data-nagi-contain");
    for (const el of next)
      if (!this.marked.has(el)) el.setAttribute("data-nagi-contain", "");
    this.marked = next;
    this.metrics = {
      supported: this.metrics.supported,
      eligible: next.size,
      total: turns.length,
      updateMs: performance.now() - start,
    };
  }
  dispose() {
    for (const el of this.marked) el.removeAttribute("data-nagi-contain");
    this.marked.clear();
    this.style.remove();
  }
}
