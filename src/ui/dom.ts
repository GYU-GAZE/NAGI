export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function button(label: string, run: () => void, icon?: string) {
  const b = el("button", icon ?? label);
  b.type = "button";
  b.title = label;
  b.setAttribute("aria-label", label);
  if (icon) b.className = "icon";
  b.addEventListener("click", run);
  return b;
}
export function field(label: string, input: HTMLElement, hint?: string) {
  const wrap = el("label", undefined, "field");
  wrap.append(el("span", label), input);
  if (hint) wrap.append(el("small", hint));
  return wrap;
}
export function input(value: string, type = "text") {
  const i = el("input");
  i.type = type;
  i.value = value;
  return i;
}
export function select(options: [string, string][], value: string) {
  const s = el("select");
  for (const [v, label] of options) {
    const o = el("option", label);
    o.value = v;
    s.append(o);
  }
  s.value = value;
  return s;
}
export function checkbox(
  label: string,
  checked: boolean,
  onchange: (value: boolean) => void,
) {
  const i = input("", "checkbox");
  i.checked = checked;
  i.addEventListener("change", () => onchange(i.checked));
  const l = el("label", undefined, "check");
  l.append(i, el("span", label));
  return l;
}
export function note(message: string) {
  return el("p", message, "note");
}
export const uiCSS = `
:host {font:13px/1.45 var(--nagi-ui-font,system-ui);color:var(--nagi-ui-text,#dce4f1)}
*,*::before,*::after{box-sizing:border-box} [hidden]{display:none!important}
button,input,textarea,select{font:inherit;color:inherit}button,a,input,textarea,select{outline-offset:3px}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--nagi-accent,#bad4ff)}
button{border:1px solid color-mix(in srgb,var(--nagi-ui-text,#dce4f1) 30%,transparent);background:var(--nagi-ui-panel,#222b3b);border-radius:6px;padding:6px 10px;cursor:pointer;white-space:normal}button:hover{background:color-mix(in srgb,var(--nagi-ui-text,#dce4f1) 12%,var(--nagi-ui-panel,#34435b))}button:disabled{opacity:.45;cursor:default}button.primary{background:var(--nagi-accent,#b8d0fa);color:var(--nagi-accent-foreground,#111b2b);border-color:transparent}button.danger{color:#ffadb0}button.icon{width:34px;height:32px;padding:3px;font-size:19px;border-color:transparent;background:transparent;white-space:nowrap}button.icon:hover{background:#2d394d}
a{color:var(--nagi-ui-text,#bbd6ff);text-decoration:none}a:hover{text-decoration:underline}
input:not([type=checkbox]):not([type=color]),select,textarea{width:100%;background:var(--nagi-ui-bg,#111925);border:1px solid color-mix(in srgb,var(--nagi-ui-text,#dce4f1) 35%,transparent);border-radius:5px;padding:7px 9px;min-width:0}input[type=color]{width:100%;height:34px;border:1px solid color-mix(in srgb,var(--nagi-ui-text,#dce4f1) 35%,transparent);background:var(--nagi-ui-bg,#111925);border-radius:5px}input[type=checkbox]{accent-color:var(--nagi-accent,#bfd6ff)}input[type=file]{font-size:12px}textarea{resize:vertical;min-height:150px}
h1{font-size:21px;margin:0 0 8px}h2{font-size:16px;margin:6px 0 12px}h3{font-size:14px;margin:16px 0 8px}p{margin:8px 0}small,.note{color:var(--nagi-ui-muted,#a5b2c8);font-size:12px}.note{line-height:1.6}code{font-family:monospace;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 monospace;background:var(--nagi-ui-bg,#101824);padding:12px;border-radius:6px}
.bar{display:flex;align-items:center;gap:3px;padding:5px 8px;border:1px solid color-mix(in srgb,var(--nagi-ui-text,#dce4f1) 25%,transparent);border-radius:10px;background:var(--nagi-ui-bg,#151e2d);box-shadow:0 6px 25px #0004;max-width:calc(100vw - 24px)}.brand{font:600 15px monospace;letter-spacing:-1px;margin:0 9px 0 3px;color:var(--nagi-ui-text,#c7daff)}.sep{width:1px;height:20px;background:color-mix(in srgb,var(--nagi-ui-text,#dce4f1) 25%,transparent);margin:0 4px}.spacer{flex:1}.identity{display:flex;gap:8px;align-items:center;font-size:12px;min-width:0}.identity img{width:30px;height:30px;object-fit:contain;image-rendering:var(--nagi-avatar-rendering,auto)}.state-dot{width:6px;height:6px;border-radius:50%;background:#91b69c}.state-dot[data-state=thinking]{background:#e3c589}.state-dot[data-state=talking]{background:#a3c6ff}.state-dot[data-state=unknown]{background:#a0a0a0}
:host([data-nagi-header-shell]) .bar{border-color:transparent;background:transparent;box-shadow:none;color:var(--nagi-header-text);font-family:var(--nagi-header-font);flex-wrap:wrap}
:host([data-nagi-header-shell]) .bar>*{flex-shrink:0}
:host([data-nagi-header-shell]) .bar button{color:inherit;background:transparent;border-color:transparent}
:host([data-nagi-header-shell]) .bar button:hover{background:color-mix(in srgb,var(--nagi-header-text) 12%,transparent)}
:host([data-nagi-header-shell]) .brand{color:inherit}
.panel{width:min(650px,calc(100vw - 24px));margin-top:8px;border:1px solid color-mix(in srgb,var(--nagi-ui-text,#dce4f1) 25%,transparent);border-radius:10px;background:var(--nagi-ui-panel,#182131);box-shadow:0 15px 50px #0005;overflow:hidden}.panel-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid color-mix(in srgb,var(--nagi-ui-text,#dce4f1) 25%,transparent)}.panel-head h2{margin:0;flex:1}.body{padding:14px;max-height:72vh;overflow:auto;overscroll-behavior:contain}.tabs{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:16px}.tabs button{padding:5px 8px;font-size:12px}.tabs button[aria-pressed=true]{border-color:var(--nagi-accent,#b8d0fa);color:var(--nagi-ui-text,#d5e4ff);background:color-mix(in srgb,var(--nagi-accent,#b8d0fa) 15%,var(--nagi-ui-panel,#33425b))}.field{display:flex;flex-direction:column;gap:5px;margin:10px 0;min-width:0}.check{display:flex;align-items:center;gap:9px;margin:10px 0}.row{display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap}.row .grow{flex:1;min-width:100px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.actions{display:flex;gap:8px;align-items:center;margin:14px 0 0;flex-wrap:wrap}.list{display:flex;flex-direction:column;gap:5px}.list a,.list>button{text-align:left;padding:9px;border-radius:6px;overflow-wrap:anywhere}.list a:hover{background:#26344b}.session{display:flex;gap:5px;align-items:center;padding:7px 0;border-bottom:1px solid #344156}.session a{flex:1;min-width:0;overflow-wrap:anywhere}.session button{padding:3px 7px}.message{padding:10px 13px;margin-top:8px;border:1px solid #b29e67;background:#302b20;border-radius:8px;max-width:650px}.message p{margin:0;white-space:pre-wrap}.badge{font-size:11px;color:#9ab4dc}.portrait{width:64px;height:64px;object-fit:contain;image-rendering:var(--nagi-avatar-rendering,auto);border:1px solid #3c4b65;background:var(--nagi-ui-bg,#0f1724);border-radius:6px}.empty{padding:14px 4px;color:var(--nagi-ui-muted,#a5b2c8)}.status{color:var(--nagi-ui-text,#add5b7);min-height:18px;font-size:12px}.error{color:var(--nagi-ui-text,#ffb5b5);white-space:pre-wrap}
@media(max-width:560px){.brand{display:none}.grid{grid-template-columns:1fr}.bar{gap:0}.bar button.icon{width:30px}.body{max-height:65vh}.identity span.name{max-width:70px;overflow:hidden;text-overflow:ellipsis}.session{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
