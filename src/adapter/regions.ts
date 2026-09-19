import { messageSelector } from "./messages";
import { selectors as S } from "./selectors";

export interface Regions {
  sidebar: HTMLElement[];
  composer: HTMLElement | null;
  composerRoot: HTMLElement | null;
  composerLayers: HTMLElement[];
  composerOuter: HTMLElement[];
  pageSurfaces: HTMLElement[];
}
function own(el: Element) {
  return !!el.closest("[data-nagi-owned]");
}
function unique<T>(nodes: T[]): T[] {
  return [...new Set(nodes)];
}

/** Resolve semantic regions instead of inheriting native utility-class chains.
 * Fail closed: never classify the chat, its content, or the page root as sidebar. */
export function resolveRegions(doc: Document = document): Regions {
  const composer = doc.querySelector<HTMLElement>(S.composer);
  const main = doc.querySelector<HTMLElement>('main, [role="main"]');
  const safeSide = (e: HTMLElement) =>
    e !== doc.body &&
    e !== doc.documentElement &&
    !own(e) &&
    e !== main &&
    !(main && e.contains(main)) &&
    !(composer && e.contains(composer)) &&
    !e.closest('main,[role="main"],[data-message-author-role]');
  const seeds = [...doc.querySelectorAll<HTMLElement>(S.sidebar)].filter(
    safeSide,
  );
  // Structural fallback only when there is an independently identified chat region.
  if (main || composer)
    for (const nav of doc.querySelectorAll<HTMLElement>("nav,aside")) {
      if (
        safeSide(nav) &&
        nav.querySelector('a[href^="/c/"], a[href^="/g/g-p-"]')
      )
        seeds.push(nav);
    }
  const sidebar = unique(
    seeds.map((seed) => {
      let root = seed;
      if (main || composer)
        for (let depth = 0; depth < 8; depth++) {
          const parent = root.parentElement;
          if (!parent || !safeSide(parent)) break;
          root = parent;
        }
      return root;
    }),
  ).filter(
    (node, _, all) =>
      !all.some((other) => other !== node && other.contains(node)),
  );
  let composerRoot =
    composer?.closest<HTMLElement>("form") ??
    composer?.closest<HTMLElement>(S.composerSurface) ??
    composer?.parentElement ??
    null;
  if (
    composerRoot === main ||
    composerRoot === doc.body ||
    composerRoot === doc.documentElement
  )
    composerRoot = composer;
  const layers: HTMLElement[] = [];
  function addPath(node: HTMLElement | null) {
    for (
      let depth = 0;
      node && depth < 16;
      depth++, node = node.parentElement
    ) {
      if (
        node === doc.body ||
        node === doc.documentElement ||
        node === main ||
        own(node)
      )
        break;
      if (["DIV", "FORM", "SECTION", "TEXTAREA"].includes(node.tagName))
        layers.push(node);
      if (node === composerRoot) break;
    }
  }
  if (composerRoot && composer) {
    addPath(composer);
    // Tool/send wrappers receive the same surface; buttons retain accessible native behavior.
    composerRoot
      .querySelectorAll<HTMLElement>("button")
      .forEach((b) => addPath(b.parentElement));
    composerRoot
      .querySelectorAll<HTMLElement>(S.composerSurface)
      .forEach((e) => layers.push(e));
  }
  const outer: HTMLElement[] = [];
  let ancestor = composerRoot?.parentElement ?? null;
  for (
    let depth = 0;
    ancestor && depth < 8;
    depth++, ancestor = ancestor.parentElement
  ) {
    if (
      ancestor === doc.body ||
      ancestor === doc.documentElement ||
      ancestor === main ||
      ancestor.querySelector(`${S.turn},${messageSelector}`) ||
      own(ancestor)
    )
      break;
    outer.push(ancestor);
  }
  const surfaces: HTMLElement[] = [];
  for (let e = main, depth = 0; e && depth < 12; depth++, e = e.parentElement) {
    if (own(e)) break;
    surfaces.push(e);
    if (e === doc.body) break;
  }
  return {
    sidebar,
    composer,
    composerRoot,
    composerLayers: unique(layers),
    composerOuter: outer,
    pageSurfaces: surfaces,
  };
}
