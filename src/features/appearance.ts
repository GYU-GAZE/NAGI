import type { Settings } from "../shared/model";
import { resolveRegions } from "../adapter/regions";

const tokenCSS = `
--main-surface-primary:var(--nagi-background);--main-surface-secondary:var(--nagi-composer-bg);--main-surface-tertiary:var(--nagi-composer-bg);
--sidebar-surface-primary:var(--nagi-background);--sidebar-surface-secondary:var(--nagi-composer-bg);
--bg-primary:var(--nagi-background);--bg-secondary:var(--nagi-composer-bg);--bg-tertiary:var(--nagi-code-bg);
--bg-elevated-primary:var(--nagi-composer-bg);--bg-elevated-secondary:var(--nagi-code-bg);--message-surface:var(--nagi-composer-bg);
--text-primary:var(--nagi-text);--text-secondary:var(--nagi-text);--text-tertiary:var(--nagi-text);
--border-light:color-mix(in srgb,var(--nagi-text) 15%,transparent);--border-medium:color-mix(in srgb,var(--nagi-text) 25%,transparent);
--border-heavy:color-mix(in srgb,var(--nagi-text) 35%,transparent);--border-default:var(--border-light);--border-muted:var(--border-light);
`;
export class Appearance {
  private style = document.createElement("style");
  private marks = new Map<string, Set<HTMLElement>>();
  constructor() {
    this.style.dataset.nagiOwned = "appearance";
    this.style.textContent = `
[data-nagi-sidebar="hidden"]{display:none!important;width:0!important;min-width:0!important;max-width:0!important;flex-basis:0!important}
html[data-nagi-sidebar-collapsed]{--sidebar-width:0px;--sidebar-width-small:0px;--sidebar-width-collapsed:0px}
html[data-nagi-theme],html[data-nagi-theme] [data-nagi-surface],html[data-nagi-theme] [data-nagi-composer-layer]{${tokenCSS}}
html[data-nagi-theme] body,html[data-nagi-theme] main,html[data-nagi-theme] [data-nagi-surface],html[data-nagi-theme] [data-nagi-composer-outer]{background-color:var(--nagi-background)!important;color:var(--nagi-text)!important;background-image:none!important}
html[data-nagi-theme] [data-message-author-role]{font-family:var(--nagi-font)!important;font-size:var(--nagi-font-size)!important;color:var(--nagi-text)!important}
html[data-nagi-theme] article[data-testid^="conversation-turn-"]{max-width:var(--nagi-width)!important;margin-inline:auto!important;width:100%}
html[data-nagi-theme] main pre,html[data-nagi-theme] main pre code{background:var(--nagi-code-bg)!important}
html[data-nagi-theme] [data-nagi-composer-layer],html[data-nagi-theme] [data-nagi-composer-root]{background:var(--nagi-composer-bg)!important;color:var(--nagi-text)!important;border:0!important;box-shadow:none!important;outline:none!important;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-ring-color:transparent}
html[data-nagi-theme] [data-nagi-composer-root]{border-radius:12px!important}
html[data-nagi-theme] [data-nagi-composer-root]:focus-within{outline:1px solid color-mix(in srgb,var(--nagi-text) 40%,transparent)!important;outline-offset:2px!important}
html[data-nagi-theme] #prompt-textarea{font-family:var(--nagi-font)!important;font-size:var(--nagi-font-size)!important;caret-color:var(--nagi-text)!important;box-shadow:none!important}
html[data-nagi-theme] [data-nagi-composer-layer]::before,html[data-nagi-theme] [data-nagi-composer-layer]::after,html[data-nagi-theme] [data-nagi-composer-outer]::before,html[data-nagi-theme] [data-nagi-composer-outer]::after{background:none!important;border-color:transparent!important;box-shadow:none!important;pointer-events:none!important}
html[data-nagi-theme] [data-nagi-composer-outer]{box-shadow:none!important;border-color:transparent!important}
html[data-nagi-theme] [data-nagi-composer-root] button{color:var(--nagi-text);font-family:var(--nagi-font)}
html[data-nagi-reduce-motion] main *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
`;
    document.head.append(this.style);
  }
  private mark(name: string, elements: HTMLElement[]) {
    const previous = this.marks.get(name) ?? new Set<HTMLElement>();
    const next = new Set(elements);
    for (const e of previous) if (!next.has(e)) e.removeAttribute(name);
    for (const e of next)
      if (!previous.has(e) || !e.hasAttribute(name)) e.setAttribute(name, "");
    this.marks.set(name, next);
  }
  refreshRegions(s: Settings) {
    if (!s.enabled || !s.appearance) {
      for (const [name, nodes] of this.marks) {
        for (const node of nodes) node.removeAttribute(name);
      }
      this.marks.clear();
      return;
    }
    const r = resolveRegions();
    this.mark("data-nagi-surface", r.pageSurfaces);
    this.mark(
      "data-nagi-composer-root",
      r.composerRoot ? [r.composerRoot] : [],
    );
    this.mark("data-nagi-composer-layer", r.composerLayers);
    this.mark("data-nagi-composer-outer", r.composerOuter);
  }
  apply(s: Settings) {
    const root = document.documentElement;
    const t = s.theme;
    for (const [name, value] of Object.entries({
      font: t.font,
      "font-size": `${t.fontSize}px`,
      text: t.text,
      background: t.background,
      "code-bg": t.code,
      "composer-bg": t.composer,
      width: `${t.width}px`,
    }))
      root.style.setProperty(`--nagi-${name}`, value);
    root.toggleAttribute("data-nagi-theme", s.enabled && s.appearance);
    root.toggleAttribute(
      "data-nagi-reduce-motion",
      s.enabled && s.reduceMotion,
    );
    this.refreshRegions(s);
  }
  dispose() {
    for (const [name, nodes] of this.marks)
      for (const node of nodes) node.removeAttribute(name);
    this.marks.clear();
    this.style.remove();
    document.documentElement.removeAttribute("data-nagi-theme");
    document.documentElement.removeAttribute("data-nagi-reduce-motion");
    document.documentElement.removeAttribute("data-nagi-sidebar-collapsed");
    for (const k of [
      "font",
      "font-size",
      "text",
      "background",
      "code-bg",
      "composer-bg",
      "width",
    ])
      document.documentElement.style.removeProperty(`--nagi-${k}`);
    document
      .querySelectorAll("[data-nagi-sidebar]")
      .forEach((e) => e.removeAttribute("data-nagi-sidebar"));
  }
}
