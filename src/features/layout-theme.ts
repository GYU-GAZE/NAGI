import { accentForeground } from "../ui/theme";
import type { Settings } from "../shared/model";
import { resolveRegions } from "../adapter/regions";
import { Marks } from "./marks";
export class LayoutTheme {
  private marks = new Marks();
  private style = document.createElement("style");
  constructor() {
    this.style.dataset.nagiOwned = "layout-theme";
    this.style.textContent = `
html[data-nagi-layout=network]{--nagi-ui-bg:var(--nagi-background,#03131f);--nagi-ui-panel:var(--nagi-composer-bg,#061c2b);--nagi-ui-text:var(--nagi-text,#d8e7ff);--nagi-ui-font:var(--nagi-font,monospace);--nagi-ui-font-size:var(--nagi-font-size,15px);--nagi-thread-width:var(--nagi-width,1040px);--nagi-line:color-mix(in srgb,var(--nagi-accent) 30%,transparent);--nagi-grid-image:none;scroll-padding-top:calc(var(--nagi-shell-height,140px) + 16px)}
html[data-nagi-layout=network][data-nagi-theme]{--nagi-ui-bg:var(--nagi-background);--nagi-ui-panel:var(--nagi-composer-bg);--nagi-ui-text:var(--nagi-text);--nagi-ui-font:var(--nagi-font);--nagi-ui-font-size:var(--nagi-font-size);--nagi-thread-width:var(--nagi-width)}
html[data-nagi-grid]{--nagi-grid-image:linear-gradient(color-mix(in srgb,var(--nagi-accent) 6%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--nagi-accent) 6%,transparent) 1px,transparent 1px)}
html[data-nagi-layout=network] body,html[data-nagi-layout=network] [data-nagi-layout-surface]{background-color:var(--nagi-ui-bg)!important;background-image:var(--nagi-grid-image)!important;background-size:28px 28px!important;background-attachment:fixed!important;color:var(--nagi-ui-text)!important;scroll-padding-top:calc(var(--nagi-shell-height,140px) + 16px)}
html[data-nagi-shell-reserve] main{padding-top:calc(var(--nagi-shell-height,140px) + 16px)!important}
html[data-nagi-layout=network] [data-nagi-layout-decoration],html[data-nagi-layout=network] [data-nagi-layout-outer]{background:transparent!important;border:0!important;box-shadow:none!important}
html[data-nagi-layout=network] [data-nagi-layout-decoration]::before,html[data-nagi-layout=network] [data-nagi-layout-decoration]::after,html[data-nagi-layout=network] [data-nagi-layout-outer]::before,html[data-nagi-layout=network] [data-nagi-layout-outer]::after{background:none!important;box-shadow:none!important;pointer-events:none!important}
html[data-nagi-composer-frame] [data-nagi-layout-composer]{position:relative!important;box-sizing:border-box!important;flex-wrap:wrap!important;background:var(--nagi-ui-panel)!important;color:var(--nagi-ui-text)!important;border:1px solid var(--nagi-accent)!important;border-radius:7px!important;box-shadow:0 0 0 5px var(--nagi-ui-bg),0 0 0 6px var(--nagi-line)!important;max-width:var(--nagi-thread-width)!important;width:100%!important;margin-inline:auto!important;padding:10px!important}
html[data-nagi-composer-frame] [data-nagi-layout-composer]:focus-within{outline:1px solid var(--nagi-accent)!important;outline-offset:5px!important}
html[data-nagi-composer-frame] [data-nagi-layout-composer-layer]{background:transparent!important;box-shadow:none!important;border:0!important;outline:none!important;color:inherit!important}
html[data-nagi-composer-frame] #prompt-textarea{font:var(--nagi-ui-font-size)/1.6 var(--nagi-ui-font)!important;caret-color:var(--nagi-accent)!important}
html[data-nagi-composer-frame] [data-nagi-layout-composer] button[data-testid=send-button]{background:var(--nagi-accent)!important;color:var(--nagi-accent-foreground,#00131d)!important;border-radius:5px!important}
@media(max-width:600px){html[data-nagi-layout=network]{--nagi-avatar-size:40px!important;--nagi-message-gap:16px!important}}
`;
    document.head.append(this.style);
  }
  apply(s: Settings) {
    const root = document.documentElement;
    const active = s.enabled && s.layout.variant === "network";
    if (active) root.dataset.nagiLayout = "network";
    else root.removeAttribute("data-nagi-layout");
    root.toggleAttribute("data-nagi-grid", active && s.layout.grid);
    root.toggleAttribute(
      "data-nagi-composer-frame",
      active && s.layout.composerFrame,
    );
    for (const [key, value] of Object.entries({
      accent: s.layout.accent,
      "accent-foreground":accentForeground(s.layout.accent),
      "avatar-rendering":s.layout.avatarRendering==='pixel'?'pixelated':s.layout.avatarRendering==='smooth'?'smooth':'auto',
      "avatar-size": `${s.layout.avatarSize}px`,
      "message-gap": `${s.layout.density==='compact'?Math.min(s.layout.messageGap,12):s.layout.messageGap}px`,
    }))
      root.style.setProperty(`--nagi-${key}`, value);
    if (!active) {
      this.marks.clear();
      return;
    }
    const r = resolveRegions();
    this.marks.set("data-nagi-layout-surface", r.pageSurfaces);
    this.marks.set(
      "data-nagi-layout-decoration",
      s.layout.composerFrame ? r.composerDecorations : [],
    );
    this.marks.set(
      "data-nagi-layout-outer",
      s.layout.composerFrame ? r.composerOuter : [],
    );
    this.marks.set(
      "data-nagi-layout-composer",
      s.layout.composerFrame && r.composerRoot ? [r.composerRoot] : [],
    );
    this.marks.set(
      "data-nagi-layout-composer-layer",
      s.layout.composerFrame
        ? r.composerLayers.filter((e) => e !== r.composerRoot)
        : [],
    );
  }
  dispose() {
    this.marks.clear();
    this.style.remove();
    for (const attr of [
      "data-nagi-layout",
      "data-nagi-grid",
      "data-nagi-composer-frame",
    ])
      document.documentElement.removeAttribute(attr);
    for (const name of ["accent", "accent-foreground", "avatar-rendering", "avatar-size", "message-gap"])
      document.documentElement.style.removeProperty(`--nagi-${name}`);
  }
}
