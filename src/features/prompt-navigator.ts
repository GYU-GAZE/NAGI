import { Marks } from "./marks";
import { resolveMessages } from "../adapter/messages";
import { el, button } from "../ui/dom";
export class PromptNavigator {
  readonly host = el("div", undefined, "prompt-nav");
  private previous = button("Prompt anterior", () => this.step(-1), "↑");
  private next = button("Próximo prompt", () => this.step(1), "↓");
  private counter = button("Escolher prompt", () => this.openList());
  private prompts: HTMLElement[] = [];
  private active = -1;
  private marks = new Marks();
  private style = document.createElement("style");
  private route = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private reduced = false;
  private onScroll = () => {
    if (!this.timer)
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.sync();
      }, 80);
  };
  constructor(private openList: () => void) {
    this.style.dataset.nagiOwned = "prompt-navigation";
    this.style.textContent =
      "[data-nagi-prompt-target]{scroll-margin-top:calc(var(--nagi-shell-height,140px) + 20px)!important}";
    document.head.append(this.style);
    this.host.setAttribute("role", "navigation");
    this.host.setAttribute("aria-label", "Prompts enviados");
    this.host.append(this.previous, this.counter, this.next);
    window.addEventListener("scroll", this.onScroll, {
      capture: true,
      passive: true,
    });
  }
  update(enabled: boolean, reduced: boolean) {
    this.host.hidden = !enabled;
    this.reduced = reduced;
    const route = location.pathname;
    if (route !== this.route) {
      this.active = -1;
      this.route = route;
    }
    this.prompts = enabled
      ? resolveMessages()
          .filter((r) => r.role === "user")
          .map((r) => r.node)
      : [];
    this.marks.set("data-nagi-prompt-target", this.prompts);
    this.sync();
  }
  private sync() {
    const offset =
      parseFloat(
        document.documentElement.style.getPropertyValue("--nagi-shell-height"),
      ) || 140;
    let active = -1;
    for (let i = 0; i < this.prompts.length; i++) {
      const r = this.prompts[i].getBoundingClientRect();
      if (r.top <= offset + 32) active = i;
      else break;
    }
    this.active = active;
    const label = this.prompts.length
      ? `Prompt ${active < 0 ? "—" : active + 1} / ${this.prompts.length}`
      : "Sem prompts detectados";
    if (this.counter.textContent !== label) this.counter.textContent = label;
    this.counter.disabled = !this.prompts.length;
    this.previous.disabled = active <= 0;
    this.next.disabled =
      !this.prompts.length || active >= this.prompts.length - 1;
  }
  private step(direction: number) {
    this.go(
      Math.max(0, Math.min(this.prompts.length - 1, this.active + direction)),
    );
  }
  go(index: number) {
    const node = this.prompts[index];
    if (!node?.isConnected) return;
    node.closest("[data-nagi-contain]")?.removeAttribute("data-nagi-contain");
    node.scrollIntoView({
      behavior: this.reduced ? "auto" : "smooth",
      block: "start",
    });
    this.active = index;
  }
  renderList(container: HTMLElement, close: () => void) {
    container.append(el("p", "Prompts já carregados nesta conversa.", "note"));
    const list = el("div", undefined, "list");
    this.prompts.forEach((node, index) => {
      // This preview exists only in the local panel, never in storage or diagnostics.
      const preview =
        node.textContent?.trim().replace(/\s+/g, " ").slice(0, 120) ||
        "Prompt com anexo";
      list.append(
        button(`${String(index + 1).padStart(2, "0")} · ${preview}`, () => {
          close();
          this.go(index);
        }),
      );
    });
    container.append(list);
  }
  dispose() {
    window.removeEventListener("scroll", this.onScroll, true);
    clearTimeout(this.timer);
    this.marks.clear();
    this.style.remove();
    this.prompts = [];
    this.host.remove();
  }
}
