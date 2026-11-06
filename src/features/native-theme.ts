import { resolveMessages } from "../adapter/messages";
import { resolveRegions } from "../adapter/regions";
import { Marks } from "./marks";

// Theme site chrome while retaining code highlighting, images, embedded apps and nAGI's own UI.
const excluded =
  "[data-nagi-owned],pre,code,kbd,samp,svg,math,.katex,.MathJax,iframe,canvas,video,img,[role=alert]";
const safe = `:not(:where(${excluded},${excluded
  .split(",")
  .map((s) => `${s} *`)
  .join(",")}))`;
export function resolveHomeRegions(doc: Document = document): HTMLElement[] {
  if (resolveMessages(doc).length) return [];
  const roots = [
    ...doc.querySelectorAll<HTMLElement>("main,[role=main]"),
  ].filter((n) => !n.closest("[data-nagi-owned]"));
  const composer = resolveRegions(doc).composerRoot;
  if (composer && !roots.some((n) => n.contains(composer))) {
    // Some home screens keep the composer and suggestions in a sibling of main.
    let p = composer.parentElement;
    for (let depth = 0; p && depth < 5; depth++, p = p.parentElement) {
      if (
        p.matches("body,html") ||
        p.querySelector("header,nav,aside,[data-nagi-owned=shell]")
      )
        break;
      roots.push(p);
    }
  }
  return roots.filter(
    (n, _, all) => !all.some((other) => other !== n && other.contains(n)),
  );
}
export class NativeTheme {
  private marks = new Marks();
  private style = document.createElement("style");
  constructor() {
    this.style.dataset.nagiOwned = "native-theme";
    this.style.textContent = `
html[data-nagi-theme] body{font-family:var(--nagi-font,monospace)!important;color:var(--nagi-text)!important;--nagi-native-line:color-mix(in srgb,var(--nagi-text) 22%,transparent);--nagi-native-muted:color-mix(in srgb,var(--nagi-text) 72%,var(--nagi-background))}
html[data-nagi-theme] :is(div,span,p,h1,h2,h3,h4,h5,h6,label,button,a,input,textarea,select,summary,li,small)${safe}{font-family:var(--nagi-font,monospace)!important}
html[data-nagi-theme] :is(div,span,p,a,li,small,h1,h2,h3,h4,h5,h6,label,button,input,textarea,select,summary)${safe}{color:var(--nagi-text)!important}
html[data-nagi-theme] :is([data-nagi-home],[role=menu],[role=dialog],[role=listbox],[role=tablist],[data-radix-popper-content-wrapper]) :is(div,span,p,a,li,small)${safe}{color:var(--nagi-text)!important}
html[data-nagi-theme] [data-nagi-native-panel]{background:var(--nagi-composer-bg)!important;color:var(--nagi-text)!important;border-color:var(--nagi-native-line)!important;box-shadow:none!important}
html[data-nagi-theme] [data-nagi-native-card]{border:1px solid var(--nagi-native-line)!important;border-radius:8px!important;padding:14px!important}
html[data-nagi-theme] [data-nagi-home] :is(h1,h2){font-size:clamp(20px,2.2vw,28px)!important;line-height:1.4!important;font-weight:500!important}
html[data-nagi-theme] [data-nagi-home] :is(p,button,a,label,summary,small)${safe}{font-size:var(--nagi-font-size,15px)!important}
html[data-nagi-theme] [data-nagi-home] :is(button,a,[role=tab])${safe}{border-color:var(--nagi-native-line)!important}
html[data-nagi-theme] :is([data-nagi-home],[role=menu],[role=dialog],[role=listbox],[role=tablist]) :is(button,a,[role=tab],[role=menuitem])${safe}:hover{background:color-mix(in srgb,var(--nagi-accent,#32d9f5) 12%,var(--nagi-composer-bg))!important}
html[data-nagi-theme] :is([role=tab][aria-selected=true],[role=menuitemradio][aria-checked=true])${safe}{color:var(--nagi-accent,#32d9f5)!important;border-color:var(--nagi-accent,#32d9f5)!important;background:var(--nagi-code-bg)!important}
html[data-nagi-theme] :is(button,a,input,textarea,select,[role=tab])${safe}:focus-visible{outline:2px solid var(--nagi-accent,#32d9f5)!important;outline-offset:3px!important}
html[data-nagi-theme] :is(input,textarea)${safe}::placeholder{color:var(--nagi-native-muted)!important;opacity:1!important}
html[data-nagi-theme] :is([role=menu],[role=dialog],[role=listbox],[data-radix-popper-content-wrapper])${safe}{font-family:var(--nagi-font)!important;background:var(--nagi-composer-bg)!important;color:var(--nagi-text)!important;border-color:var(--nagi-native-line)!important}
`;
    document.head.append(this.style);
  }
  apply(enabled: boolean) {
    if (!enabled) {
      this.marks.clear();
      return;
    }
    const homes = resolveHomeRegions();
    this.marks.set("data-nagi-home", homes);
    const panels = new Set<HTMLElement>(),
      cards = new Set<HTMLElement>();
    const roots = [
      ...homes,
      ...document.querySelectorAll<HTMLElement>(
        "header,nav,aside,[role=menu],[role=dialog],[role=listbox],[role=tablist],[data-radix-popper-content-wrapper]",
      ),
    ];
    for (const root of roots) {
      for (const node of [
        root,
        ...root.querySelectorAll<HTMLElement>(
          "div,section,button,a,ul,[role=tab]",
        ),
      ]) {
        if (
          node.closest(excluded) ||
          node.matches(
            "form,#prompt-textarea,[data-nagi-layout-composer],[data-nagi-layout-composer-layer]",
          ) ||
          node.closest("form,[data-nagi-layout-composer]")
        )
          continue;
        if (node.querySelector("#prompt-textarea")) continue;
        const background =
          [...node.classList].some((c) =>
            /(?:^|:)bg-(?!transparent|none)/.test(c),
          ) ||
          !!node.style.background ||
          !!node.style.backgroundColor;
        const functional = node.matches(
          "header,nav,aside,[role=menu],[role=dialog],[role=listbox],[role=tablist],[data-radix-popper-content-wrapper]",
        );
        if (background || functional) panels.add(node);
        if (
          background &&
          [...node.classList].some((c) => /^rounded/.test(c)) &&
          node.querySelector("p,h2,h3")
        )
          cards.add(node);
      }
    }
    this.marks.set("data-nagi-native-panel", panels);
    this.marks.set("data-nagi-native-card", cards);
  }
  dispose() {
    this.marks.clear();
    this.style.remove();
  }
}
