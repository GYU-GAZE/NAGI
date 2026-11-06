import type { ChatGPTAdapter, Snapshot } from "../adapter/chatgpt";
import type { Client } from "../shared/platform";
import type { Selection, State } from "../shared/model";
export interface GuardHooks {
  state(): State;
  selection(): Selection;
  error(message: string, actions?: { label: string; run: () => void }[]): void;
  changed(): void;
}
/** Personas currently affect presentation only. No account write means no cross-tab lock. */
export class SendGuard {
  private creation: { route: string; at: number } | null = null;
  constructor(
    private adapter: ChatGPTAdapter,
    _client: Client,
    private hooks: GuardHooks,
  ) {}
  private validate() {
    const selection = this.hooks.selection();
    const persona = this.hooks
      .state()
      .personas.find((p) => p.id === selection.personaId);
    if (selection.personaId && !persona)
      throw new Error("Persona nao encontrada. Selecione novamente.");
    if (persona?.instructions.trim() && !selection.visualOnly)
      throw new Error(
        `As instrucoes de ${persona.name} ainda nao foram aplicadas ao ChatGPT. Esta versao so oferece identidade visual. Escolha explicitamente “Somente visual” em Answer with para enviar sem aplicar essas instrucoes.`,
      );
  }
  private recordSend() {
    if (!/\/c\/[^/]+\/?$/.test(location.pathname))
      this.creation = { route: location.pathname, at: Date.now() };
  }
  private handler = (event: Event) => {
    if (
      !this.hooks.state().settings.enabled ||
      !this.hooks.state().settings.personas ||
      !this.adapter.isSendEvent(event)
    )
      return;
    try {
      this.validate();
      this.recordSend();
      // Let the original event continue once. Do not replace Enter, submit or click.
    } catch (e) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.hooks.error(e instanceof Error ? e.message : "Falha no envio.");
    }
  };
  private navigation = (event: Event) => {
    const node = event
      .composedPath()
      .find((n) => n instanceof Element && n.matches("a[href]")) as
      | HTMLAnchorElement
      | undefined;
    if (node) this.creation = null;
  };
  install() {
    for (const type of ["click", "keydown", "submit"])
      window.addEventListener(type, this.handler, true);
    window.addEventListener("click", this.navigation, true);
    window.addEventListener("popstate", this.cancelCreation);
  }
  private cancelCreation = () => {
    this.creation = null;
  };
  /** Preserve the new-chat selection when the site assigns its ID, even while phase is unknown. */
  promotesNewChat(snapshot: Snapshot) {
    const creation = this.creation;
    if (!creation || !snapshot.conversation || Date.now() - creation.at > 60000)
      return false;
    const base = creation.route.replace(/\/$/, "").replace(/\/project$/, "");
    return snapshot.route.startsWith(`${base}/c/`);
  }
  update(snapshot: Snapshot) {
    if (
      this.creation &&
      (snapshot.route !== this.creation.route ||
        Date.now() - this.creation.at > 60000)
    )
      this.creation = null;
  }
  async send() {
    try {
      this.validate();
      this.recordSend();
      this.adapter.sendOriginal();
    } catch (e) {
      this.hooks.error(e instanceof Error ? e.message : "Falha no envio.");
    }
  }
  dispose() {
    for (const type of ["click", "keydown", "submit"])
      window.removeEventListener(type, this.handler, true);
    window.removeEventListener("click", this.navigation, true);
    window.removeEventListener("popstate", this.cancelCreation);
    this.creation = null;
  }
}
