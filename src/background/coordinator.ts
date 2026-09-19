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
  private async locks(): Promise<SendLock[]> {
    const current = await this.session.get("locks");
    if (Array.isArray(current)) return current as SendLock[];
    const legacy = (await this.session.get("lock")) as
      | SendLock
      | null
      | undefined;
    return legacy ? [legacy] : [];
  }
  lock(token?: string) {
    return this.atomic(async () => {
      const locks = await this.locks();
      return (token ? locks.find((l) => l.token === token) : locks[0]) ?? null;
    });
  }
  acquire(owner: Owner, personaId: string | null) {
    return this.atomic(async () => {
      const s = await this.read();
      const p = s.personas.find((p) => p.id === personaId);
      if (personaId && !p)
        throw new Error("Persona removida. Selecione novamente.");
      const locks = await this.locks();
      const blocking = locks.find(
        (l) => l.tabId === owner.tabId || l.personaId !== personaId,
      );
      if (blocking) return { acquired: false, lock: blocking };
      const lock: SendLock = {
        ...owner,
        token: crypto.randomUUID(),
        personaId,
        personaName: p?.name ?? "ChatGPT",
        createdAt: this.now(),
        phase: "reserved",
        orphaned: false,
      };
      await this.session.set("locks", [...locks, lock]);
      return { acquired: true, lock };
    });
  }
  update(owner: Owner, token: string, action: "generating" | "release") {
    return this.atomic(async () => {
      const locks = await this.locks();
      const lock = locks.find((l) => l.token === token);
      if (
        !lock ||
        lock.tabId !== owner.tabId ||
        lock.instanceId !== owner.instanceId
      )
        throw new Error("Trava pertence a outra transacao.");
      await this.session.set(
        "locks",
        action === "release"
          ? locks.filter((l) => l.token !== token)
          : locks.map((l) =>
              l.token === token ? { ...l, phase: "generating" } : l,
            ),
      );
      return true;
    });
  }
  orphan(tabId: number, instanceId?: string) {
    return this.atomic(async () => {
      const locks = await this.locks();
      await this.session.set(
        "locks",
        locks.map((l) =>
          l.tabId === tabId && (!instanceId || l.instanceId !== instanceId)
            ? { ...l, orphaned: true }
            : l,
        ),
      );
    });
  }
  recover(expectedToken: string) {
    return this.atomic(async () => {
      const locks = await this.locks();
      if (!locks.some((l) => l.token === expectedToken))
        throw new Error("A trava mudou. Confira novamente.");
      await this.session.set(
        "locks",
        locks.filter((l) => l.token !== expectedToken),
      );
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
