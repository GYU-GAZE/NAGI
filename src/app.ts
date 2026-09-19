import type { Client } from "./shared/platform";
import {
  emptySelection,
  type State,
  type Selection,
  type Chain,
  type SendLock,
} from "./shared/model";
import { DOMChatGPTAdapter, type Snapshot } from "./adapter/chatgpt";
import { Appearance } from "./features/appearance";
import { TurnOptimizer } from "./features/performance";
import { SendGuard } from "./features/send-guard";
import { Shell } from "./ui/shell";
export async function startApp(client: Client) {
  const state = await client.state();
  let current: State = state;
  let selection = emptySelection();
  let route = "";
  let latest: Snapshot;
  let routeEpoch = 0;
  let selectionReady = false;
  const adapter = new DOMChatGPTAdapter();
  const appearance = new Appearance();
  const optimizer = new TurnOptimizer();
  let shell: Shell;
  const errors: string[] = [];
  const safe = (name: string, fn: () => void) => {
    try {
      fn();
    } catch {
      if (!errors.includes(name)) errors.push(name);
    }
  };
  const refresh = (s: State) => {
    current = s;
    apply();
  };
  async function setSelection(value: Selection) {
    const capturedRoute = route;
    selection = value;
    await client.request("selection", { key: capturedRoute, value });
    if (route !== capturedRoute) return;
    shell.render();
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
    diagnostics: () => ({
      version: "0.1.0",
      adapterEvidence: "candidate selectors / live verification blocked",
      conversationId: latest?.conversation?.id ?? null,
      projectId: latest?.projectId ?? null,
      chainId: selection.chainId,
      selectedPersona: selection.personaId,
      actualInstructions: "Unchanged / not verified",
      visualOnly: selection.visualOnly,
      generation: latest?.phase,
      selectionReady,
      ownerTab: guard.lock?.tabId ?? null,
      health: latest?.health,
      scanMs: latest?.scanMs,
      performance: optimizer.metrics,
      moduleErrors: errors,
    }),
  });
  function apply() {
    safe("appearance", () => appearance.apply(current.settings));
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
  await client.request("hello");
  const unsubscribe = client.subscribe(refresh);
  apply();
  const stop = adapter.observe((snapshot) => {
    const old = latest;
    latest = snapshot;
    if (route !== snapshot.route) {
      const previous = selection;
      const preserve = !!guard.lock && !old?.conversation;
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
      unsubscribe();
      guard.dispose();
      appearance.dispose();
      optimizer.dispose();
      shell.dispose();
      for (const t of ["keydown", "click", "submit"])
        window.removeEventListener(t, bootGuard, true);
    },
  };
}
