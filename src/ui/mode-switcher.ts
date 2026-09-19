import {
  resolveModeControls,
  isModeSelectionPage,
  type ChatMode,
} from "../adapter/modes";
import { el, button } from "./dom";

/** User-driven proxies retain native handlers and do not infer the selected mode. */
export class ModeSwitcher {
  readonly host = el("div", undefined, "mode-switcher");
  readonly nativeSlot = el("div", undefined, "native-mode-slot");
  private chat = button("Chat normal", () => this.choose("chat"), "Chat");
  private work = button("ChatGPT Work", () => this.choose("work"), "Work");
  private enabled = false;
  constructor(private report: (text: string) => void) {
    this.host.setAttribute("role", "group");
    this.host.setAttribute("aria-label", "Modo do ChatGPT");
    this.host.append(this.chat, this.work, this.nativeSlot);
  }
  private choose(mode: ChatMode) {
    if (!this.enabled || !isModeSelectionPage()) {
      this.update(false);
      return;
    }
    const current = resolveModeControls();
    const target = current[mode];
    if (!target || !target.isConnected) {
      this.update(true);
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
    const eligible = this.enabled && isModeSelectionPage();
    this.nativeSlot.hidden = !eligible || !docked;
    if (docked) this.chat.hidden = this.work.hidden = true;
    this.host.hidden =
      !eligible || (!docked && this.chat.hidden && this.work.hidden);
  }
  update(enabled: boolean) {
    this.enabled = enabled && isModeSelectionPage();
    this.nativeSlot.hidden = true;
    const native = this.enabled ? resolveModeControls() : null;
    const paired = !!native?.chat && !!native?.work;
    this.chat.hidden = this.work.hidden = !paired;
    this.host.hidden = !this.enabled || (!paired && !native?.trigger);
    for (const [mode, button] of [
      ["chat", this.chat],
      ["work", this.work],
    ] as const) {
      button.setAttribute("aria-pressed", String(native?.active === mode));
      button.disabled =
        !native?.[mode] ||
        native[mode]!.matches(":disabled,[aria-disabled=true]");
    }
    this.host.dataset.integration = paired
      ? "paired"
      : native?.trigger
        ? "menu"
        : "unavailable";
  }
}
