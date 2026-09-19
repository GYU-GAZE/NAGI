import { resolveHeader, headerControls, headerAction } from "../adapter/header";
import { Marks } from "./marks";
/** Dock live controls without reparenting them or synthesizing native input events. */
export class ContextHeaderBridge {
  private marks = new Marks();
  private controls = new Map<HTMLElement, number>();
  private style = document.createElement("style");
  private initiallyUnstyled = new Set<HTMLElement>();
  private restore(node: HTMLElement) {
    for (const key of ["x", "y", "w"])
      node.style.removeProperty(`--nagi-dock-${key}`);
    if (this.initiallyUnstyled.has(node) && !node.style.length)
      node.removeAttribute("style");
    this.initiallyUnstyled.delete(node);
  }
  constructor() {
    this.style.dataset.nagiOwned = "context-header";
    this.style.textContent = `
[data-nagi-context-header]{visibility:hidden!important;pointer-events:none!important;position:relative!important;top:auto!important;transform:none!important;height:var(--nagi-shell-height,140px)!important;min-height:var(--nagi-shell-height,140px)!important;max-height:none!important;margin:0!important;padding:0!important;flex-shrink:0!important;border:0!important;box-shadow:none!important;background:none!important;overflow:visible!important;z-index:41!important}
[data-nagi-docked]{visibility:visible!important;pointer-events:auto!important;position:fixed!important;inset:auto!important;left:var(--nagi-dock-x)!important;top:var(--nagi-dock-y)!important;width:var(--nagi-dock-w)!important;min-width:0!important;max-width:none!important;height:34px!important;min-height:34px!important;transform:none!important;margin:0!important;padding:5px 8px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;box-sizing:border-box!important;border:1px solid var(--nagi-line)!important;border-radius:5px!important;background:var(--nagi-ui-panel)!important;color:var(--nagi-ui-text)!important;box-shadow:none!important;font:12px/1.3 var(--nagi-ui-font,monospace)!important;white-space:nowrap!important;overflow:hidden!important;z-index:42!important;cursor:pointer}
[data-nagi-docked]:hover{border-color:var(--nagi-accent)!important;background:color-mix(in srgb,var(--nagi-accent) 12%,var(--nagi-ui-panel))!important}
[data-nagi-docked]:focus-visible{outline:2px solid var(--nagi-accent)!important;outline-offset:2px!important}
[data-nagi-context-header] [role=menu],[data-nagi-context-header] [role=dialog],[data-nagi-context-header] [role=listbox],[data-nagi-context-header] [role=tooltip],[data-nagi-context-header] [data-radix-popper-content-wrapper]{visibility:visible!important;pointer-events:auto!important}
`;
    document.head.append(this.style);
  }
  refresh(slot: HTMLElement, enabled: boolean) {
    const header = enabled ? resolveHeader() : null;
    const candidates = headerControls(header).filter(
      (e) => e.matches("button,[role=button]") || headerAction(e) !== null,
    );
    const next = new Set(candidates);
    for (const node of this.controls.keys())
      if (!next.has(node)) {
        this.restore(node);
        this.controls.delete(node);
      }
    for (const node of candidates)
      if (!this.controls.has(node)) {
        if (!node.hasAttribute("style")) this.initiallyUnstyled.add(node);
        this.controls.set(
          node,
          Math.min(
            124,
            Math.max(
              headerAction(node) === "share" ? 76 : 34,
              node.getBoundingClientRect().width || 34,
            ),
          ),
        );
      }
    const gap = 6;
    const width =
      [...this.controls.values()].reduce((n, w) => n + w, 0) +
      Math.max(0, this.controls.size - 1) * gap;
    const available = Math.min(width, Math.max(200, window.innerWidth - 32));
    slot.style.width = `${available}px`;
    slot.hidden = !width;
    let rowWidth = 0,
      rows = 1;
    for (const w of this.controls.values()) {
      if (rowWidth && rowWidth + w > available) {
        rows++;
        rowWidth = 0;
      }
      rowWidth += w + gap;
    }
    slot.style.height = `${34 + (rows - 1) * 40}px`;
    const rect = slot.getBoundingClientRect();
    let x = 0,
      y = 0;
    for (const [node, w] of this.controls) {
      if (x && x + w > available) {
        x = 0;
        y += 40;
      }
      node.style.setProperty("--nagi-dock-x", `${rect.left + x}px`);
      node.style.setProperty("--nagi-dock-y", `${rect.top + y}px`);
      node.style.setProperty("--nagi-dock-w", `${w}px`);
      x += w + gap;
    }
    this.marks.set("data-nagi-context-header", header ? [header] : []);
    this.marks.set("data-nagi-docked", this.controls.keys());
    document.documentElement.toggleAttribute(
      "data-nagi-shell-reserve",
      enabled && !header,
    );
    return { header: !!header, controls: this.controls.size };
  }
  dispose() {
    this.marks.clear();
    for (const node of this.controls.keys()) this.restore(node);
    this.controls.clear();
    document.documentElement.removeAttribute("data-nagi-shell-reserve");
    this.style.remove();
  }
}
