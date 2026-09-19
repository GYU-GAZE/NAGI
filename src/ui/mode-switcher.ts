import { resolveModeControls, type ChatMode } from "../adapter/modes";
import { el, button } from "./dom";

/** User-driven proxies retain native handlers and do not infer the selected mode. */
export class ModeSwitcher {
  readonly host = el("div", undefined, "mode-switcher");
  readonly nativeSlot = el("div", undefined, "native-mode-slot");
  private chat = button("Chat normal", () => this.choose("chat"), "Chat");
  private work = button("ChatGPT Work", () => this.choose("work"), "Work");
  private fallback = button(
    "Alternar entre Chat e Work",
    () => this.revealNative(),
    "Chat / Work ▾",
  );
  constructor(
    private revealNative: () => void,
    private report: (text: string) => void,
  ) {
    this.host.setAttribute("role", "group");
    this.host.setAttribute("aria-label", "Modo do ChatGPT");
    this.host.append(this.chat, this.work, this.fallback, this.nativeSlot);
  }
  private choose(mode: ChatMode) {
    const current = resolveModeControls();
    const target = current[mode];
    if (!target || !target.isConnected) {
      this.revealNative();
      return;
    }
    if (target.matches(":disabled,[aria-disabled=true]")) {
      this.report("Este modo está indisponível no ChatGPT neste momento.");
      return;
    }
    if (current.active === mode) return;
    target.click();
    this.update(true);
  }
  setDocked(docked: boolean) {
    this.nativeSlot.hidden = !docked;
    if (docked)
      this.chat.hidden = this.work.hidden = this.fallback.hidden = true;
  }
  update(enabled: boolean) {
    this.setDocked(false);
    this.host.hidden = !enabled;
    if (!enabled) return;
    const native = resolveModeControls();
    const paired = !!native.chat && !!native.work;
    this.chat.hidden = this.work.hidden = !paired;
    this.fallback.hidden = paired;
    for (const [mode, button] of [
      ["chat", this.chat],
      ["work", this.work],
    ] as const) {
      button.setAttribute("aria-pressed", String(native.active === mode));
      button.disabled = !!native[mode]?.matches(
        ":disabled,[aria-disabled=true]",
      );
    }
    this.host.dataset.integration = paired
      ? "paired"
      : native.trigger
        ? "menu"
        : "native";
  }
}
