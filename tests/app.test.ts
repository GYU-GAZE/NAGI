import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { startApp } from "../src/app.ts";
import { Coordinator, type KV } from "../src/background/coordinator.ts";
import type { Client } from "../src/shared/platform.ts";
import type { State, Command, Selection } from "../src/shared/model.ts";
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));
async function fixture() {
  const dom = new JSDOM(
    '<!doctype html><body><nav id="history"><a href="/c/test">Test</a></nav><main></main><form><textarea id="prompt-textarea"></textarea><button type="button" data-testid="send-button">Send</button></form></body>',
    { url: "https://chatgpt.com/c/test" },
  );
  for (const key of [
    "window",
    "document",
    "location",
    "Element",
    "HTMLElement",
    "HTMLTextAreaElement",
    "HTMLButtonElement",
    "KeyboardEvent",
    "MutationObserver",
    "Event",
    "HTMLInputElement",
    "HTMLSelectElement",
  ] as const)
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  Object.defineProperty(globalThis, "CSS", {
    value: { supports: () => true },
    configurable: true,
  });
  dom.window.HTMLElement.prototype.getClientRects = function () {
    return { length: 1 } as DOMRectList;
  };
  for (let i = 0; i < 40; i++) {
    const a = document.createElement("article");
    a.dataset.testid = `conversation-turn-${i}`;
    a.textContent = `Turn ${i}`;
    document.querySelector("main")!.append(a);
  }
  const map = new Map<string, unknown>();
  const kv: KV = {
    get: async (k) => structuredClone(map.get(k)),
    set: async (k, v) => {
      map.set(k, structuredClone(v));
    },
  };
  const c = new Coordinator(kv, kv);
  let subscribers: ((s: State) => void)[] = [];
  const client: Client = {
    state: () => c.state(),
    mutate: async (command: Command) => {
      const s = await c.mutate(command);
      subscribers.forEach((fn) => fn(s));
      return s;
    },
    request: async <T>(type: string, payload: object = {}) => {
      const p = payload as any;
      switch (type) {
        case "hello":
          return true as T;
        case "selection":
          return (await c.selection(1, p.key, p.value)) as T;
        case "lock.get":
          return (await c.lock()) as T;
        default:
          throw new Error(type);
      }
    },
    subscribe: (fn) => {
      subscribers.push(fn);
      return () => (subscribers = subscribers.filter((x) => x !== fn));
    },
  };
  const app = await startApp(client);
  await tick();
  const root = document.querySelector("#nagi-root")!.shadowRoot!;
  return {
    dom,
    root,
    client,
    app,
    c,
    cleanup() {
      app.dispose();
      dom.window.close();
    },
  };
}
function click(root: ParentNode, label: string) {
  const b = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.getAttribute("aria-label") === label,
  );
  assert.ok(b, `Button: ${label}`);
  b.click();
}
test("full app mounts compact controls, theme/performance are independent and pause restores native DOM", async () => {
  const f = await fixture();
  try {
    assert.equal(
      f.root.querySelector("nav")!.getAttribute("aria-label"),
      "nAGI",
    );
    assert.equal(
      document.documentElement.hasAttribute("data-nagi-theme"),
      false,
    );
    assert.equal(document.querySelectorAll("[data-nagi-contain]").length, 0);
    await f.client.mutate({
      type: "settings",
      patch: { appearance: true, performance: true, hideSidebar: true },
    });
    assert.equal(
      document.documentElement.hasAttribute("data-nagi-theme"),
      true,
    );
    assert.equal(document.querySelectorAll("[data-nagi-contain]").length, 10);
    assert.equal(
      document.querySelector("#history")?.getAttribute("data-nagi-sidebar"),
      "hidden",
    );
    click(f.root, "Pausar nAGI");
    await tick();
    assert.equal(
      document.documentElement.hasAttribute("data-nagi-theme"),
      false,
    );
    assert.equal(document.querySelectorAll("[data-nagi-contain]").length, 0);
    assert.equal(
      document.querySelector("#history")?.hasAttribute("data-nagi-sidebar"),
      false,
    );
    assert.equal(f.root.querySelectorAll("nav button").length, 1);
  } finally {
    f.cleanup();
  }
});
test("persona editor persists literal untrusted text and exposes instructions as unapplied", async () => {
  const f = await fixture();
  try {
    click(f.root, "Configurações");
    click(f.root, "Personas");
    click(f.root, "Criar Persona");
    const name = f.root.querySelector<HTMLInputElement>("input[type=text]")!;
    name.value = "<img src=x onerror=alert(1)>";
    const instructions = f.root.querySelector("textarea")!;
    instructions.value = "Use formal prose.";
    click(f.root, "Salvar Persona");
    await tick();
    const state = await f.client.state();
    assert.equal(state.personas[0].name, name.value);
    assert.equal(f.root.querySelector("img[src=x]"), null);
    assert.match(
      f.root.textContent!,
      /troca das Custom Instructions.*ainda não/s,
    );
    click(f.root, "Fechar painel");
    click(f.root, "Answer with…");
    const select = f.root.querySelector("select")!;
    select.value = state.personas[0].id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    assert.equal((await f.c.selection(1, "/c/test")).visualOnly, false);
    assert.match(
      f.root.textContent!,
      /Instruções da Persona ainda não são aplicadas/,
    );
  } finally {
    f.cleanup();
  }
});
test("chain editor adds the open chat, stores order metadata and restores selection", async () => {
  const f = await fixture();
  try {
    click(f.root, "Configurações");
    click(f.root, "Chains");
    click(f.root, "Criar Chain");
    f.root.querySelector<HTMLInputElement>("input[type=text]")!.value =
      "Main Campaign";
    click(f.root, "Adicionar conversa aberta");
    click(f.root, "Salvar Chain");
    await tick();
    const chain = (await f.client.state()).chains[0];
    assert.equal(chain.name, "Main Campaign");
    assert.equal(chain.sessions[0].id, "test");
    assert.equal(chain.currentSession, "test");
    assert.equal(chain.projectId, null);
    assert.equal(chain.continuationMessage, "");
  } finally {
    f.cleanup();
  }
});
