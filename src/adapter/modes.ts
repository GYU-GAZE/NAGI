import { messageSelector, resolveMessageGroups } from "./messages";

export type ChatMode = "chat" | "work";
export interface ModeControls {
  chat: HTMLElement | null;
  work: HTMLElement | null;
  trigger: HTMLElement | null;
  active: ChatMode | null;
}
const controls =
  "button,a[href],[role=tab],[role=button],[role=menuitem],[role=menuitemradio]";
function modeLabel(node: Element): ChatMode | null {
  const label = (node.getAttribute("aria-label") || node.textContent || "")
    .trim()
    .replace(/\s+/g, " ");
  if (/^(?:chat|chatgpt|chat normal|bate-papo)$/i.test(label)) return "chat";
  if (/^(?:work|chatgpt work)$/i.test(label)) return "work";
  return null;
}
function selected(node: Element) {
  return (
    node.getAttribute("aria-selected") === "true" ||
    node.getAttribute("aria-pressed") === "true" ||
    node.getAttribute("aria-checked") === "true" ||
    ["page", "true"].includes(node.getAttribute("aria-current") || "") ||
    ["active", "checked", "on"].includes(node.getAttribute("data-state") || "")
  );
}
/** Resolve actual native controls; never manufacture mode URLs or account state. */
export function resolveModeControls(doc: Document = document): ModeControls {
  const empty: ModeControls = {
    chat: null,
    work: null,
    trigger: null,
    active: null,
  };
  const groups = resolveMessageGroups(doc);
  const candidates = [...doc.querySelectorAll<HTMLElement>(controls)].filter(
    (node) => {
      if (
        node.closest(
          `[data-nagi-owned],${messageSelector},article,form,[contenteditable],[hidden]`,
        )
      )
        return false;
      if (groups.some((g) => g.envelope.contains(node))) return false;
      const rect = node.getBoundingClientRect();
      // Semantic navigation or a live control in the shallow top strip.
      return (
        (rect.width > 0 &&
          rect.height > 0 &&
          rect.top >= 0 &&
          rect.top < 100) ||
        !!node.closest(
          "header,nav,[role=banner],[role=tablist],[role=menu],#page-header,#history,#sidebar,[data-testid=sidebar],[data-nagi-sidebar],[data-nagi-context-header]",
        )
      );
    },
  );
  // Some versions put the switch behind a native popover instead of two tabs.
  empty.trigger =
    candidates.find((n) => {
      const label = (
        n.getAttribute("aria-label") ||
        n.textContent ||
        ""
      ).trim();
      return (
        n.hasAttribute("aria-haspopup") &&
        (modeLabel(n) !== null ||
          /^(?:switch mode|change mode|alternar modo|mudar modo|chat\s*[/·]\s*work)$/i.test(
            label,
          ))
      );
    }) ?? null;
  const chats = candidates.filter((n) => modeLabel(n) === "chat");
  const works = candidates.filter((n) => modeLabel(n) === "work");
  for (const chat of chats) {
    for (
      let group = chat.parentElement, depth = 0;
      group && depth < 4;
      group = group.parentElement, depth++
    ) {
      if (
        group.matches("body,html,main,[role=main]") ||
        group.querySelector(messageSelector)
      )
        break;
      const work = works.find((n) => group!.contains(n));
      if (!work || group.querySelectorAll(controls).length > 12) continue;
      // Conversation/project links named Chat or Work are not mode selectors.
      const pair = [chat, work];
      if (
        pair.some(
          (n) =>
            n.matches("a[href]") && !safeModeLink(n as HTMLAnchorElement, doc),
        )
      )
        continue;
      if (
        pair.some((n) => n.closest("[role=menu]")) &&
        !group.closest("[role=menu]")
      )
        continue;
      return {
        chat,
        work,
        trigger: empty.trigger,
        active: selected(work) ? "work" : selected(chat) ? "chat" : null,
      };
    }
  }
  return empty;
}
function safeModeLink(node: HTMLAnchorElement, doc: Document) {
  try {
    const url = new URL(node.href, doc.location.href);
    return (
      url.origin === doc.location.origin &&
      !/^\/(?:c|g|project|projects)\//.test(url.pathname)
    );
  } catch {
    return false;
  }
}
