import { PromptHistory } from "./features/prompt-history";
import type { Continuation } from "./conversation/handoff";
import { readDraft, writeDraft } from "./features/composer-draft";
import { ConversationService } from "./conversation/service";
import type { Client } from "./shared/platform";
import {
  emptySelection,
  type State,
  type Selection,
  type Chain,
} from "./shared/model";
import { DOMChatGPTAdapter, type Snapshot } from "./adapter/chatgpt";
import { ComposerIdentity } from "./features/composer-identity";
import { LayoutTheme } from "./features/layout-theme";
import { MessageLayout } from "./features/message-layout";
import { NativeTheme } from "./features/native-theme";
import { Appearance } from "./features/appearance";
import { TurnOptimizer } from "./features/performance";
import { SendGuard } from "./features/send-guard";
import { Shell } from "./ui/shell";
import { createDiagnosticReport } from "./features/diagnostics";
import { VERSION } from "./shared/version";
export async function startApp(client: Client) {
  const state = await client.state();
  let current: State = state;
  let selection = emptySelection();
  let route = "";
  let latest: Snapshot;
  let routeEpoch = 0;
  let selectionReady = false;
  let continuation:Continuation|null=null, continuationHome=false, continuationSent=false, continuationInserted=false, continuationBusy=false;
  const observeSend=(event:Event)=>{
    if(current.settings.enabled&&!event.defaultPrevented&&adapter.isSendEvent(event)){
      const composer=adapter.composer();if(composer)conversations.index.expectPrompt(readDraft(composer));
      if(continuationHome)continuationSent=true;
    }
  };
  const cancelContinuationNavigation=(event:Event)=>{const anchor=(event.target as Element)?.closest?.('a[href]');if(anchor&&/\/c\//.test(anchor.getAttribute('href')||'')){continuationSent=false;continuationHome=false;}};
  const conversations = new ConversationService(client,state.indexGeneration);
  const adapter = new DOMChatGPTAdapter();
  const appearance = new Appearance();
  const optimizer = new TurnOptimizer();
  const layout = new LayoutTheme();
  const nativeTheme = new NativeTheme();
  const messages = new MessageLayout();
  let shell: Shell;
  const composerIdentity = new ComposerIdentity(() => shell.open("answer"));
  const errors: string[] = [];
  const safe = (name: string, fn: () => void) => {
    try {
      fn();
    } catch {
      if (!errors.includes(name)) errors.push(name);
    }
  };
  const refresh = (s: State) => {
    conversations.reset(s.indexGeneration);
    current = s;
    apply();
  };
  async function setSelection(value: Selection) {
    const capturedRoute = route;
    selection = value;
    await client.request("selection", { key: capturedRoute, value });
    if (route !== capturedRoute) return;
    shell.render();
    safe("message-layout", () =>
      messages.apply(current, selection, latest?.phase ?? "unknown"),
    );
    safe("composer-identity", () => composerIdentity.apply(current, selection));
    const chain = current.chains.find((c) => c.id === value.chainId);
    if (chain?.rememberLastPersona && chain.lastPersonaId !== value.personaId) {
      const updated = { ...chain, lastPersonaId: value.personaId };
      refresh(
        await client.mutate({
          type: "chain.save",
          chain: updated,
          expectedVersion: chain.version,
        }),
      );
    }
  }
  const selectChain = (c: Chain) => {
    const personaId = c.rememberLastPersona
      ? (c.lastPersonaId ?? c.defaultPersonaId)
      : c.defaultPersonaId;
    void setSelection({ chainId: c.id, personaId, visualOnly: false }).catch(
      (e) => shell.message(String(e)),
    );
  };
  const guard = new SendGuard(adapter, client, {
    state: () => current,
    selection: () => selection,
    error: (message, actions) => shell.message(message, actions),
    changed: () => shell.render(),
  });
  shell = new Shell({
    conversations,
    flushIndex: () => conversations.flush(),
    client,
    state: () => current,
    refresh,
    adapter,
    selection: () => selection,
    setSelection,
    selectChain,
    snapshot: () => latest ?? adapter.snapshot(),
    pause: () => {
      void client
        .mutate({ type: "settings", patch: { enabled: false } })
        .then(refresh)
        .catch((e) => shell.message(String(e)));
    },
    exportDiagnostics: () => createDiagnosticReport(current),
    diagnostics: () => ({
      version: VERSION,
      adapterEvidence:
        "0.1.1 user-confirmed; Network layout candidates require live verification",
      conversationId: latest?.conversation?.id ?? null,
      projectId: latest?.projectId ?? null,
      chainId: selection.chainId,
      selectedPersona: selection.personaId,
      actualInstructions: "Unchanged / not verified",
      visualOnly: selection.visualOnly,
      generation: latest?.phase,
      selectionReady,
      crossTabBlocking: false,
      health: latest?.health,
      scanMs: latest?.scanMs,
      performance: optimizer.metrics,
      index: {indexed: conversations.index.size, loaded: conversations.index.loadedCount, ...conversations.registry.metrics, error: conversations.error},
      moduleErrors: errors,
    }),
  });
  const promptHistory = new PromptHistory(conversations, () => adapter.composer(), () => current.settings.enabled, message => shell.message(message));
  function apply() {
    safe("appearance", () => appearance.apply(current.settings));
    safe("layout-theme", () => layout.apply(current.settings));
    safe("native-theme", () => nativeTheme.apply(current.settings.enabled));
    safe("message-layout", () =>
      messages.apply(current, selection, latest?.phase ?? "unknown"),
    );
    safe("composer-identity", () => composerIdentity.apply(current, selection));
    safe("navigation", () => {
      adapter.showSidebar(
        !(
          current.settings.enabled &&
          current.settings.navigation === "topbar" &&
          current.settings.hideSidebar
        ),
      );
      shell.render();
    });
    safe("performance", () =>
      optimizer.apply(current.settings, adapter.turns()),
    );
  }
  // Prevent an early send from racing the per-tab selection read.
  const bootGuard = (event: Event) => {
    if (
      !selectionReady &&
      current.settings.enabled &&
      current.settings.personas &&
      adapter.isSendEvent(event)
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      shell.message(
        "Carregando a seleção desta conversa. Aguarde um instante e envie novamente.",
      );
    }
  };
  for (const t of ["keydown", "click", "submit"])
    window.addEventListener(t, bootGuard, true);
  guard.install();
  window.addEventListener("click",cancelContinuationNavigation,true);
  for(const t of ["click","keydown","submit"])window.addEventListener(t,observeSend,true);
  void client.request<Continuation|null>("continuation").then(p=>{continuation=p;}).catch(()=>{});
  await client.request("hello");
  const unsubscribe = client.subscribe(refresh);
  apply();
  const stop = adapter.observe((snapshot) => {
    const old = latest;
    latest = snapshot;
    if(current.settings.enabled)conversations.update(snapshot.conversation?.id ?? null);
    if(!snapshot.conversation && !continuationBusy) {
      continuationBusy=true;
      void client.request<Continuation|null>("continuation").then(async p=>{
        continuation=p;if(!p||Date.now()-p.createdAt>86400000)return;
        continuationHome=true;
        if(!continuationInserted&&adapter.composer()) {
          await setSelection(p.selection);
          try{writeDraft(adapter.composer()!,p.draft);continuationInserted=true;}catch(e){continuationInserted=true;shell.message(String(e));}
        }
      }).catch(()=>{}).finally(()=>{continuationBusy=false;});
    }
    if(continuation && continuationHome && continuationSent && snapshot.conversation && snapshot.conversation.id!==continuation.sourceId && !continuationBusy) {
      const pending=continuation,c=current.chains.find(c=>c.id===pending.chainId),session=snapshot.conversation;
      if(c){continuationBusy=true;void client.mutate({type:"chain.save",chain:{...c,sessions:c.sessions.some(s=>s.id===session.id)?c.sessions:[...c.sessions,{...session,...(pending.selection.personaId?{personaId:pending.selection.personaId,personaVersion:current.personas.find(p=>p.id===pending.selection.personaId)?.version}:{})}],currentSession:session.id},expectedVersion:c.version}).then(async state=>{refresh(state);await setSelection(pending.selection);await client.request("continuation",{value:null});continuation=null;continuationHome=false;continuationSent=false;continuationInserted=false;}).catch(e=>shell.message(String(e))).finally(()=>{continuationBusy=false;});}
    }
    if (route !== snapshot.route) {
      const previous = selection;
      const preserve = !old?.conversation && guard.promotesNewChat(snapshot);
      route = snapshot.route;
      selectionReady = false;
      const epoch = ++routeEpoch;
      const key = route;
      void client
        .request<Selection>("selection", { key })
        .then(async (saved) => {
          if (epoch !== routeEpoch) return;
          let value = preserve ? previous : saved;
          if (!value.chainId && !value.personaId && current.settings.chains) {
            const matches = current.chains.filter((c) =>
              c.sessions.some((s) => s.id === snapshot.conversation?.id),
            );
            if (matches.length === 1) {
              const c = matches[0];
              value = {
                chainId: c.id,
                personaId: c.rememberLastPersona
                  ? (c.lastPersonaId ?? c.defaultPersonaId)
                  : c.defaultPersonaId,
                visualOnly: false,
              };
            }
          }
          selection = value;
          selectionReady = true;
          shell.render();
          if (preserve) await client.request("selection", { key, value });
        })
        .catch(() =>
          shell.message(
            "Não foi possível recuperar a seleção desta conversa. Recarregue a página ou pause Personas.",
          ),
        );
    }
    safe("appearance", () => appearance.refreshRegions(current.settings));
    safe("layout-theme", () => layout.apply(current.settings));
    safe("native-theme", () => nativeTheme.apply(current.settings.enabled));
    safe("message-layout", () =>
      messages.apply(current, selection, snapshot.phase),
    );
    safe("composer-identity", () => composerIdentity.apply(current, selection));
    safe("generation", () => guard.update(snapshot));
    safe("identity", () => shell.update(snapshot));
    safe("performance", () =>
      optimizer.apply(current.settings, adapter.turns()),
    );
    safe("navigation", () =>
      adapter.showSidebar(
        !(
          current.settings.enabled &&
          current.settings.navigation === "topbar" &&
          current.settings.hideSidebar
        ),
      ),
    );
  });
  return {
    dispose() {
      stop();
      promptHistory.dispose();
      conversations.dispose();
      unsubscribe();
      guard.dispose();
      window.removeEventListener("click",cancelContinuationNavigation,true);
      for(const t of ["click","keydown","submit"])window.removeEventListener(t,observeSend,true);
      composerIdentity.dispose();
      messages.dispose();
      layout.dispose();
      nativeTheme.dispose();
      appearance.dispose();
      optimizer.dispose();
      shell.dispose();
      for (const t of ["keydown", "click", "submit"])
        window.removeEventListener(t, bootGuard, true);
    },
  };
}
