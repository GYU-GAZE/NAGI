import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { VERSION } from "../src/shared/version.ts";
import { startApp } from "../src/app.ts";
import { Coordinator, type KV } from "../src/background/coordinator.ts";
import type { Client } from "../src/shared/platform.ts";
import type { State, Command, Selection } from "../src/shared/model.ts";
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));
async function fixture() {
  const dom = new JSDOM(
    '<!doctype html><body><header id="page-header"><span>Test · Work</span><button>Share</button><button aria-label="Files and sources">Files</button></header><nav id="history"><a href="/c/test">Test</a></nav><main></main><form><textarea id="prompt-textarea"></textarea><button type="button" data-testid="send-button">Send</button></form></body>',
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
  document.querySelector<HTMLElement>("#page-header")!.getBoundingClientRect =
    () => ({
      x: 0,
      y: 0,
      left: 0,
      right: 1024,
      top: 0,
      bottom: 48,
      width: 1024,
      height: 48,
      toJSON() {
        return {};
      },
    });
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
    get panel() {
      return document.querySelector<HTMLIFrameElement>("#nagi-panel-frame")!
        .contentDocument!;
    },
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
test("full app mounts network controls, theme/performance are independent and pause restores native DOM", async () => {
  const f = await fixture();
  try {
    assert.equal(
      f.root.querySelector("nav")!.getAttribute("aria-label"),
      "nAGI",
    );
    assert.equal(
      document.documentElement.hasAttribute("data-nagi-theme"),
      true,
    );
    assert.equal(
      document
        .querySelector("#page-header")!
        .hasAttribute("data-nagi-context-header"),
      true,
    );
    assert.equal(
      document.querySelector("#nagi-root")!.hasAttribute("data-network-shell"),
      true,
    );
    assert.equal(document.querySelectorAll("[data-nagi-contain]").length, 0);
    assert.equal(
      document.querySelector("#history")?.getAttribute("data-nagi-sidebar"),
      "hidden",
    );
    click(f.root, "Configurações");
    assert.equal(
      f.panel.body.textContent!.includes("Aplicar tema também"),
      false,
    );
    click(f.panel, "Aparência");
    const themePicker = f.panel.querySelector<HTMLSelectElement>("select")!;
    assert.equal(themePicker.value, "Network");
    themePicker.value = "Papel";
    themePicker.dispatchEvent(
      new f.dom.window.Event("change", { bubbles: true }),
    );
    await tick();
    assert.equal(
      document.documentElement.style.getPropertyValue("--nagi-background"),
      "#f5f1e8",
    );
    assert.equal(
      document.documentElement.hasAttribute("data-nagi-theme"),
      true,
    );
    await f.client.mutate({
      type: "settings",
      patch: { performance: true, hideSidebar: true },
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
    assert.equal(
      document
        .querySelector("#page-header")!
        .hasAttribute("data-nagi-context-header"),
      false,
    );
    assert.equal(
      document.querySelector("#nagi-root")!.hasAttribute("data-network-shell"),
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
    click(f.panel, "Personas");
    click(f.panel, "Criar Persona");
    const name = f.panel.querySelector<HTMLInputElement>("input[type=text]")!;
    name.value = "<img src=x onerror=alert(1)>";
    const instructions = f.panel.querySelector("textarea")!;
    instructions.value = "Use formal prose.";
    click(f.panel, "Salvar Persona");
    await tick();
    const state = await f.client.state();
    assert.equal(state.personas[0].name, name.value);
    assert.equal(f.panel.querySelector("img[src=x]"), null);
    assert.match(
      f.panel.body.textContent!,
      /troca das Custom Instructions.*ainda não/s,
    );
    click(f.panel, "Fechar painel");
    click(f.root,"Mais ferramentas");
    click(f.panel,"Selecionar Persona");
    const select = f.panel.querySelector("select")!;
    select.value = state.personas[0].id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    assert.equal((await f.c.selection(1, "/c/test")).visualOnly, false);
    assert.match(
      f.panel.body.textContent!,
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
    click(f.panel, "Chains");
    click(f.panel, "Criar Chain");
    f.panel.querySelector<HTMLInputElement>("input[type=text]")!.value =
      "Main Campaign";
    click(f.panel, "Adicionar conversa aberta");
    click(f.panel, "Salvar Chain");
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

test("editing inside options never reaches native ChatGPT keyboard handlers or its composer", async () => {
  const f = await fixture();
  try {
    click(f.root, "Configurações");
    click(f.panel, "Personas");
    click(f.panel, "Criar Persona");
    const field = f.panel.querySelector<HTMLInputElement>("input[type=text]")!;
    const composer =
      document.querySelector<HTMLTextAreaElement>("#prompt-textarea")!;
    composer.value = "untouched native draft";
    let intercepted = 0;
    const nativeHandler = (event: KeyboardEvent) => {
      intercepted++;
      composer.focus();
      event.preventDefault();
    };
    window.addEventListener("keydown", nativeHandler, true);
    field.focus();
    field.value = "Persona test";
    for (const key of ["a", " ", "Enter", "Backspace"])
      field.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          bubbles: true,
          composed: true,
          cancelable: true,
        }),
      );
    assert.equal(intercepted, 0);
    assert.equal(f.panel.activeElement, field);
    assert.equal(
      document.activeElement,
      document.querySelector("#nagi-panel-frame"),
    );
    assert.equal(composer.value, "untouched native draft");
    window.removeEventListener("keydown", nativeHandler, true);
    field.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    assert.equal(
      document.querySelector<HTMLIFrameElement>("#nagi-panel-frame")!.style
        .display,
      "none",
    );
  } finally {
    f.cleanup();
  }
});

test("shared diagnostics can be copied from isolated panel without private conversation data", async () => {
  const f = await fixture();
  try {
    document.querySelector<HTMLTextAreaElement>("#prompt-textarea")!.value =
      "PRIVATE DRAFT 123";
    click(f.root, "Configurações");
    click(f.panel, "Diagnóstico");
    click(f.panel, "Visualizar diagnóstico para copiar");
    const report = JSON.parse(
      f.panel.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Diagnóstico para copiar"]',
      )!.value,
    );
    assert.equal(report.extensionVersion, VERSION);
    assert.equal(report.matches.composer, true);
    assert.equal(JSON.stringify(report).includes("PRIVATE DRAFT"), false);
    assert.equal(report.active.panelFrame, true);
  } finally {
    f.cleanup();
  }
});

test("layout settings persist module toggles, keep editing isolated and restore compact/native header on switch", async () => {
  const f = await fixture();
  try {
    click(f.root, "Configurações");
    click(f.panel, "Layout");
    const grid = [...f.panel.querySelectorAll("label")]
      .find((e) => e.textContent === "Grade de fundo")!
      .querySelector<HTMLInputElement>("input")!;
    grid.click();
    await tick();
    assert.equal((await f.client.state()).settings.layout.grid, false);
    const variant = f.panel.querySelector<HTMLSelectElement>('select[aria-label="Estrutura"]')!;
    variant.value = "compact";
    variant.dispatchEvent(new f.dom.window.Event("change", { bubbles: true }));
    await tick();
    assert.equal(
      document.querySelector("#nagi-root")!.hasAttribute("data-network-shell"),
      false,
    );
    assert.equal(
      document
        .querySelector("header")!
        .hasAttribute("data-nagi-context-header"),
      false,
    );
    assert.equal(
      document.querySelector("header")!.hasAttribute("data-nagi-header"),
      true,
    );
    click(f.panel, "Restaurar visual padrão");
    await tick();
    const state = await f.client.state();
    assert.equal(state.settings.layout.variant, "network");
    assert.equal(state.settings.theme.width, 1040);
    assert.equal(
      document.querySelector("#nagi-root")!.hasAttribute("data-network-shell"),
      true,
    );
    assert.equal(
      document.querySelector("header")!.hasAttribute("data-nagi-header"),
      false,
    );
    assert.equal(
      document
        .querySelector("header")!
        .hasAttribute("data-nagi-context-header"),
      true,
    );
    assert.equal(
      document.querySelector<HTMLIFrameElement>("#nagi-panel-frame")!.style.top,
      "148px",
    );
  } finally {
    f.cleanup();
  }
});

test("mode selector stays beside New chat on home and disappears on send or existing-chat routes", async () => {
  const f = await fixture();
  try {
    const pair = document.createElement("div");
    pair.setAttribute("role", "tablist");
    pair.innerHTML =
      '<button role="tab" aria-selected="true">Chat</button><button role="tab" aria-selected="false">Work</button>';
    document.querySelector("#page-header")!.append(pair);
    const refresh = () =>
      f.client.mutate({ type: "settings", patch: { debug: false } });
    await refresh();
    let modes = f.root.querySelector<HTMLElement>(".mode-switcher")!;
    assert.equal(modes.hidden, true);
    assert.equal(f.root.querySelector(".bar .mode-switcher"), null);
    f.dom.window.history.pushState({}, "", "/");
    await refresh();
    modes = f.root.querySelector<HTMLElement>(".context-info .mode-switcher")!;
    assert.ok(modes);
    assert.equal(modes.hidden, false);
    assert.equal(modes.previousElementSibling!.className, "chat-title");
    assert.equal(
      f.root.querySelector('[aria-label="Alternar entre Chat e Work"]'),
      null,
    );
    const sent = document.createElement("div");
    sent.dataset.messageAuthorRole = "user";
    sent.textContent = "Prompt";
    document.querySelector("main")!.append(sent);
    await refresh();
    assert.equal(modes.hidden, true);
    sent.remove();
    f.dom.window.history.pushState({}, "", "/c/not-loaded-yet");
    await refresh();
    assert.equal(modes.hidden, true);
    assert.equal((await f.client.state()).settings.navigation, "topbar");
    assert.equal((await f.client.state()).settings.hideSidebar, true);
  } finally {
    f.cleanup();
  }
});

test("Projects stays in its own panel and opens the native directory only by explicit choice", async () => {
  const f = await fixture();
  try {
    const control = document.createElement("button");
    control.type = "button";
    control.textContent = "Project";
    let opens = 0;
    control.onclick = () => {
      opens++;
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.innerHTML = '<a href="/projects/real-project">Real project</a>';
      document.body.append(dialog);
    };
    document.querySelector("form")!.append(control);
    click(f.root, "Projects");
    assert.equal(opens, 0);
    click(f.panel, "Ver todos no ChatGPT");
    assert.equal(opens, 1);
    click(f.root, "Projects");
    assert.equal(opens, 1);
    assert.ok(
      f.panel.querySelector(
        'a[href="https://chatgpt.com/projects/real-project"]',
      ),
    );
  } finally {
    f.cleanup();
  }
});

test("recent and pinned panels dock the actual sidebar rows, include native destinations and restore on pause", async () => {
  const f = await fixture();
  try {
    const nav = document.querySelector<HTMLElement>("#history")!;
    nav.innerHTML =
      '<button id="scheduled">Scheduled</button><button id="plugins">Plugins</button><a id="codex" href="/codex">Codex</a><button id="nav-more" aria-haspopup="menu">More</button><section><h3>Pinned</h3><ol><li id="pin-row"><a href="/c/one">Pinned one</a><button aria-label="Unpin chat">◆</button><button aria-label="More">⋯</button></li></ol></section><section><h3>Recent chats</h3><ol><li id="recent-row"><a href="/c/two">Recent two</a><button aria-haspopup="menu" aria-label="More">⋯</button></li></ol></section>';
    const parent = document.querySelector("#recent-row")!.parentElement;
    await f.client.mutate({ type: "settings", patch: { debug: false } });
    assert.ok(f.root.querySelector('[aria-label="Chats pinnados"]'));
    for(const label of ["Scheduled","Plugins","Codex","More"]) assert.equal(f.root.querySelector(`[aria-label="${label}"]`),null);
    click(f.root,"Mais ferramentas");
    for(const label of ["Scheduled","Plugins","Codex","More"]) assert.ok(f.panel.querySelector(`[aria-label="${label}"]`));
    assert.equal(
      document.querySelector("#nav-more")!.getAttribute("data-nagi-nav-target"),
      "control",
    );
    click(f.root, "Chats recentes");
    assert.equal(f.panel.querySelectorAll(".native-chat-slot").length, 2);
    assert.equal(
      document
        .querySelector("#recent-row")!
        .getAttribute("data-nagi-nav-target"),
      "row",
    );
    assert.equal(document.querySelector("#recent-row")!.parentElement, parent);
    assert.ok(f.panel.querySelector('[aria-label="Pin chat"]'));
    click(f.root, "Chats pinnados");
    assert.equal(f.panel.querySelectorAll(".native-chat-slot").length, 1);
    assert.equal(
      document
        .querySelector("#recent-row")!
        .hasAttribute("data-nagi-nav-target"),
      false,
    );
    assert.equal(
      document.querySelector("#pin-row")!.hasAttribute("data-nagi-nav-target"),
      true,
    );
    click(f.panel, "Fechar painel");
    assert.equal(document.querySelector("[data-nagi-nav-target=row]"), null);
    await f.client.mutate({ type: "settings", patch: { enabled: false } });
    assert.equal(document.querySelector("[data-nagi-nav-path]"), null);
    assert.equal(document.querySelector("[data-nagi-nav-target]"), null);
    assert.equal(document.querySelector("#recent-row")!.parentElement, parent);
  } finally {
    f.cleanup();
  }
});

test("new-chat selection is saved under the assigned conversation ID with unknown generation phase", async () => {
  const f = await fixture();
  try {
    f.dom.window.history.replaceState({}, "", "/");
    document.querySelector("main")!.replaceChildren();
    await new Promise((r) => setTimeout(r, 220));
    await f.client.mutate({
      type: "persona.save",
      persona: {
        id: "test-persona",
        name: "Identity",
        instructions: "",
        avatars: {},
      },
      expectedVersion: 0,
    });
    // Seed the new-chat selection and trigger a route refresh through a distinct home path.
    await f.c.selection(1, "/", {
      personaId: "test-persona",
      chainId: null,
      visualOnly: true,
    });
    f.dom.window.history.replaceState({}, "", "/c/temp");
    document.querySelector("main")!.textContent = "temp";
    await new Promise((r) => setTimeout(r, 220));
    f.dom.window.history.replaceState({}, "", "/");
    document.querySelector("main")!.textContent = "";
    await new Promise((r) => setTimeout(r, 220));
    const send = document.querySelector<HTMLButtonElement>(
      "[data-testid=send-button]",
    )!;
    send.click();
    f.dom.window.history.replaceState({}, "", "/c/assigned");
    document.querySelector("main")!.innerHTML =
      '<div data-message-author-role="user">hello</div>';
    await new Promise((r) => setTimeout(r, 240));
    assert.equal(
      (await f.c.selection(1, "/c/assigned")).personaId,
      "test-persona",
    );
    assert.equal(f.root.textContent?.includes("trava foi mantida"), false);
  } finally {
    f.cleanup();
  }
});
