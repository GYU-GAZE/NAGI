import { fixedCoordinates } from "./context-header";
import { Marks } from "./marks";
export interface NavigationDockTarget {
  node: HTMLElement;
  sidebar: HTMLElement;
  slot: HTMLElement;
  kind: "row" | "control";
}
/** Render original sidebar controls in nAGI slots without moving or cloning React nodes. */
export class NavigationDock {
  private marks = new Marks();
  private targets: NavigationDockTarget[] = [];
  private style = document.createElement("style");
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pristine = new Set<HTMLElement>();
  private frame: HTMLIFrameElement | null = null;
  private schedule = () => {
    if (!this.timer)
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.position();
      }, 16);
  };
  constructor() {
    this.style.dataset.nagiOwned = "navigation-dock";
    this.style.textContent = `
html body [data-nagi-nav-path]{display:block!important;visibility:hidden!important;pointer-events:none!important;position:static!important;width:100%!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;clip-path:none!important;contain:none!important;content-visibility:visible!important;transform:none!important;filter:none!important;perspective:none!important;margin:0!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;opacity:1!important}
html body [data-nagi-nav-root]{position:fixed!important;inset:0 auto auto 0!important;width:280px!important;height:100vh!important;z-index:2147483603!important}
html body [data-nagi-nav-path] > :not([data-nagi-nav-path]):not([data-nagi-nav-target]):not([role=menu]):not([role=dialog]):not([data-radix-popper-content-wrapper]){visibility:hidden!important;pointer-events:none!important}
html body [data-nagi-nav-target]{display:flex!important;align-items:center!important;box-sizing:border-box!important;visibility:visible!important;pointer-events:auto!important;position:fixed!important;inset:auto!important;left:var(--nagi-nav-x)!important;top:var(--nagi-nav-y)!important;width:var(--nagi-nav-w)!important;max-width:none!important;min-width:0!important;height:var(--nagi-nav-h)!important;min-height:0!important;margin:0!important;transform:none!important;opacity:1!important;z-index:2147483604!important;background:var(--nagi-ui-panel,#061c2b)!important;color:var(--nagi-ui-text,#d8e7ff)!important;border:1px solid var(--nagi-line,#25465c)!important;border-radius:6px!important;font:13px/1.4 var(--nagi-ui-font,monospace)!important}
html body [data-nagi-nav-target] *{visibility:visible!important;pointer-events:auto!important}
html body [data-nagi-nav-target=row]{padding:6px 10px!important;gap:8px!important}
html body [data-nagi-nav-target=row] a{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html body [data-nagi-nav-target=row] :is(button,[role=button]){opacity:1!important;flex-shrink:0}
html body [data-nagi-nav-target=control]{justify-content:center!important;padding:6px!important;overflow:hidden!important}
html body [data-nagi-nav-clipped]{visibility:hidden!important;pointer-events:none!important}
html body [data-nagi-nav-clipped] *{visibility:hidden!important;pointer-events:none!important}
html[data-nagi-nav-active] body :is([role=menu],[role=dialog],[role=alertdialog],[role=listbox],[data-radix-popper-content-wrapper]):not(:where([hidden],[hidden] *,[data-state=closed],[data-state=closed] *)){z-index:2147483640!important;visibility:visible!important;pointer-events:auto!important}
`;
    document.head.append(this.style);
    window.addEventListener("scroll", this.schedule, true);
    window.addEventListener("resize", this.schedule);
  }
  watchFrame(frame: HTMLIFrameElement) {
    this.frame = frame;
    frame.contentDocument?.addEventListener("scroll", this.schedule, true);
  }
  private restore(node: HTMLElement) {
    for (const key of ["x", "y", "w", "h"])
      node.style.removeProperty(`--nagi-nav-${key}`);
    node.removeAttribute("data-nagi-nav-target");
    node.removeAttribute("data-nagi-nav-clipped");
    if (this.pristine.has(node) && !node.style.length)
      node.removeAttribute("style");
    this.pristine.delete(node);
  }
  refresh(targets: NavigationDockTarget[]) {
    targets = targets.filter(
      (t) =>
        t.node.isConnected && t.slot.isConnected && t.sidebar.contains(t.node),
    );
    for (const old of this.targets)
      if (!targets.some((t) => t.node === old.node)) this.restore(old.node);
    this.targets = targets;
    const paths = new Set<HTMLElement>();
    for (const t of targets) {
      if (!t.node.hasAttribute("style")) this.pristine.add(t.node);
      if (t.sidebar.getAttribute("data-nagi-sidebar") === "hidden") {
        for (let p = t.node.parentElement; p; p = p.parentElement) {
          paths.add(p);
          if (p === t.sidebar) break;
        }
      }
      t.node.setAttribute("data-nagi-nav-target", t.kind);
    }
    this.marks.set("data-nagi-nav-path", paths);
    this.marks.set(
      "data-nagi-nav-root",
      new Set(targets.map((t) => t.sidebar).filter((n) => paths.has(n))),
    );
    document.documentElement.toggleAttribute(
      "data-nagi-nav-active",
      targets.length > 0,
    );
    this.position();
  }
  position() {
    for (const { node, slot } of this.targets) {
      const r = slot.getBoundingClientRect();
      const frame = slot.ownerDocument.defaultView
        ?.frameElement as HTMLIFrameElement | null;
      const fr = frame?.getBoundingClientRect();
      const sx = frame?.offsetWidth ? fr!.width / frame.offsetWidth : 1;
      const sy = frame?.offsetHeight ? fr!.height / frame.offsetHeight : 1;
      const x = (fr?.left ?? 0) + ((frame?.clientLeft ?? 0) + r.left) * sx;
      const y = (fr?.top ?? 0) + ((frame?.clientTop ?? 0) + r.top) * sy;
      const point = fixedCoordinates(node, x, y);
      node.style.setProperty("--nagi-nav-x", `${point.x}px`);
      node.style.setProperty("--nagi-nav-y", `${point.y}px`);
      node.style.setProperty("--nagi-nav-w", `${r.width * sx}px`);
      node.style.setProperty("--nagi-nav-h", `${r.height * sy}px`);
      let clipped =
        !slot.isConnected || r.width === 0 || r.height === 0 || !!frame?.hidden;
      const body = slot.closest<HTMLElement>(".body");
      if (body) {
        const b = body.getBoundingClientRect();
        clipped ||= r.top < b.top || r.bottom > b.bottom;
      }
      // Toolbar slots can scroll horizontally on narrower windows.
      const bar = slot.closest<HTMLElement>("nav");
      if (bar) {
        const b = bar.getBoundingClientRect();
        clipped ||= r.left < b.left || r.right > b.right;
      }
      node.toggleAttribute("data-nagi-nav-clipped", clipped);
    }
  }
  dispose() {
    window.removeEventListener("scroll", this.schedule, true);
    window.removeEventListener("resize", this.schedule);
    this.frame?.contentDocument?.removeEventListener(
      "scroll",
      this.schedule,
      true,
    );
    clearTimeout(this.timer);
    this.refresh([]);
    this.style.remove();
  }
}
