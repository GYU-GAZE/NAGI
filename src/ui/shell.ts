import { ConversationPanel } from "./conversation-panel";
import type { ConversationService } from "../conversation/service";
import { el, button, select, checkbox, note, uiCSS } from "./dom";
import { SettingsUI, type SettingsContext } from "./settings";
import { IsolatedPanel } from "./isolated-panel";
import { AuxiliaryPanels } from "../features/auxiliary-panels";
import { ContextHeaderBridge } from "../features/context-header";
import { PromptNavigator } from "../features/prompt-navigator";
import { ContextBar } from "./context-bar";
import { icon } from "./icons";
import { networkCSS } from "./network-css";
import { ModeSwitcher } from "./mode-switcher";
import { resolveProjectsControl } from "../adapter/projects";
import {
  resolveChatRows,
  resolveSidebarControl,
  resolveProjectsExpansion,
  nativePin,
  nativeChatMenu,
  pinChat,
  type SidebarDestination,
  type NativeChatRow,
} from "../adapter/navigation";
import {
  NavigationDock,
  type NavigationDockTarget,
} from "../features/navigation-dock";
import { isModeSelectionPage } from "../adapter/modes";
import { HeaderIntegration } from "../features/header";
import type { State, Selection, Chain, Phase } from "../shared/model";
import type { ChatGPTAdapter, Snapshot } from "../adapter/chatgpt";
import type { Client } from "../shared/platform";
export interface ShellContext extends SettingsContext {
  conversations?: ConversationService;
  adapter: ChatGPTAdapter;
  selection(): Selection;
  setSelection(s: Selection): Promise<void>;
  pause(): void;
  diagnostics(): object;
}
export class Shell {
  readonly host = el("div");
  private shadow: ShadowRoot;
  private isolated: IsolatedPanel;
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
  private header = new HeaderIntegration();
  private nativeContext = new ContextHeaderBridge();
  private auxiliaryPanels = new AuxiliaryPanels();
  private modes = new ModeSwitcher((text) => this.message(text));
  private prompts: PromptNavigator;
  private conversationPanel?: ConversationPanel;
  private context: ContextBar;
  private navigationDock = new NavigationDock();
  private shortcutSlots = new Map<SidebarDestination, HTMLElement>();
  private rowTargets: NavigationDockTarget[] = [];
  private navigationBody: HTMLElement | null = null;
  private navigationRows: NativeChatRow[] = [];
  private navigationKey = "";
  private resizeObserver: ResizeObserver | null = null;
  private onResize = () => this.updateHeader();
  constructor(private ctx: ShellContext) {
    this.prompts = new PromptNavigator(() => this.open("prompts"),ctx.conversations);
    if(ctx.conversations)this.conversationPanel=new ConversationPanel(ctx.conversations,this.prompts);
    this.context = new ContextBar(kind=>this.open(kind),this.prompts.host,this.modes.host);
    this.host.dataset.nagiOwned = "shell";
    this.host.id = "nagi-root";
    this.shadow = this.host.attachShadow({ mode: "open" });
    const style = el("style", uiCSS + networkCSS);
    this.bar.className = "bar";
    this.bar.setAttribute("aria-label", "nAGI");
    this.panel.className = "panel";
    this.panel.hidden = true;
    this.panel.setAttribute("role", "region");
    this.panel.setAttribute("aria-label", "Painel nAGI");
    this.messages.setAttribute("aria-live", "polite");
    this.shadow.append(style, this.bar, this.context.host, this.messages);
    document.body.append(this.host);
    this.isolated = new IsolatedPanel(this.panel, () => this.close());
    this.navigationDock.watchFrame(this.isolated.frame);
    window.addEventListener("resize", this.onResize);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(this.bar);
      this.resizeObserver.observe(this.context.host);
    }
    this.shadow.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") {
        this.close();
        e.stopPropagation();
      }
    });
  }
  render() {
    const s = this.ctx.state().settings;
    this.host.toggleAttribute(
      "data-network-shell",
      s.enabled && s.navigation === "topbar" && s.layout.variant === "network",
    );
    this.context.host.hidden = !this.host.hasAttribute("data-network-shell");
    this.isolated.place(!s.enabled || s.navigation === "native");
    this.host.style.cssText =
      s.enabled && s.navigation === "topbar"
        ? "position:fixed;z-index:2147483600;top:8px;left:50%;transform:translateX(-50%);"
        : "position:fixed;z-index:2147483600;bottom:16px;right:16px;";
    this.navigationDock.refresh([]);
    this.shortcutSlots.clear();
    if (!s.enabled || s.navigation === "native") this.close();
    this.bar.replaceChildren();
    if (!s.enabled || s.navigation === "native") {
      this.bar.append(
        button(
          s.enabled ? "Configurações nAGI" : "nAGI pausado · abrir controles",
          () => this.open("settings"),
          "⚙",
        ),
      );
      this.updateHeader();
      return;
    }
    if (s.layout.variant === "network") {
      this.renderNetwork();
      this.updateHeader();
      return;
    }
    this.bar.append(
      el("span", "nAGI", "brand"),
      button("Novo chat", () => this.ctx.adapter.newChat(), "+"),
      button("Chats recentes", () => this.open("recent"), "◷"),
      button("Chats pinnados", () => this.open("pinned"), "♧"),
      button("Projects", () => this.open("projects"), "▱"),
    );
    for (const [kind, label] of this.destinations()) {
      const slot = button(label, () =>
        this.message(
          `${label} ainda não foi carregado na navegação do ChatGPT.`,
        ),
      );
      this.shortcutSlots.set(kind, slot);
      this.bar.append(slot);
    }
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
    this.updateHeader();
  }
  private renderNetwork() {
    const s = this.ctx.state().settings;
    const brand = el("div", undefined, "brand");
    brand.append(
      el("span", "nAGI", "brand-word"),
      el(
        "span",
        "MORE CONTEXT.\nDEEPER THOUGHT.\nA BRIGHTER YOU.",
        "brand-note",
      ),
    );
    const tool = (
      label: string,
      name: string,
      run: () => void,
      small = false,
    ) => {
      const b = button(label, run);
      b.className = small ? "tool tool-small" : "tool";
      b.replaceChildren(icon(name));
      if (!small) b.append(el("span", label));
      return b;
    };
    const home = el("a", undefined, "tool");
    home.href = "https://chatgpt.com/";
    home.title = "Início";
    home.setAttribute("aria-label", "Início");
    home.append(icon("home"), el("span", "Início"));
    this.bar.append(
      brand,
      home,
      tool("Novo chat", "plus", () => this.ctx.adapter.newChat()),
      tool("Chats recentes", "recent", () => this.open("recent")),
      tool("Chats pinnados", "pin", () => this.open("pinned")),
      tool("Projects", "folder", () => this.open("projects")),
    );
    for (const [kind, label] of this.destinations()) {
      const slot = tool(label, kind, () =>
        this.message(
          `${label} ainda não foi carregado na navegação do ChatGPT.`,
        ),
      );
      this.shortcutSlots.set(kind, slot);
      this.bar.append(slot);
    }
    if (s.chains)
      this.bar.append(
        tool("Conversation Chains", "chain", () => this.open("chains")),
      );
    this.bar.append(
      tool("Configurações", "settings", () => this.open("settings")),
    );
    if (s.personas) {
      this.identity = el("div", undefined, "identity");
      this.avatar = el("img");
      this.avatar.alt = "";
      this.name = el("span", undefined, "name");
      this.dot = el("i", undefined, "state-dot");
      this.identity.append(this.avatar, this.name, this.dot, el("span", "⌄"));
      const answer = button("Answer with…", () => this.open("answer"));
      answer.className = "answer-choice";
      answer.replaceChildren(
        el("span", "Answer with:", "answer-label"),
        this.identity,
      );
      this.bar.append(answer);
      this.updateIdentity();
    } else this.bar.append(el("span", undefined, "spacer"));
    if (s.debug)
      this.bar.append(
        tool("Diagnóstico", "debug", () => this.open("debug"), true),
      );
    this.bar.append(
      tool(
        "Mostrar sidebar original",
        "sidebar",
        () => {
          void this.ctx.client
            .mutate({
              type: "settings",
              patch: { hideSidebar: !this.ctx.state().settings.hideSidebar },
            })
            .then((st) => this.ctx.refresh(st))
            .catch((e) => this.message(String(e)));
        },
        true,
      ),
      tool("Pausar nAGI", "pause", () => this.ctx.pause(), true),
    );
  }
  private updateHeader() {
    const s = this.ctx.state().settings;
    const network =
      s.enabled && s.navigation === "topbar" && s.layout.variant === "network";
    const root = document.documentElement;
    const canSwitchMode =
      network && s.layout.contextBar && isModeSelectionPage();
    this.modes.update(canSwitchMode);
    if (network) {
      this.header.refresh({ ...s, navigation: "native" }, 0);
      this.host.removeAttribute("data-nagi-header-shell");
      this.context.update(
        this.ctx.state(),
        this.ctx.selection(),
        this.ctx.snapshot!(),
        this.ctx.adapter.projects(),
      );
      this.prompts.update(s.layout.promptNavigator, s.reduceMotion);
      const integrated = this.nativeContext.refresh(
        this.context.nativeSlot,
        true,
        canSwitchMode ? this.modes.nativeSlot : undefined,
      );
      this.modes.setDocked(integrated.modeDocked);
      const height =
        this.bar.getBoundingClientRect().height +
        this.context.host.getBoundingClientRect().height;
      root.style.setProperty("--nagi-shell-height", `${height || 140}px`);
    } else {
      this.nativeContext.refresh(this.context.nativeSlot, false);
      this.prompts.update(false, s.reduceMotion);
      root.style.removeProperty("--nagi-shell-height");
      const integrated = this.header.refresh(
        s,
        this.bar.getBoundingClientRect().width,
      );
      this.host.toggleAttribute("data-nagi-header-shell", integrated);
    }
    this.auxiliaryPanels.apply(network);
    this.isolated.resize();
    this.refreshNavigation();
  }
  update(snapshot: Snapshot) {
    this.currentPhase = snapshot.phase;
    this.updateIdentity();
    this.updateHeader();
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
    this.prompts.panelClosed();
    this.conversationPanel?.close();
    this.rowTargets = [];
    this.navigationBody = null;
    this.navigationRows = [];
    this.navigationKey = "";
    this.isolated.hide();
    this.menu = null;
    this.refreshNavigation();
    this.lastFocus?.focus();
  }
  open(kind: string) {
    if (this.menu === kind) {
      this.close();
      return;
    }
    this.rowTargets = [];
    this.navigationBody = null;
    this.navigationRows = [];
    this.navigationKey = "";
    this.menu = kind;
    this.lastFocus = this.shadow.activeElement as HTMLElement | null;
    this.panel.replaceChildren();
    this.isolated.show();
    const head = el("div", undefined, "panel-head");
    const title = (
      {
        settings: "Configurações",
        debug: "Diagnóstico",
        recent: "Chats recentes",
        pinned: "Chats pinnados",
        projects: "Projects",
        chains: "Conversation Chains",
        answer: "Answer with…",
        prompts: "Navigator", search:"Busca local", bookmarks:"Favoritos e notas", outline:"Outline", tree:"Árvore observada",
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
    if (kind === "recent" || kind === "pinned") {
      this.navigationBody = body;
      this.renderChatNavigation();
    }
    if (kind === "projects") {
      const links = this.ctx.adapter.projects();
      const list = el("div", undefined, "list");
      for (const link of links) {
        const a = el("a", link.title);
        a.href = link.url;
        list.append(a);
      }
      body.append(
        list,
        note(
          links.length
            ? "Projetos carregados pelo ChatGPT nesta página. A lista pode não incluir projetos ainda não carregados."
            : "Nenhum projeto foi carregado nesta página ainda.",
        ),
      );
      const expand = resolveProjectsExpansion();
      if (expand)
        body.append(
          button("Carregar projetos da sidebar", () => {
            expand.click();
            // Rendering remains on this page; refresh reads whatever the native UI loads.
          }),
        );
      body.append(
        button("Atualizar projetos", () => {
          this.menu = null;
          this.open("projects");
        }),
      );
      const native = resolveProjectsControl();
      if (native)
        body.append(
          button("Ver todos no ChatGPT", () => {
            this.close();
            native.click();
          }),
        );
    }
    if (kind === "prompts") this.prompts.renderList(body, () => this.close());
    if (["search","bookmarks","outline","tree"].includes(kind)) this.conversationPanel?.render(body,kind);
    if (kind === "answer") this.answer(body);
    if (kind === "chains") this.chains(body);
    this.isolated.resize();
    this.refreshNavigation();
    (
      body.querySelector("input,select,button,a") as HTMLElement | null
    )?.focus();
  }
  private destinations(): [SidebarDestination, string][] {
    return [
      ["scheduled", "Scheduled"],
      ["plugins", "Plugins"],
      ["codex", "Codex"],
      ["more", "More"],
    ];
  }
  private renderChatNavigation() {
    const body = this.navigationBody;
    if (!body || !["recent", "pinned"].includes(this.menu || "")) return;
    // Keep active native menus attached to the same live trigger until dismissed.
    if (
      [
        ...document.querySelectorAll<HTMLElement>("[role=menu],[role=dialog]"),
      ].some(
        (n) =>
          !n.closest("[hidden],[data-state=closed]") &&
          n.ownerDocument.defaultView!.getComputedStyle(n).display !== "none" &&
          n.ownerDocument.defaultView!.getComputedStyle(n).visibility !==
            "hidden",
      ) &&
      this.navigationKey
    )
      return;
    const rows = resolveChatRows().filter(
      (r) => this.menu !== "pinned" || r.pinned,
    );
    const key = JSON.stringify(rows.map((r) => [r.id, r.title, r.pinned]));
    if (
      key === this.navigationKey &&
      rows.every((r, i) => r.row === this.navigationRows[i]?.row)
    )
      return;
    this.navigationRows = rows;
    this.navigationKey = key;
    body.replaceChildren();
    this.rowTargets = [];
    const list = el("div", undefined, "list native-chat-list");
    for (const item of rows) {
      const slot = el("div", undefined, "native-chat-slot");
      slot.style.cssText = "height:44px;min-height:44px;width:100%";
      slot.setAttribute("aria-hidden", "true");
      const row = el("div");
      row.style.cssText = "display:flex;gap:6px;align-items:center;min-width:0";
      slot.style.flex = "1";
      row.append(slot);
      if (!nativePin(item.row) && nativeChatMenu(item.row)) {
        const pin = button(
          item.pinned ? "Unpin chat" : "Pin chat",
          () => {
            pin.disabled = true;
            void pinChat(item.id)
              .then((done) => {
                if (!done)
                  this.message(
                    "Não foi possível reconhecer Pin nesta conversa. Use ⋯ na própria linha para abrir o menu original.",
                  );
                this.navigationKey = "";
                this.refreshNavigation();
              })
              .catch(() =>
                this.message(
                  "Não foi possível acionar Pin. Use o menu ⋯ da conversa.",
                ),
              )
              .finally(() => {
                pin.disabled = false;
              });
          },
          item.pinned ? "◆" : "◇",
        );
        pin.style.flexShrink = "0";
        row.append(pin);
      }
      list.append(row);
      this.rowTargets.push({
        node: item.row,
        sidebar: item.sidebar,
        slot,
        kind: "row",
      });
    }
    body.append(
      list,
      note(
        rows.length
          ? "Controles originais do ChatGPT: use Pin e ⋯ na linha da conversa."
          : this.menu === "pinned"
            ? "Nenhum chat pinnado reconhecido na navegação carregada."
            : "Nenhum chat recente carregado nesta página.",
      ),
    );
    body.append(
      button("Atualizar lista", () => {
        this.navigationKey = "";
        this.renderChatNavigation();
        this.isolated.resize();
        this.refreshNavigation();
      }),
    );
    this.isolated.resize();
  }
  private refreshNavigation() {
    const s = this.ctx.state().settings;
    if (!s.enabled || s.navigation !== "topbar") {
      this.navigationDock.refresh([]);
      return;
    }
    this.renderChatNavigation();
    const targets = [...this.rowTargets];
    for (const [kind, slot] of this.shortcutSlots) {
      const native = resolveSidebarControl(kind);
      if (slot instanceof HTMLButtonElement) slot.disabled = !native;
      slot.title = native
        ? slot.getAttribute("aria-label") || kind
        : `${kind}: não encontrado na navegação carregada`;
      if (native) targets.push({ ...native, slot, kind: "control" });
    }
    this.navigationDock.refresh(targets);
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
    window.removeEventListener("resize", this.onResize);
    this.resizeObserver?.disconnect();
    this.navigationDock.dispose();
    this.nativeContext.dispose();
    this.auxiliaryPanels.dispose();
    this.prompts.dispose();
    this.conversationPanel?.dispose();
    document.documentElement.style.removeProperty("--nagi-shell-height");
    this.header.dispose();
    this.isolated.dispose();
    this.host.remove();
  }
}
