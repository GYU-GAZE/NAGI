import { el, button } from "./dom";
import type { State, Selection } from "../shared/model";
import type { Snapshot, NavLink } from "../adapter/chatgpt";
import { resolveHeader, readHeaderContext } from "../adapter/header";
export class ContextBar {
  readonly host = el("section", undefined, "context-strip");
  readonly nativeSlot = el("div", undefined, "native-actions");
  private info = el("div", undefined, "context-info");
  private sessions = el("div", undefined, "chain-nav");
  private key = "";
  constructor(
    private open: (kind: string) => void,
    prompts: HTMLElement,
  ) {
    this.host.setAttribute("aria-label", "Contexto da conversa");
    this.nativeSlot.setAttribute("aria-label", "Ações do ChatGPT");
    this.host.append(this.info, this.sessions, prompts, this.nativeSlot);
  }
  update(
    state: State,
    selection: Selection,
    snapshot: Snapshot,
    projects: NavLink[],
  ) {
    const s = state.settings;
    const chain = s.chains
      ? state.chains.find((c) => c.id === selection.chainId)
      : undefined;
    const persona = s.personas
      ? state.personas.find((p) => p.id === selection.personaId)
      : undefined;
    const native = resolveHeader();
    const nativeContext = readHeaderContext(native);
    const work = nativeContext.work;
    const projectID =
      snapshot.projectId ?? nativeContext.project?.id ?? chain?.projectId;
    const project = [nativeContext.project, ...projects].find(
      (p) => p?.id === projectID,
    );
    const index =
      chain?.sessions.findIndex((v) => v.id === snapshot.conversation?.id) ??
      -1;
    const title =
      nativeContext.title ?? snapshot.conversation?.title ?? "Novo chat";
    const key = JSON.stringify([
      s.layout.contextBar,
      title,
      work,
      projectID,
      project?.title,
      chain?.name,
      index,
      chain?.sessions,
      persona?.name,
    ]);
    this.info.hidden = !s.layout.contextBar;
    this.sessions.hidden = !s.layout.contextBar;
    if (key === this.key) return;
    this.key = key;
    this.info.replaceChildren();
    this.sessions.replaceChildren();
    if (!s.layout.contextBar) return;
    if (projectID) {
      const item = project
        ? el("a", project.title, "context-project")
        : el("span", "Projeto", "context-project");
      if (project) (item as HTMLAnchorElement).href = project.url;
      this.info.append(item, el("span", "/", "divider"));
    }
    const name = el("span", title, "chat-title");
    name.title = title;
    this.info.append(name);
    if (work) this.info.append(el("span", "Work", "context-badge"));
    if (chain) {
      const b = button(`Chain: ${chain.name}`, () => this.open("chains"));
      b.className = "context-badge";
      this.info.append(
        b,
        el(
          "span",
          index >= 0
            ? `${String(index + 1).padStart(2, "0")} / ${chain.sessions.length}`
            : "Não vinculada",
          "session-number",
        ),
      );
    }
    const p = button(`Persona: ${persona?.name ?? "ChatGPT"}`, () =>
      this.open("answer"),
    );
    p.className = "context-badge";
    p.disabled = !s.personas;
    this.info.append(p);
    if (chain && index >= 0)
      for (const [step, label] of [
        [-1, "Sessão anterior da Chain"],
        [1, "Próxima sessão da Chain"],
      ] as const) {
        const session = chain.sessions[index + step];
        if (session) {
          const a = el(
            "a",
            step < 0
              ? `← ${String(index).padStart(2, "0")}`
              : `${String(index + 2).padStart(2, "0")} →`,
          );
          a.href = session.url;
          a.title = label;
          a.setAttribute("aria-label", label);
          this.sessions.append(a);
        } else {
          const b = button(label, () => {}, step < 0 ? "←" : "→");
          b.disabled = true;
          this.sessions.append(b);
        }
      }
  }
}
