/** Explicit semantic hooks shared by cards, prompt navigation and diagnostics. */
export const messageSelector =
  '[data-message-author-role="user"],[data-message-author-role="assistant"],[data-message-role="user"],[data-message-role="assistant"],[data-testid="user-message"],[data-testid="assistant-message"]';
export interface MessageRegion {
  node: HTMLElement;
  turn: HTMLElement;
  role: "user" | "assistant";
}
export function resolveMessages(doc: Document = document): MessageRegion[] {
  const candidates = [
    ...doc.querySelectorAll<HTMLElement>(messageSelector),
  ].filter(
    (e) =>
      !e.closest('[data-nagi-owned],[role="dialog"],nav,aside,form,[hidden]'),
  );
  const nodes = candidates.filter(
    (e) => !candidates.some((other) => other !== e && other.contains(e)),
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
