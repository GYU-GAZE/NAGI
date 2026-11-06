import { resolveModeControls } from "./modes";
import { resolveMessageGroups } from "./messages";
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
function safeHeader(node: HTMLElement, groups: HTMLElement[]) {
  if (groups.some((group) => group.contains(node))) return false;
  if (
    [...node.querySelectorAll<HTMLElement>("button,[role=button]")].some(
      (control) => {
        const hook = control.getAttribute("data-testid") ?? "";
        const label =
          control.getAttribute("aria-label") ??
          control.getAttribute("title") ??
          control.textContent ??
          "";
        return (
          /(?:copy|good-response|bad-response|regenerate)-.*(?:button|action)/i.test(
            hook,
          ) ||
          /^(?:copy(?: response| message)?|copiar(?: resposta| mensagem)?|good response|bad response|thumbs up|thumbs down|regenerate|regenerar)$/i.test(
            label.trim(),
          )
        );
      },
    )
  )
    return false;
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
  const groups = resolveMessageGroups(doc).map((group) => group.envelope);
  const integrated = doc.querySelector<HTMLElement>(
    "[data-nagi-context-header]",
  );
  if (integrated && safeHeader(integrated, groups)) return integrated;
  const known = [...doc.querySelectorAll<HTMLElement>(headerSelector)].find(
    (node) => safeHeader(node, groups) && topStrip(node),
  );
  if (known) return known;
  // Home can have only a Chat/Work selector and no Share action yet.
  const modes = resolveModeControls(doc);
  for (const control of [modes.chat, modes.work, modes.trigger]) {
    let found: HTMLElement | null = null;
    for (
      let parent = control?.parentElement, depth = 0;
      parent && depth < 6;
      parent = parent.parentElement, depth++
    ) {
      if (!safeHeader(parent, groups)) break;
      if (topStrip(parent)) found = parent;
    }
    if (found) return found;
  }
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
      if (!safeHeader(parent, groups)) break;
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
        (e) =>
          !e.closest(
            '[role="menu"],[role="dialog"],[role="listbox"],[role="tooltip"],[data-radix-popper-content-wrapper],[data-nagi-owned]',
          ),
      )
    : [];
}

/** Labels are used only in the local UI, never in exported diagnostics. */
export function readHeaderContext(header: HTMLElement | null) {
  const textNodes: { text: string; parent: Element | null }[] = [];
  if (header) {
    const walker = header.ownerDocument.createTreeWalker(header, 4);
    while (walker.nextNode())
      textNodes.push({
        text: walker.currentNode.textContent?.trim() ?? "",
        parent: walker.currentNode.parentElement,
      });
  }
  const modes = resolveModeControls(header?.ownerDocument ?? document);
  const work =
    modes.active || (modes.chat && modes.work)
      ? modes.active === "work"
      : textNodes.some(
          ({ text, parent }) =>
            !parent?.closest("[role=menu],[role=dialog]") &&
            (/^Work$/i.test(text) || /[·|/]\s*Work$/i.test(text)),
        );
  const explicit = header
    ?.querySelector<HTMLElement>(
      '[data-testid="conversation-title"],[data-testid="chat-title"],[data-testid="conversation-title-button"],h1',
    )
    ?.textContent?.trim();
  const plain = textNodes
    .filter(
      ({ text, parent }) =>
        text &&
        !/^(?:Work|[·|/])$/i.test(text) &&
        !parent?.closest(
          "button,a,[role=button],[role=tab],svg,[role=menu],[role=dialog],[hidden]",
        ),
    )
    .map(({ text }) => text)
    .join(" ")
    .replace(/\s*[·|/]\s*Work\s*$/i, "")
    .trim();
  let project: { id: string; title: string; url: string } | null = null;
  for (const link of header?.querySelectorAll<HTMLAnchorElement>("a[href]") ??
    []) {
    try {
      const url = new URL(link.href, header?.ownerDocument.location.href);
      const id = url.pathname.match(/^\/g\/(g-p-[^/]+)(?:\/project)?\/?$/)?.[1];
      if (id && url.origin === "https://chatgpt.com") {
        project = {
          id,
          title: link.textContent?.trim() || "Projeto",
          url: url.href,
        };
        break;
      }
    } catch {
      /* An invalid link is not evidence of project context. */
    }
  }
  return {
    work,
    title: (explicit || plain || null)?.slice(0, 200) ?? null,
    project,
  };
}
