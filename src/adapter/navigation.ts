import { resolveRegions } from "./regions";
import { messageSelector } from "./messages";
export interface NativeChatRow {
  id: string;
  title: string;
  url: string;
  link: HTMLAnchorElement;
  row: HTMLElement;
  sidebar: HTMLElement;
  pinned: boolean;
}
export type SidebarDestination =
  | "scheduled"
  | "plugins"
  | "codex"
  | "more"
  | "projects";
export function navigationLabel(node: Element) {
  return (
    node.getAttribute("aria-label") ||
    node.getAttribute("title") ||
    node.textContent ||
    ""
  ).trim();
}
export function chatId(link: HTMLAnchorElement) {
  try {
    const url = new URL(link.href);
    return url.origin === "https://chatgpt.com"
      ? (url.pathname.match(/\/c\/([\w-]+)\/?$/)?.[1] ?? null)
      : null;
  } catch {
    return null;
  }
}
function isPinned(row: HTMLElement, sidebar: HTMLElement) {
  const pinned =
    /^(?:pinned(?: chats)?|chats pinnados|conversas fixadas|fixados|fixadas)$/i;
  if (
    row.matches('[data-pinned="true"],[data-is-pinned="true"]') ||
    row.querySelector(
      '[aria-label^="Unpin"],[aria-label^="Desafixar"],[data-pinned="true"]',
    )
  )
    return true;
  let node: HTMLElement | null = row;
  while (node && node !== sidebar) {
    if (
      pinned.test(node.getAttribute("aria-label") || "") ||
      /^(?:pinned-chats|pinned-conversations)$/.test(node.dataset.testid || "")
    )
      return true;
    // Sections often use a heading immediately before a group of rows.
    for (
      let prev = node.previousElementSibling;
      prev;
      prev = prev.previousElementSibling
    ) {
      const heading = prev.matches("h1,h2,h3,h4,[role=heading]")
        ? prev
        : prev.querySelector("h1,h2,h3,h4,[role=heading]");
      if (heading) return pinned.test(navigationLabel(heading));
    }
    node = node.parentElement;
  }
  return false;
}
export function resolveChatRows(doc: Document = document): NativeChatRow[] {
  const results = new Map<string, NativeChatRow>();
  for (const sidebar of resolveRegions(doc).sidebar) {
    for (const link of sidebar.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      if (
        link.closest(
          `[data-nagi-owned],${messageSelector},[role=menu],[role=dialog]`,
        )
      )
        continue;
      const id = chatId(link);
      if (!id) continue;
      let row: HTMLElement = link;
      // Keep the original row, including live Pin/More controls and React handlers.
      for (
        let p = link.parentElement, depth = 0;
        p && p !== sidebar && depth < 4;
        p = p.parentElement, depth++
      ) {
        const ids = new Set(
          [...p.querySelectorAll<HTMLAnchorElement>("a[href]")]
            .map(chatId)
            .filter(Boolean),
        );
        if (
          ids.size !== 1 ||
          p.matches("nav,aside,section,ol,ul") ||
          p.querySelector("h1,h2,h3,h4,[role=heading]")
        )
          break;
        if (
          p.matches(
            "li,[data-testid*=history-item],[data-testid*=conversation-item]",
          ) ||
          p.querySelector("button,[role=button]")
        ) {
          row = p;
          break;
        }
      }
      const titleNode = link.cloneNode(true) as HTMLElement;
      titleNode
        .querySelectorAll("button,[role=button],svg")
        .forEach((n) => n.remove());
      const value = {
        id,
        title: (
          link.getAttribute("title") ||
          titleNode.textContent ||
          navigationLabel(link)
        )
          .trim()
          .slice(0, 200),
        url: link.href,
        link,
        row,
        sidebar,
        pinned: isPinned(row, sidebar),
      };
      const previous = results.get(id);
      if (!previous || value.pinned) results.set(id, value);
    }
  }
  return [...results.values()];
}
const destinations: Record<SidebarDestination, RegExp> = {
  scheduled:
    /^(?:scheduled|schedules|scheduled tasks|tasks|agendados|agendadas|tarefas|tarefas agendadas)$/i,
  plugins: /^(?:plugins|plug-ins)$/i,
  codex: /^codex$/i,
  more: /^(?:more|mais|more options|mais opções|mais opcoes)$/i,
  projects: /^(?:projects|projetos|all projects|todos os projetos)$/i,
};
export function resolveSidebarControl(
  kind: SidebarDestination,
  doc: Document = document,
): { node: HTMLElement; sidebar: HTMLElement } | null {
  const rows = resolveChatRows(doc);
  for (const sidebar of resolveRegions(doc).sidebar) {
    for (const node of sidebar.querySelectorAll<HTMLElement>(
      "a[href],button,[role=button]",
    )) {
      if (
        node.closest(
          `[data-nagi-owned],${messageSelector},[role=menu],[role=dialog]`,
        ) ||
        rows.some((r) => r.row.contains(node)) ||
        node.matches(":disabled,[aria-disabled=true]")
      )
        continue;
      if (destinations[kind].test(navigationLabel(node)))
        return { node, sidebar };
    }
  }
  return null;
}
/** Only expansion controls: never navigate to the Projects page implicitly. */
export function resolveProjectsExpansion(doc: Document = document) {
  const control = resolveSidebarControl("projects", doc);
  return control?.node.matches(
    "button[aria-expanded=false],[role=button][aria-expanded=false]",
  )
    ? control.node
    : null;
}

