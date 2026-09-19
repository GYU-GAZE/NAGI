/** Explicit semantic hooks shared by cards, prompt navigation and diagnostics. */
export const messageSelector =
  '[data-message-author-role="user"],[data-message-author-role="assistant"],[data-message-role="user"],[data-message-role="assistant"],[data-testid="user-message"],[data-testid="assistant-message"]';
export interface MessageRegion {
  node: HTMLElement;
  turn: HTMLElement;
  role: "user" | "assistant";
}
const sources = new WeakMap<Document, () => MessageRegion[]>();
export function registerMessageSource(doc: Document, read: () => MessageRegion[]) {
  sources.set(doc, read); return () => sources.delete(doc);
}
export function resolveMessages(doc: Document = document): MessageRegion[] {
  return sources.get(doc)?.() ?? scanMessages(doc);
}
export function scanMessages(doc: Document = document, root: Document | Element = doc): MessageRegion[] {
  const candidates = [
    ...(root instanceof doc.defaultView!.Element && root.matches(messageSelector) ? [root as HTMLElement] : []),
    ...root.querySelectorAll<HTMLElement>(messageSelector),
  ].filter(
    (e) =>
      !e.closest('[data-nagi-owned],[role="dialog"],nav,aside,form,[hidden]'),
  );
  const nodes = candidates.filter(
    (e) => !e.parentElement?.closest(messageSelector),
  );
  return nodes.map((node) => {
    const role =
      node.getAttribute("data-message-author-role") ??
      node.getAttribute("data-message-role") ??
      node.getAttribute("data-testid")?.split("-")[0];
    const article = node.closest<HTMLElement>(
      'article[data-testid^="conversation-turn"],article[data-turn-id],[data-testid="conversation-turn"]',
    );
    return {
      node,
      role: role === "user" ? "user" : "assistant",
      turn:
        article && article.querySelectorAll(messageSelector).length === 1
          ? article
          : node,
    };
  });
}

export interface MessageGroup extends MessageRegion {
  envelope: HTMLElement;
  path: HTMLElement[];
  accessories: HTMLElement[];
}
/** Find a complete turn even when Work uses sections/divs instead of articles. */
export function resolveMessageGroups(doc: Document = document): MessageGroup[] {
  const messages = resolveMessages(doc);
  const counts = new Map<HTMLElement, number>();
  for (const { node } of messages) {
    for (
      let p: HTMLElement | null = node, depth = 0;
      p && depth < 24;
      p = p.parentElement, depth++
    ) {
      counts.set(p, (counts.get(p) ?? 0) + 1);
      if (p.matches("main,[role=main],body")) break;
    }
  }
  return messages.map((message) => {
    let envelope = message.node;
    for (let depth = 0; depth < 20; depth++) {
      const parent = envelope.parentElement;
      if (
        !parent ||
        counts.get(parent) !== 1 ||
        parent.matches(
          "main,[role=main],body,html,nav,aside,form,[role=dialog],[data-nagi-owned]",
        ) ||
        parent.querySelector(
          "#prompt-textarea,form,header,nav,aside,[role=banner]",
        )
      )
        break;
      envelope = parent;
    }
    const path: HTMLElement[] = [],
      accessories: HTMLElement[] = [];
    for (
      let child = message.node;
      child !== envelope && child.parentElement;
      child = child.parentElement
    ) {
      const parent = child.parentElement;
      path.push(parent);
      for (const sibling of parent.children) {
        if (
          sibling !== child &&
          sibling instanceof doc.defaultView!.HTMLElement &&
          !sibling.matches(
            "[data-nagi-owned],style,script,[hidden],input[type=hidden]",
          )
        )
          accessories.push(sibling as HTMLElement);
      }
    }
    return { ...message, envelope, path, accessories };
  });
}
