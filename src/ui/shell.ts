import { el, button, select, checkbox, note, uiCSS } from "./dom";
import { SettingsUI, type SettingsContext } from "./settings";
import type { State, Selection, Chain, Phase } from "../shared/model";
import type { ChatGPTAdapter, Snapshot } from "../adapter/chatgpt";
import type { Client } from "../shared/platform";
export interface ShellContext extends SettingsContext {
  adapter: ChatGPTAdapter;
  selection(): Selection;
  setSelection(s: Selection): Promise<void>;
  pause(): void;
  diagnostics(): object;
}
export class Shell {
  readonly host = el("div");
  private shadow: ShadowRoot;
  private bar = el("nav");
  private panel = el("section");
  private messages = el("div");
  private identity = el("div");
  private name = el("span");
  private avatar = el("img");
  private dot = el("i");
  private stateLabel = el("span");
  private menu: string | null = null;
  private lastFocus: HTMLElement | null = null;
  private currentPhase: Phase = "unknown";
  constructor(private ctx: ShellContext) {
    this.host.dataset.nagiOwned = "shell";
    this.host.id = "nagi-root";
    this.shadow = this.host.attachShadow({ mode: "open" });
    const style = el("style", uiCSS);
    this.bar.className = "bar";
    this.bar.setAttribute("aria-label", "nAGI");
    this.panel.className = "panel";
    this.panel.hidden = true;
    this.panel.setAttribute("role", "region");
    this.panel.setAttribute("aria-label", "Painel nAGI");
    this.messages.setAttribute("aria-live", "polite");
    this.shadow.append(style, this.bar, this.panel, this.messages);
    document.body.append(this.host);
    this.shadow.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") {
        this.close();
        e.stopPropagation();
      }
    });
  }
  render() {
    const s = this.ctx.state().settings;
    this.host.style.cssText =
      s.enabled && s.navigation === "topbar"
        ? "position:fixed;z-index:2147483600;top:8px;left:50%;transform:translateX(-50%);"
        : "position:fixed;z-index:2147483600;bottom:16px;right:16px;";
    this.bar.replaceChildren();
    if (!s.enabled || s.navigation === "native") {
      this.bar.append(
        button(
          s.enabled ? "Configurações nAGI" : "nAGI pausado · abrir controles",
          () => this.open("settings"),
          "⚙",
        ),
      );
      return;
    }
    this.bar.append(
      el("span", "nAGI", "brand"),
      button("Novo chat", () => this.ctx.adapter.newChat(), "+"),
      button("Chats recentes", () => this.open("recent"), "◷"),
      button("Projects", () => this.open("projects"), "▱"),
    );
    if (s.chains)
      this.bar.append(
        button("Conversation Chains", () => this.open("chains"), "⛓"),
      );
    this.bar.append(el("span", undefined, "sep"));
    if (s.personas) {
      this.identity = el("div", undefined, "identity");
      this.avatar = el("img");
      this.avatar.alt = "";
      this.name = el("span", undefined, "name");
      this.dot = el("i", undefined, "state-dot");
      this.stateLabel = el("span", undefined, "badge");
      const answer = button("Answer with…", () => this.open("answer"));
      answer.replaceChildren(this.identity);
      this.identity.append(this.avatar, this.name, this.dot);
      this.bar.append(answer);
      this.updateIdentity();
    }
    if (s.debug)
      this.bar.append(button("Diagnóstico", () => this.open("debug"), "⌘"));
    this.bar.append(
      button(
        "Mostrar sidebar original",
        () => {
          this.ctx.adapter.showSidebar(true);
          void this.ctx.client
            .mutate({ type: "settings", patch: { hideSidebar: false } })
            .then((st) => this.ctx.refresh(st))
            .catch((e) => this.message(String(e)));
        },
        "☰",
      ),
      button("Configurações", () => this.open("settings"), "⚙"),
      button("Pausar nAGI", () => this.ctx.pause(), "⏻"),
    );
  }
  update(snapshot: Snapshot) {
    this.currentPhase = snapshot.phase;
    this.updateIdentity();
  }
  private updateIdentity() {
    const state = this.ctx.state();
    const p = state.personas.find(
      (p) => p.id === this.ctx.selection().personaId,
    );
    const s = state.settings;
    const phase = this.currentPhase === "unknown" ? "idle" : this.currentPhase;
    const image = p?.avatars[phase] ?? p?.avatars.idle;
    this.avatar.hidden = !s.showAvatar || !image;
    if (image && this.avatar.getAttribute("src") !== image)
      this.avatar.src = image;
    if (!image) this.avatar.removeAttribute("src");
    this.name.textContent = p?.name ?? "ChatGPT";
    this.name.hidden = !s.showName;
    this.dot.dataset.state = this.currentPhase;
    this.dot.title = `Estado estimado: ${this.currentPhase}`;
    this.identity.title = `${p?.name ?? "ChatGPT"} · ${this.currentPhase} · instruções da conta sem alteração`;
  }
  message(text: string, actions: { label: string; run: () => void }[] = []) {
    this.messages.replaceChildren();
    const box = el("div", undefined, "message");
    box.append(el("p", text));
    const row = el("div", undefined, "actions");
    for (const a of actions) row.append(button(a.label, a.run));
    row.append(
      button("Fechar aviso", () => this.messages.replaceChildren(), "×"),
    );
    box.append(row);
    this.messages.append(box);
  }
  close() {
    this.panel.hidden = true;
    this.menu = null;
    this.lastFocus?.focus();
  }
  open(kind: string) {
    if (this.menu === kind) {
      this.close();
      return;
    }
    this.menu = kind;
    this.lastFocus = this.shadow.activeElement as HTMLElement | null;
    this.panel.replaceChildren();
    this.panel.hidden = false;
    const head = el("div", undefined, "panel-head");
    const title = (
      {
        settings: "Configurações",
        debug: "Diagnóstico",
        recent: "Chats recentes",
        projects: "Projects",
        chains: "Conversation Chains",
        answer: "Answer with…",
      } as Record<string, string>
    )[kind];
    head.append(
      el("h2", title),
      button("Fechar painel", () => this.close(), "×"),
    );
    const body = el("div", undefined, "body");
    this.panel.append(head, body);
    if (kind === "settings" || kind === "debug") {
      new SettingsUI(body, this.ctx).render(
        kind === "debug" ? "Diagnóstico" : "Geral",
      );
    }
    if (kind === "recent" || kind === "projects") {
      const links =
        kind === "recent"
          ? this.ctx.adapter.recent()
          : this.ctx.adapter.projects();
      const list = el("div", undefined, "list");
      for (const link of links) {
        const a = el("a", link.title);
        a.href = link.url;
        list.append(a);
      }
      body.append(
        list,
        note(
          "Somente links já carregados na navegação do ChatGPT. A ordem acompanha o site.",
        ),
      );
      if (!links.length)
        body.prepend(
          note(
            "Nenhum link reconhecido. Abra a sidebar original para carregar a navegação.",
          ),
        );
      body.append(
        button("Abrir sidebar original", () => {
          void this.ctx.client
            .mutate({ type: "settings", patch: { hideSidebar: false } })
            .then((s) => {
              this.ctx.refresh(s);
              this.ctx.adapter.showSidebar(true);
            })
            .catch((e) => this.message(String(e)));
        }),
      );
    }
    if (kind === "answer") this.answer(body);
    if (kind === "chains") this.chains(body);
    (
      body.querySelector("input,select,button,a") as HTMLElement | null
    )?.focus();
  }
  private answer(body: HTMLElement) {
    const current = this.ctx.selection();
    const s = this.ctx.state();
    const choice = select(
      [
        ["", "ChatGPT · sem Persona"],
        ...s.personas.map((p) => [p.id, p.name] as [string, string]),
      ],
      current.personaId ?? "",
    );
    choice.setAttribute("aria-label", "Persona da conversa");
    body.append(
      choice,
      note(
        "A seleção pertence a esta aba e conversa. Trocar de aba não altera Custom Instructions.",
      ),
    );
    const visual = checkbox(
      "Somente visual · enviar usando as instruções atuais da conta",
      current.visualOnly,
      (v) => {
        void this.ctx
          .setSelection({ ...this.ctx.selection(), visualOnly: v })
          .catch((e) => this.message(String(e)));
      },
    );
    body.append(
      visual,
      note(
        "Instruções da Persona ainda não são aplicadas. Sem essa confirmação, uma Persona com instruções bloqueia o envio. Project Instructions e demais ajustes da conta permanecem sob controle do ChatGPT.",
      ),
    );
    choice.onchange = () => {
      void this.ctx
        .setSelection({
          ...this.ctx.selection(),
          personaId: choice.value || null,
          visualOnly: false,
        })
        .then(() => {
          this.menu = null;
          this.open("answer");
        })
        .catch((e) => this.message(String(e)));
    };
    body.append(
      button("Criar / editar Personas", () => {
        this.menu = null;
        this.open("settings");
        const container = this.panel.querySelector<HTMLElement>(".body")!;
        new SettingsUI(container, this.ctx).render("Personas");
      }),
    );
  }
  private chains(body: HTMLElement) {
    const state = this.ctx.state();
    const selected = state.chains.find(
      (c) => c.id === this.ctx.selection().chainId,
    );
    const choice = select(
      [
        ["", "Nenhuma Chain"],
        ...state.chains.map((c) => [c.id, c.name] as [string, string]),
      ],
      selected?.id ?? "",
    );
    choice.setAttribute("aria-label", "Chain da conversa");
    choice.onchange = () => {
      const c = state.chains.find((c) => c.id === choice.value);
      if (c) this.ctx.selectChain?.(c);
      else
        void this.ctx.setSelection({ ...this.ctx.selection(), chainId: null });
      this.menu = null;
      this.open("chains");
    };
    body.append(choice);
    if (selected) {
      body.append(
        note(
          `${selected.projectId ?? "Sem Project associado"} / ${selected.name}`,
        ),
      );
      const list = el("div", undefined, "list");
      selected.sessions.forEach((s, i) => {
        const a = el(
          "a",
          `${String(i + 1).padStart(2, "0")} · ${s.title}${selected.currentSession === s.id ? " · atual" : ""}`,
        );
        a.href = s.url;
        list.append(a);
      });
      body.append(list);
      const current = this.ctx.snapshot?.().conversation;
      const index = selected.sessions.findIndex((s) => s.id === current?.id);
      const row = el("div", undefined, "row");
      for (const [offset, label] of [
        [-1, "← Anterior"],
        [1, "Próxima →"],
      ] as const) {
        const session = index >= 0 ? selected.sessions[index + offset] : null;
        if (session) {
          const a = el("a", label);
          a.href = session.url;
          row.append(a);
        }
      }
      body.append(row);
      if (current && !selected.sessions.some((s) => s.id === current.id))
        body.append(
          button("Adicionar conversa aberta", () => {
            const c = structuredClone(selected);
            c.sessions.push(current);
            c.currentSession = current.id;
            void this.ctx.client
              .mutate({
                type: "chain.save",
                chain: c,
                expectedVersion: selected.version,
              })
              .then((s) => {
                this.ctx.refresh(s);
                this.menu = null;
                this.open("chains");
              })
              .catch((e) => this.message(String(e)));
          }),
        );
    } else
      body.append(note("Selecione uma Chain ou crie uma nas configurações."));
    body.append(
      button("Organizar Chains", () => {
        this.menu = null;
        this.open("settings");
        new SettingsUI(
          this.panel.querySelector<HTMLElement>(".body")!,
          this.ctx,
        ).render("Chains");
      }),
    );
  }
  dispose() {
    this.host.remove();
  }
}
