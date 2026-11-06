import type { Settings } from "../shared/model";
import { resolveHeader } from "../adapter/header";

/** Replace the header's presentation, retaining native nodes and real popover anchors. */
export class HeaderIntegration {
  private style = document.createElement("style");
  private marks = new Map<string, Set<HTMLElement>>();
  constructor() {
    this.style.dataset.nagiOwned = "header-style";
    this.style.textContent = `
html[data-nagi-header-active]{--nagi-header-bg:#151e2d;--nagi-header-text:#dce4f1;--nagi-header-font:system-ui,sans-serif;--nagi-tools-top:8px;--nagi-header-height:60px}
html[data-nagi-header-active][data-nagi-theme]{--nagi-header-bg:var(--nagi-composer-bg);--nagi-header-text:var(--nagi-text);--nagi-header-font:var(--nagi-font)}
#nagi-root[data-nagi-header-shell]{top:var(--nagi-tools-top)!important;left:var(--nagi-tools-left,50%)!important;z-index:40!important}
[data-nagi-header]{box-sizing:border-box!important;position:sticky!important;top:0!important;z-index:30!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;flex-shrink:0!important;height:var(--nagi-header-height)!important;min-height:var(--nagi-header-height)!important;max-height:none!important;width:100%!important;max-width:none!important;margin:0!important;padding:8px 16px!important;background:var(--nagi-header-bg)!important;color:var(--nagi-header-text)!important;border:0!important;border-radius:0!important;box-shadow:none!important;backdrop-filter:none!important;font:13px/1.45 var(--nagi-header-font)!important;overflow:visible!important}
[data-nagi-header-layer]{background:transparent!important;background-image:none!important;box-shadow:none!important;border:0!important;border-radius:0!important;color:inherit!important;font-family:inherit!important}
[data-nagi-header]::before,[data-nagi-header]::after,[data-nagi-header-layer]::before,[data-nagi-header-layer]::after{background:none!important;box-shadow:none!important;border:0!important;pointer-events:none!important}
[data-nagi-header-layout]{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;width:100%!important;min-width:0!important}
[data-nagi-header-part]{flex:0 1 auto!important;min-width:0!important;max-width:max(100px,calc((var(--nagi-header-slot-width,100vw) - var(--nagi-tools-width,500px))/2 - 36px))!important}
[data-nagi-header-part]:first-child{margin-inline-end:auto!important}
[data-nagi-header-part] [class*="truncate"]{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
[data-nagi-header-control]{box-sizing:border-box!important;background:transparent!important;color:var(--nagi-header-text)!important;border:0!important;border-radius:7px!important;box-shadow:none!important;font:inherit!important;min-height:32px!important;padding:6px 8px!important;cursor:pointer}
[data-nagi-header-control]:hover{background:color-mix(in srgb,var(--nagi-header-text) 12%,transparent)!important}
[data-nagi-header-control]:focus-visible{outline:2px solid var(--nagi-header-text)!important;outline-offset:2px!important}
[data-nagi-header-control]:disabled{opacity:.45!important}
html[data-nagi-header-stacked]{--nagi-tools-top:60px;--nagi-header-height:112px}
html[data-nagi-header-stacked] [data-nagi-header]{align-items:flex-start!important}
html[data-nagi-header-stacked] [data-nagi-header-layout]{align-items:center!important}
html[data-nagi-header-stacked] [data-nagi-header-part]{max-width:65vw!important}
`;
    document.head.append(this.style);
  }
  private mark(name: string, nodes: HTMLElement[]) {
    const old = this.marks.get(name) ?? new Set<HTMLElement>();
    const next = new Set(nodes);
    for (const node of old) if (!next.has(node)) node.removeAttribute(name);
    for (const node of next)
      if (!node.hasAttribute(name)) node.setAttribute(name, "");
    this.marks.set(name, next);
  }
  refresh(settings: Settings, toolbarWidth: number): boolean {
    const header =
      settings.enabled && settings.navigation === "topbar"
        ? resolveHeader()
        : null;
    const root = document.documentElement;
    root.toggleAttribute("data-nagi-header-active", !!header);
    // Use two rows when the real header slot (including an open sidebar) is narrow.
    const width = header?.getBoundingClientRect().width || window.innerWidth;
    root.toggleAttribute(
      "data-nagi-header-stacked",
      !!header && width < Math.max(1100, toolbarWidth + 560),
    );
    root.style.setProperty("--nagi-header-slot-width", `${width}px`);
    const rect = header?.getBoundingClientRect();
    root.style.setProperty(
      "--nagi-tools-left",
      rect?.width ? `${rect.left + rect.width / 2}px` : "50%",
    );
    root.style.setProperty("--nagi-tools-width", `${toolbarWidth || 500}px`);
    this.mark("data-nagi-header", header ? [header] : []);
    const layers: HTMLElement[] = [];
    const controls: HTMLElement[] = [];
    if (header) {
      for (const child of header.querySelectorAll<HTMLElement>(
        "div,section,button,a,[role=button]",
      )) {
        if (
          child.closest(
            "[role=menu],[role=dialog],[role=tooltip],[role=listbox],[data-radix-popper-content-wrapper],[popover],[data-nagi-owned]",
          )
        )
          continue;
        if (child.matches("button,a,[role=button]")) controls.push(child);
        else if (!child.closest("button,a,[role=button]")) layers.push(child);
      }
    }
    this.mark("data-nagi-header-layer", layers);
    this.mark("data-nagi-header-control", controls);
    const layouts: HTMLElement[] = [];
    let row = header;
    // Peel single-child layout wrappers without reparenting React-managed nodes.
    while (
      row?.children.length === 1 &&
      row.firstElementChild?.matches("div,section")
    ) {
      row = row.firstElementChild as HTMLElement;
      layouts.push(row);
    }
    this.mark("data-nagi-header-layout", layouts);
    this.mark(
      "data-nagi-header-part",
      row
        ? ([...row.children].filter(
            (e) =>
              !e.matches(
                "style,script,[role=menu],[role=dialog],[role=listbox],[role=tooltip],[data-radix-popper-content-wrapper],[popover]",
              ),
          ) as HTMLElement[])
        : [],
    );
    return !!header;
  }
  dispose() {
    for (const [name, nodes] of this.marks)
      for (const node of nodes) node.removeAttribute(name);
    this.marks.clear();
    this.style.remove();
    document.documentElement.removeAttribute("data-nagi-header-active");
    document.documentElement.removeAttribute("data-nagi-header-stacked");
    document.documentElement.style.removeProperty("--nagi-tools-width");
    document.documentElement.style.removeProperty("--nagi-tools-left");
    document.documentElement.style.removeProperty("--nagi-header-slot-width");
  }
}
