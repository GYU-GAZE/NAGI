import type { ChatGPTAdapter, Snapshot } from "../adapter/chatgpt";
import type { Client, LockReply } from "../shared/platform";
import type { Selection, State, SendLock } from "../shared/model";
export interface GuardHooks {
  state(): State;
  selection(): Selection;
  error(message: string, actions?: { label: string; run: () => void }[]): void;
  changed(): void;
}
export class SendGuard {
  lock: SendLock | null = null;
  private bypass = false;
  private pending = false;
  private sawGeneration = false;
  private startedAt = 0;
  private draft = "";
  private blockedRoute = "";
  private queued: ReturnType<typeof setInterval> | null = null;
  private queueEpoch = 0;
  private releasing = false;
  private target: HTMLElement | null = null;
  private lastLockCheck = 0;
  private navigated = false;
  constructor(
    private adapter: ChatGPTAdapter,
    private client: Client,
    private hooks: GuardHooks,
  ) {}
  private readDraft() {
    const e = this.adapter.composer();
    return e instanceof HTMLTextAreaElement ? e.value : (e?.textContent ?? "");
  }
  private handler = (e: Event) => {
    if (
      this.bypass ||
      !this.hooks.state().settings.enabled ||
      !this.hooks.state().settings.personas ||
      !this.adapter.isSendEvent(e)
    )
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (this.pending || this.lock || this.queued) return;
    void this.send();
  };
  install() {
    for (const type of ["click", "keydown", "submit"])
      window.addEventListener(type, this.handler, true);
  }
  async send() {
    if (this.pending || this.lock) return;
    this.pending = true;
    this.blockedRoute = location.pathname;
    this.draft = this.readDraft();
    this.target = this.adapter.composer();
    try {
      const selection = this.hooks.selection();
      const persona = this.hooks
        .state()
        .personas.find((p) => p.id === selection.personaId);
      if (selection.personaId && !persona)
        throw new Error("Persona nao encontrada. Selecione novamente.");
      if (persona?.instructions.trim() && !selection.visualOnly) {
        throw new Error(
          `As instrucoes de ${persona.name} ainda nao foram aplicadas ao ChatGPT. Esta versao so oferece identidade visual. Escolha explicitamente “Somente visual” em Answer with para enviar sem aplicar essas instrucoes.`,
        );
      }
      if (this.adapter.snapshot().phase !== "idle")
        throw new Error(
          "Estado do ChatGPT incerto ou gerando. Aguarde; o rascunho continua no campo.",
        );
      const result = await this.client.request<LockReply>("lock.acquire", {
        personaId: selection.personaId,
      });
      if (!result.acquired) {
        this.hooks.error(
          `Outra aba reservou o envio: ${result.lock.personaName}${result.lock.orphaned ? " (aba desconectada; confira a recuperacao nas configuracoes)" : ""}.`,
          [
            { label: "Enviar quando disponivel", run: () => this.queue() },
            { label: "Cancelar", run: () => this.cancelQueue() },
          ],
        );
        return;
      }
      this.lock = result.lock;
      this.sawGeneration = false;
      this.startedAt = Date.now();
      this.navigated = false;
      // User may edit/navigate/disable/change persona while lock acquisition awaits storage.
      const current = this.hooks.selection();
      const config = this.hooks.state();
      const currentPersona = config.personas.find(
        (p) => p.id === selection.personaId,
      );
      if (
        location.pathname !== this.blockedRoute ||
        this.readDraft() !== this.draft ||
        this.adapter.composer() !== this.target ||
        !config.settings.enabled ||
        !config.settings.personas ||
        current.personaId !== selection.personaId ||
        current.visualOnly !== selection.visualOnly ||
        currentPersona?.version !== persona?.version
      )
        throw new Error("O rascunho ou a selecao mudou. Envie novamente.");
      this.bypass = true;
      try {
        this.adapter.sendOriginal();
      } finally {
        this.bypass = false;
      }
      this.hooks.changed();
    } catch (e) {
      if (this.lock && !this.sawGeneration)
        await this.release().catch(() => {});
      this.hooks.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      this.pending = false;
    }
  }
  private queue() {
    if (this.queued) return;
    const selection = JSON.stringify(this.hooks.selection());
    const epoch = ++this.queueEpoch;
    let checking = false;
    const unchanged = () =>
      location.pathname === this.blockedRoute &&
      this.readDraft() === this.draft &&
      JSON.stringify(this.hooks.selection()) === selection &&
      this.hooks.state().settings.enabled &&
      this.hooks.state().settings.personas;
    this.hooks.error(
      "Envio aguardando outra aba. Alterar o rascunho, Persona ou conversa cancela a espera.",
      [{ label: "Cancelar espera", run: () => this.cancelQueue() }],
    );
    this.queued = setInterval(() => {
      if (checking) return;
      checking = true;
      void (async () => {
        if (!unchanged()) {
          this.cancelQueue();
          this.hooks.error("Espera cancelada porque o contexto mudou.");
          return;
        }
        const currentLock = await this.client.request<SendLock | null>(
          "lock.get",
        );
        const free =
          !currentLock ||
          currentLock.personaId === this.hooks.selection().personaId;
        if (epoch !== this.queueEpoch) return;
        if (!unchanged()) {
          this.cancelQueue();
          this.hooks.error("Espera cancelada porque o contexto mudou.");
          return;
        }
        if (free) {
          this.cancelQueue();
          await this.send();
        }
      })()
        .catch(() => {
          this.cancelQueue();
          this.hooks.error("Conexao com a extensao perdida. Envio cancelado.");
        })
        .finally(() => (checking = false));
    }, 1200);
  }
  cancelQueue() {
    if (this.queued) clearInterval(this.queued);
    this.queued = null;
    this.queueEpoch++;
  }
  update(snapshot: Snapshot) {
    if (!this.lock || this.releasing) return;
    if (Date.now() - this.lastLockCheck > 5000) {
      this.lastLockCheck = Date.now();
      const token = this.lock.token;
      void this.client
        .request<SendLock | null>("lock.get", { token })
        .then((current) => {
          if (this.lock?.token === token && current?.token !== token) {
            this.lock = null;
            this.hooks.changed();
          }
        })
        .catch(() => {});
    }
    if (snapshot.route !== this.blockedRoute) {
      // New-chat sends may receive their canonical conversation URL while streaming.
      if (
        !this.blockedRoute.includes("/c/") &&
        snapshot.conversation &&
        (snapshot.phase === "thinking" || snapshot.phase === "talking")
      )
        this.blockedRoute = snapshot.route;
      else {
        if (!this.navigated) {
          this.navigated = true;
          this.hooks.error(
            "A conversa mudou durante o envio. A trava foi mantida; confira a resposta anterior antes de liberar nas configuracoes.",
          );
        }
        return;
      }
    }
    if (snapshot.phase === "thinking" || snapshot.phase === "talking") {
      if (!this.sawGeneration) {
        this.sawGeneration = true;
        void this.client
          .request("lock.generating", { token: this.lock.token })
          .catch(() =>
            this.hooks.error(
              "Nao foi possivel confirmar a trava. Verifique a recuperacao antes de outro envio.",
            ),
          );
      }
    } else if (snapshot.phase === "idle" && this.sawGeneration) {
      void this.release().catch((e) => this.hooks.error(String(e)));
    } else if (!this.sawGeneration && Date.now() - this.startedAt > 15000) {
      this.startedAt = Infinity;
      this.hooks.error(
        "Nao foi possivel confirmar o inicio da resposta. A trava foi mantida. Confira o ChatGPT antes de liberar nas configuracoes.",
      );
    }
  }
  async release() {
    if (!this.lock || this.releasing) return;
    this.releasing = true;
    try {
      await this.client.request("lock.release", { token: this.lock.token });
      this.lock = null;
      this.hooks.changed();
    } finally {
      this.releasing = false;
    }
  }
  dispose() {
    this.cancelQueue();
    for (const type of ["click", "keydown", "submit"])
      window.removeEventListener(
        type,
        this.handler,
        true,
      ); /* A possibly active generation retains its persisted lock. */
  }
}