const pinLabel =
  /^(?:pin(?: chat| conversation)?|unpin(?: chat| conversation)?|fixar(?: conversa| chat)?|desafixar(?: conversa| chat)?)$/i;
export function nativePin(row: HTMLElement) {
  return (
    [...row.querySelectorAll<HTMLElement>("button,[role=button]")].find((n) =>
      pinLabel.test(navigationLabel(n)),
    ) ?? null
  );
}
export function nativeChatMenu(row: HTMLElement) {
  return [...row.querySelectorAll<HTMLElement>("button,[role=button]")].find(
    (n) =>
      n.getAttribute("aria-haspopup") === "menu" ||
      /^(?:more|more options|open conversation options|conversation options|mais|mais opções|mais opcoes)(?:\b|$)/i.test(
        navigationLabel(n),
      ),
  );
}
/** Explicit quick action. Use only the menu associated with this row's native trigger. */
export async function pinChat(
  id: string,
  doc: Document = document,
): Promise<boolean> {
  const item = resolveChatRows(doc).find((r) => r.id === id);
  if (!item) return false;
  const direct = nativePin(item.row);
  if (direct) {
    direct.click();
    return true;
  }
  const trigger = nativeChatMenu(item.row);
  if (!trigger || trigger.matches(":disabled,[aria-disabled=true]"))
    return false;
  const route = doc.location.href;
  const find = () => {
    if (
      !trigger.isConnected ||
      doc.location.href !== route ||
      !item.row.contains(trigger) ||
      chatId(item.link) !== id
    )
      return null;
    const controlled = trigger.getAttribute("aria-controls");
    const menu = controlled
      ? doc.getElementById(controlled)
      : [...doc.querySelectorAll<HTMLElement>("[role=menu]")].find(
          (n) =>
            trigger.id &&
            n
              .getAttribute("aria-labelledby")
              ?.split(/\s+/)
              .includes(trigger.id),
        );
    if (
      !menu ||
      !menu.matches("[role=menu]") ||
      menu.closest("[hidden],[data-state=closed]")
    )
      return null;
    return (
      [...menu.querySelectorAll<HTMLElement>("[role=menuitem],button")].find(
        (n) =>
          pinLabel.test(navigationLabel(n)) &&
          !n.matches(":disabled,[aria-disabled=true]"),
      ) ?? null
    );
  };
  // Native menu triggers support ArrowDown; avoid firing click AND pointerdown (double toggles).
  trigger.focus({ preventScroll: true });
  trigger.dispatchEvent(
    new doc.defaultView!.KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    }),
  );
  const immediate = find();
  if (immediate) {
    immediate.click();
    return true;
  }
  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(value);
    };
    const observer = new doc.defaultView!.MutationObserver(() => {
      const action = find();
      if (action) {
        finish(true);
        action.click();
      }
    });
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-controls", "data-state"],
    });
    const timer = setTimeout(() => finish(false), 900);
  });
}
