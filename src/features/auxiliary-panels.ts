import { messageSelector } from "../adapter/messages";
import { Marks } from "./marks";
export function resolveAuxiliaryPanels(
  doc: Document = document,
): HTMLElement[] {
  const width = doc.defaultView?.innerWidth ?? 0;
  return [
    ...doc.querySelectorAll<HTMLElement>(
      'aside,[data-testid="files-and-sources"]',
    ),
  ].filter((node) => {
    if (
      node.closest("[data-nagi-owned],nav,[hidden]") ||
      node.querySelector(`#prompt-textarea,${messageSelector}`)
    )
      return false;
    const r = node.getBoundingClientRect();
    return (
      r.width >= 160 &&
      r.width <= Math.min(600, width * 0.45) &&
      r.height > 0 &&
      r.left >= width * 0.5
    );
  });
}
/** Keep the native right panel below the complete nAGI shell; never change its content. */
export class AuxiliaryPanels {
  private marks = new Marks();
  private panels = new Set<HTMLElement>();
  private unstyled = new Set<HTMLElement>();
  private style = document.createElement("style");
  constructor() {
    this.style.dataset.nagiOwned = "auxiliary-panels";
    this.style.textContent = `
[data-nagi-aux-panel]{translate:0 var(--nagi-panel-shift,0px)!important;max-height:max(80px,calc(100dvh - var(--nagi-shell-height,140px) - 24px))!important;overflow-y:auto!important;box-sizing:border-box!important;background:var(--nagi-ui-panel)!important;color:var(--nagi-ui-text)!important;border-color:var(--nagi-line)!important;font-family:var(--nagi-ui-font,monospace)!important}
[data-nagi-aux-panel] :is(button,a,summary,div,span,p){font-family:var(--nagi-ui-font,monospace)!important}
`;
    document.head.append(this.style);
  }
  private reset() {
    this.marks.clear();
    for (const node of this.panels) {
      node.style.removeProperty("--nagi-panel-shift");
      if (this.unstyled.has(node) && !node.style.length)
        node.removeAttribute("style");
    }
    this.panels.clear();
    this.unstyled.clear();
  }
  apply(enabled: boolean) {
    // Measure the native position, not the previously translated position.
    this.reset();
    if (!enabled) return;
    const shellHeight =
      parseFloat(
        document.documentElement.style.getPropertyValue("--nagi-shell-height"),
      ) || 140;
    for (const node of resolveAuxiliaryPanels()) {
      if (!node.hasAttribute("style")) this.unstyled.add(node);
      const shift = Math.max(
        0,
        shellHeight + 12 - node.getBoundingClientRect().top,
      );
      node.style.setProperty("--nagi-panel-shift", `${shift}px`);
      this.panels.add(node);
    }
    this.marks.set("data-nagi-aux-panel", this.panels);
  }
  dispose() {
    this.reset();
    this.style.remove();
  }
}
