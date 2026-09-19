import { messageSelector } from "./messages";
/** Recognize native reasoning containers, including completed steps still in the DOM. */
export function resolveReasoning(doc: Document = document): HTMLElement[] {
  const candidates = [
    ...doc.querySelectorAll<HTMLElement>(
      "main button,main summary,[role=main] button,[role=main] summary,[data-testid*=reasoning],[data-testid*=thinking]",
    ),
  ].filter((node) => {
    if (
      node.closest(
        "[data-nagi-owned],nav,aside,form,pre,code,.markdown,[hidden]",
      )
    )
      return false;
    const hook = node.getAttribute("data-testid") || "";
    const label = (
      node.getAttribute("aria-label") ||
      node.textContent ||
      ""
    ).trim();
    return (
      /reasoning|thinking/.test(hook) ||
      /^(?:(?:working|worked|thought|thinking)\b|pensando\b|pensou por\b|trabalhando\b|trabalhou por\b|racioc[ií]nio\b)/i.test(
        label,
      )
    );
  });
  const seeds = [
    ...new Set(
      candidates.map(
        (node) =>
          node.closest<HTMLElement>(
            "details,[data-testid*=reasoning],[data-testid*=thinking]",
          ) ??
          node.parentElement ??
          node,
      ),
    ),
  ].filter(
    (node) =>
      !node.matches(messageSelector) &&
      !node.querySelector(`${messageSelector},#prompt-textarea,form`),
  );
  const roots = seeds.map((seed) => {
    let root = seed;
    for (let i = 0; i < 6; i++) {
      const parent = root.parentElement;
      if (
        !parent ||
        parent.matches("main,[role=main],body,html") ||
        parent.querySelector(
          `${messageSelector},form,#prompt-textarea,nav,aside`,
        ) ||
        seeds.filter((n) => parent.contains(n)).length !== 1
      )
        break;
      root = parent;
    }
    return root;
  });
  return [...new Set(roots)].filter(
    (node, _, all) =>
      !all.some((other) => other !== node && other.contains(node)),
  );
}
