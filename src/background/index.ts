import { Coordinator, type KV } from "./coordinator";
import type { Selection } from "../shared/model";
const area = (storage: chrome.storage.StorageArea): KV => ({
  get: async (key) => (await storage.get(key))[key],
  set: async (key, value) => {
    await storage.set({ [key]: value });
  },
});
const coordinator = new Coordinator(
  area(chrome.storage.local),
  area(chrome.storage.session),
);
chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
  if (m?.channel !== "nagi") return;
  const tabId = sender.tab?.id;
  const isExtension =
    sender.id === chrome.runtime.id &&
    !sender.tab &&
    sender.url?.startsWith(chrome.runtime.getURL(""));
  const isChat =
    sender.id === chrome.runtime.id &&
    typeof tabId === "number" &&
    sender.frameId === 0 &&
    sender.url?.startsWith("https://chatgpt.com/");
  if (!isExtension && !isChat) {
    sendResponse({ ok: false, error: "Origem nao autorizada." });
    return;
  }
  async function handle() {
    const owner = { tabId: tabId!, instanceId: String(m.instanceId) };
    switch (m.type) {
      case "state":
        return coordinator.state();
      case "mutate":
        return coordinator.mutate(m.command);
      case "lock.get":
        return coordinator.lock();
      case "lock.recover":
        return coordinator.recover(m.token);
      case "hello":
        if (isChat) await coordinator.orphan(tabId!, m.instanceId);
        return true;
      case "lock.acquire":
        if (isChat) return coordinator.acquire(owner, m.personaId ?? null);
        break;
      case "lock.generating":
        if (isChat) return coordinator.update(owner, m.token, "generating");
        break;
      case "lock.release":
        if (isChat) return coordinator.update(owner, m.token, "release");
        break;
      case "selection": {
        if (!isChat || typeof m.key !== "string" || m.key.length > 200) break;
        if (m.value) {
          const v = m.value as Selection;
          if (
            (v.personaId !== null && typeof v.personaId !== "string") ||
            typeof v.visualOnly !== "boolean" ||
            (v.chainId !== null && typeof v.chainId !== "string")
          )
            throw new Error("Selecao invalida.");
        }
        return coordinator.selection(tabId!, m.key, m.value);
      }
    }
    throw new Error("Operacao indisponivel.");
  }
  void handle().then(
    (value) => sendResponse({ ok: true, value }),
    (e) =>
      sendResponse({
        ok: false,
        error: e instanceof Error ? e.message : "Falha local.",
      }),
  );
  return true;
});
chrome.tabs.onRemoved.addListener((tabId) => {
  void coordinator.orphan(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "loading") void coordinator.orphan(tabId);
});
