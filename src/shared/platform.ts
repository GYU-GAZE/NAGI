import { migrate } from "./validation";
import type { Command, State, Selection, SendLock } from "./model";
export interface Reply<T> {
  ok: boolean;
  value?: T;
  error?: string;
}
export interface Client {
  state(): Promise<State>;
  mutate(c: Command): Promise<State>;
  request<T>(type: string, payload?: object): Promise<T>;
  subscribe(fn: (state: State) => void): () => void;
}
export class ExtensionClient implements Client {
  constructor(readonly instanceId = crypto.randomUUID()) {}
  async request<T>(type: string, payload: object = {}): Promise<T> {
    const r = (await chrome.runtime.sendMessage({
      channel: "nagi",
      type,
      instanceId: this.instanceId,
      ...payload,
    })) as Reply<T>;
    if (!r?.ok)
      throw new Error(
        r?.error ?? "Extensao indisponivel. Recarregue a pagina.",
      );
    return r.value as T;
  }
  state() {
    return this.request<State>("state");
  }
  mutate(command: Command) {
    return this.request<State>("mutate", { command });
  }
  subscribe(fn: (s: State) => void) {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === "local" && changes.nagi?.newValue)
        fn(migrate(changes.nagi.newValue));
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }
}
export interface LockReply {
  acquired: boolean;
  lock: SendLock;
}
export interface ViewRecord {
  selection: Selection;
}
