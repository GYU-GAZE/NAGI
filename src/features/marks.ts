/** Reversible attribute ownership, including detached React nodes. */
export class Marks {
  private values = new Map<string, Map<HTMLElement, string | null>>();
  set(name: string, nodes: Iterable<HTMLElement>, value = "") {
    const old = this.values.get(name) ?? new Map<HTMLElement, string | null>();
    const next = new Set(nodes);
    for (const [node, original] of old)
      if (!next.has(node)) {
        if (original === null) node.removeAttribute(name);
        else node.setAttribute(name, original);
        old.delete(node);
      }
    for (const node of next) {
      if (!old.has(node)) old.set(node, node.getAttribute(name));
      if (node.getAttribute(name) !== value) node.setAttribute(name, value);
    }
    this.values.set(name, old);
  }
  clear() {
    for (const name of this.values.keys()) this.set(name, []);
    this.values.clear();
  }
}
