import { StateVault } from "./state-vault";
import { validateContinuation } from "../conversation/handoff";
import { ConversationStore } from "../conversation/storage";
const conversations = new ConversationStore();
import { Coordinator, type KV } from "./coordinator";
import type { Selection } from "../shared/model";
const area = (storage: chrome.storage.StorageArea): KV => ({
  get: async (key) => (await storage.get(key))[key],
  set: async (key, value) => {
    await storage.set({ [key]: value });
  },
});
const vault = new StateVault(conversations,area(chrome.storage.local));
const coordinator = new Coordinator(
  vault,
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
      case "index.load":
        if (typeof m.conversationId !== "string" || m.conversationId.length > 200) throw new Error("Conversa inválida");
        return conversations.load(m.conversationId);
      case "index.write": return coordinator.atomic(async()=> {
        const state=await vault.get("nagi") as import("../shared/model").State;
        if(m.generation!==state.indexGeneration)throw new Error("Estado mudou; recarregue a conversa antes de salvar o índice");
        return conversations.write(m.messages,m.annotations??[]);
      });
      case "index.preference": return conversations.preference(m.key, m.value);
      case "index.export": return conversations.dump();
      case "backup.export": return coordinator.atomic(async()=>{await vault.get('nagi');return conversations.backup();});
      case "backup.recovery": return coordinator.atomic(()=>conversations.recoveryBackup());
      case "backup.import": return coordinator.atomic(async()=>{
        const current=await vault.get('nagi') as import('../shared/model').State;
        if(m.expectedRevision!==current.revision)throw new Error('Dados mudaram em outra aba. Reabra a importação.');
        const state=await conversations.importBackup(m.backup,current.revision,current.indexGeneration);await vault.notify(state);return state;
      });
      case "continuation": {
        if(!isChat) throw new Error("Aba indisponível");
        const key=`continuation:${tabId}`;
        if(m.value===null) {await chrome.storage.session.remove(key);return null;}
        if(m.value!==undefined) {validateContinuation(m.value);await chrome.storage.session.set({[key]:m.value});return m.value;}
        return (await chrome.storage.session.get(key))[key] ?? null;
      }
      case "state":
        return coordinator.state();
      case "mutate":
        return coordinator.mutate(m.command);
      case "lock.get":
        return coordinator.lock(
          typeof m.token === "string" ? m.token : undefined,
        );
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
