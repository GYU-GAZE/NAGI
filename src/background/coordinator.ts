import {
  emptySelection,
  type Owner,
  type SendLock,
  type State,
  type Command,
  type Selection,
} from "../shared/model";
import { migrate, reduce } from "../shared/validation";
export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}
export class Coordinator {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private local: KV,
    private session: KV,
    private now = Date.now,
  ) {}
  atomic<T>(action: () => Promise<T>): Promise<T> {
    const task = this.queue.then(action);
    this.queue = task.catch(() => {});
    return task;
  }
  state() {
    return this.atomic(() => this.read());
  }
  private async read() {
    return migrate(await this.local.get("nagi"));
  }
  mutate(command: Command) {
    return this.atomic(async () => {
      const state = reduce(await this.read(), command);
      await this.local.set("nagi", state);
      return state;
    });
  }
  lock() {
    return this.atomic(
      async () =>
        ((await this.session.get("lock")) as SendLock | undefined) ?? null,
    );
  }
  acquire(owner: Owner, personaId: string | null) {
    return this.atomic(async () => {
      const existing = (await this.session.get("lock")) as
        | SendLock
        | null
        | undefined;
      if (existing) return { acquired: false, lock: existing };
      const s = await this.read();
      const p = s.personas.find((p) => p.id === personaId);
      if (personaId && !p)
        throw new Error("Persona removida. Selecione novamente.");
      const lock: SendLock = {
        ...owner,
        token: crypto.randomUUID(),
        personaId,
        personaName: p?.name ?? "ChatGPT",
        createdAt: this.now(),
        phase: "reserved",
        orphaned: false,
      };
      await this.session.set("lock", lock);
      return { acquired: true, lock };
    });
  }
  update(owner: Owner, token: string, action: "generating" | "release") {
    return this.atomic(async () => {
      const lock = (await this.session.get("lock")) as SendLock | null;
      if (
        !lock ||
        lock.token !== token ||
        lock.tabId !== owner.tabId ||
        lock.instanceId !== owner.instanceId
      )
        throw new Error("Trava pertence a outra transacao.");
      await this.session.set(
        "lock",
        action === "release" ? null : { ...lock, phase: "generating" },
      );
      return true;
    });
  }
  orphan(tabId: number, instanceId?: string) {
    return this.atomic(async () => {
      const lock = (await this.session.get("lock")) as SendLock | null;
      if (
        lock?.tabId === tabId &&
        (!instanceId || lock.instanceId !== instanceId)
      )
        await this.session.set("lock", { ...lock, orphaned: true });
    });
  }
  recover(expectedToken: string) {
    return this.atomic(async () => {
      const lock = (await this.session.get("lock")) as SendLock | null;
      if (lock?.token !== expectedToken)
        throw new Error("A trava mudou. Confira novamente.");
      await this.session.set("lock", null);
      return true;
    });
  }
  selection(tabId: number, key: string, value?: Selection) {
    return this.atomic(async () => {
      const storageKey = `view:${tabId}:${key}`;
      if (value) {
        await this.session.set(storageKey, value);
        return value;
      }
      return (
        ((await this.session.get(storageKey)) as Selection) ?? emptySelection()
      );
    });
  }
}
