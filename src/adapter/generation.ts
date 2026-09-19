import type { Phase } from "../shared/model";
export interface Signal {
  stop: boolean;
  ready: boolean;
  answerChanged: boolean;
}
/** Hysteresis is about visible UI, never proof of a server-side generation state. */
export class GenerationTracker {
  phase: Phase = "unknown";
  private lastTextAt = -Infinity;
  private missingSince: number | null = null;
  update(signal: Signal, now: number): Phase {
    if (signal.stop) {
      this.missingSince = null;
      if (signal.answerChanged) this.lastTextAt = now;
      this.phase = now - this.lastTextAt < 1000 ? "talking" : "thinking";
    } else if (!signal.ready) {
      this.phase = "unknown";
      this.missingSince = null;
    } else if (this.phase === "thinking" || this.phase === "talking") {
      this.missingSince ??= now;
      if (now - this.missingSince >= 1200) {
        this.phase = "idle";
        this.lastTextAt = -Infinity;
      }
    } else this.phase = "idle";
    return this.phase;
  }
  reset() {
    this.phase = "unknown";
    this.lastTextAt = -Infinity;
    this.missingSince = null;
  }
}
