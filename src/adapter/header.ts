/** Only public DOM. No React state, internal endpoints or copied click handlers. */
const headerSelector =
  '#page-header,header,[role="banner"],[data-testid="conversation-header"],[data-testid="chat-header"]';
const excluded =
  '[data-nagi-owned],article,[data-message-author-role],aside,nav,form,[role="dialog"],[role="menu"]';
const content =
  "main,article,[data-message-author-role],aside,form,#prompt-textarea";
const interactive = 'button,a,[role="button"]';
export function headerAction(
  element: Element,
): "share" | "files" | "menu" | null {
  const label =
    `${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("title") ?? ""} ${element.textContent ?? ""}`.trim();
  const hook = element.getAttribute("data-testid") ?? "";
  if (
    /^(?:share-chat-button|conversation-share-button)$/.test(hook) ||
    /\b(?:share|compartilhar|partilhar)\b/i.test(label)
  )
    return "share";
  if (/\b(?:files|sources|arquivos|fontes)\b/i.test(label)) return "files";
  if (
    /\b(?:more|options|menu|mais|opções)\b/i.test(label) ||
    element.getAttribute("aria-haspopup") === "menu"
  )
    return "menu";
  return null;
}
function safeHeader(node: HTMLElement) {
  return (
    !node.matches("html,body") &&
    !node.closest(`${excluded},[hidden],[aria-hidden="true"]`) &&
    !node.querySelector(content)
  );
}
function topStrip(node: HTMLElement) {
  const r = node.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  return r.top >= -2 && r.top < 96 && r.height <= 160 && r.width >= 240;
}
export function resolveHeader(doc: Document = document): HTMLElement | null {
  const known = [...doc.querySelectorAll<HTMLElement>(headerSelector)].find(
    (node) => safeHeader(node) && topStrip(node),
  );
  if (known) return known;
  // Work may use a plain div. A Share action plus another live control in a
  // wide, shallow top strip is required; never infer a header from chat text.
  for (const control of doc.querySelectorAll<HTMLElement>(interactive)) {
    if (control.closest(excluded) || headerAction(control) !== "share")
      continue;
    let found: HTMLElement | null = null;
    let parent = control.parentElement;
    for (
      let depth = 0;
      parent && depth < 8;
      depth++, parent = parent.parentElement
    ) {
      if (!safeHeader(parent)) break;
      if (!topStrip(parent)) continue;
      const r = parent.getBoundingClientRect();
      if (r.width < Math.min(600, (doc.defaultView?.innerWidth ?? 1000) * 0.55))
        continue;
      if (parent.querySelectorAll(interactive).length >= 2) found = parent;
    }
    if (found) return found;
  }
  return null;
}
export function headerControls(header: HTMLElement | null) {
  return header
    ? [...header.querySelectorAll<HTMLElement>(interactive)].filter(
        (e) => !e.closest('[role="menu"],[role="dialog"],[data-nagi-owned]'),
      )
    : [];
}
