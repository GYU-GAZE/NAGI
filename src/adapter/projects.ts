import { messageSelector } from "./messages";
export interface ProjectLink {
  id: string;
  title: string;
  url: string;
}
export function projectLink(
  value: string,
  base: string,
): { id: string; url: string } | null {
  try {
    const url = new URL(value, base);
    if (url.origin !== "https://chatgpt.com") return null;
    const match =
      url.pathname.match(/^\/g\/(g-p-[^/]+)(?:\/project)?\/?$/) ??
      url.pathname.match(/^\/projects?\/([^/]+)\/?$/);
    return match ? { id: match[1], url: url.href } : null;
  } catch {
    return null;
  }
}
const excluded = `[data-nagi-owned],${messageSelector},article,pre,code,[contenteditable]`;
export function resolveProjects(doc: Document = document): ProjectLink[] {
  const links = new Map<string, ProjectLink>();
  for (const node of doc.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (node.closest(excluded)) continue;
    const parsed = projectLink(node.href, doc.location.href);
    if (!parsed) continue;
    const title = (node.getAttribute("aria-label") || node.textContent || "")
      .trim()
      .slice(0, 200);
    if (!links.has(parsed.id))
      links.set(parsed.id, { ...parsed, title: title || "Projeto" });
  }
  return [...links.values()];
}
export function resolveProjectsControl(
  doc: Document = document,
): HTMLElement | null {
  return (
    [
      ...doc.querySelectorAll<HTMLElement>(
        "button,a[href],[role=button],[role=tab]",
      ),
    ].find((node) => {
      if (
        node.closest(excluded) ||
        node.matches(":disabled,[aria-disabled=true]")
      )
        return false;
      if (
        node.matches("button") &&
        node.closest("form") &&
        node.getAttribute("type") !== "button"
      )
        return false;
      if (node.matches("a[href]")) {
        try {
          if (
            new URL((node as HTMLAnchorElement).href).origin !==
            "https://chatgpt.com"
          )
            return false;
        } catch {
          return false;
        }
      }
      const label = (
        node.getAttribute("aria-label") ||
        node.textContent ||
        ""
      ).trim();
      return /^(?:projects?|projetos?|all projects|todos os projetos|view projects|ver projetos)$/i.test(
        label,
      );
    }) ?? null
  );
}
