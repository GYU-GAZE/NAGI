import type { Settings } from "../shared/model";
export class Appearance {
  private style = document.createElement("style");
  constructor() {
    this.style.dataset.nagiOwned = "appearance";
    document.head.append(this.style);
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
    this.style.textContent = `
[data-nagi-sidebar="hidden"] {display:none!important}
html[data-nagi-theme] {--main-surface-primary:var(--nagi-background);--main-surface-secondary:var(--nagi-composer-bg);--message-surface:var(--nagi-composer-bg);--text-primary:var(--nagi-text);--bg-primary:var(--nagi-background)}
html[data-nagi-theme] body,html[data-nagi-theme] main {background:var(--nagi-background)!important;color:var(--nagi-text)!important}
html[data-nagi-theme] [data-message-author-role] {font-family:var(--nagi-font)!important;font-size:var(--nagi-font-size)!important;color:var(--nagi-text)!important}
html[data-nagi-theme] article[data-testid^="conversation-turn-"] {max-width:var(--nagi-width)!important;margin-inline:auto!important;width:100%}
html[data-nagi-theme] main pre,html[data-nagi-theme] main pre code {background:var(--nagi-code-bg)!important}
html[data-nagi-theme] #prompt-textarea,html[data-nagi-theme] form:has(#prompt-textarea) {background:var(--nagi-composer-bg)!important;color:var(--nagi-text)!important;font-family:var(--nagi-font)!important}
html[data-nagi-reduce-motion] main * {animation:none!important;transition:none!important;scroll-behavior:auto!important}
`;
  }
  dispose() {
    this.style.remove();
    document.documentElement.removeAttribute("data-nagi-theme");
    document.documentElement.removeAttribute("data-nagi-reduce-motion");
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
