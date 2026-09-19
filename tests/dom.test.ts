import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { DOMChatGPTAdapter } from "../src/adapter/chatgpt.ts";
import { SendGuard } from "../src/features/send-guard.ts";
import {
  initialState,
  emptySelection,
  type Selection,
  type State,
} from "../src/shared/model.ts";
import type { Client } from "../src/shared/platform.ts";
function setup(html = "") {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    url: "https://chatgpt.com/c/a",
  });
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
  ] as const)
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  dom.window.HTMLElement.prototype.getClientRects = function () {
    return { length: this.hidden ? 0 : 1 } as DOMRectList;
  };
  return dom;
}
const markup =
  '<nav id="history"><a href="/c/a">Chat A</a><a href="/c/b">Chat B</a><a href="/g/g-p-test/project">Project</a><a href="https://evil.test/c/b">Bad</a></nav><form><textarea id="prompt-textarea">hello</textarea><button data-testid="send-button" type="button">Send</button></form>';
test("adapter recognizes semantic candidates, separate nav and reversible sidebar", () => {
  const dom = setup(markup);
  const a = new DOMChatGPTAdapter();
  assert.equal(a.snapshot().conversation?.id, "a");
  assert.deepEqual(
    a.recent().map((l) => l.title),
    ["Chat A", "Chat B"],
  );
  assert.equal(a.projects()[0].id, "g-p-test");
  a.showSidebar(false);
  assert.equal(
    document.querySelector("#history")?.getAttribute("data-nagi-sidebar"),
    "hidden",
  );
  a.showSidebar(true);
  assert.equal(
    document.querySelector("#history")?.hasAttribute("data-nagi-sidebar"),
    false,
  );
  dom.window.close();
});
test("unknown DOM yields unknown state and safe empty navigation", () => {
  const dom = setup("<main>Changed frontend</main>");
  const a = new DOMChatGPTAdapter();
  assert.equal(a.snapshot().phase, "unknown");
  assert.equal(a.sendButton(), null);
  assert.deepEqual(a.recent(), []);
  assert.equal(a.showSidebar(false), false);
  assert.throws(() => a.sendOriginal());
  dom.window.close();
});
test("Shift+Enter, composing and unrelated inputs are not intercepted", () => {
  const dom = setup(markup + '<input id="other">');
  const a = new DOMChatGPTAdapter();
  let found: boolean[] = [];
  window.addEventListener("keydown", (e) => found.push(a.isSendEvent(e)));
  const composer = document.querySelector("#prompt-textarea")!;
  for (const opts of [
    { key: "Enter", shiftKey: true },
    { key: "Enter", isComposing: true },
    { key: "Enter" },
  ])
    composer.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, ...opts }),
    );
  document
    .querySelector("#other")!
    .dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  assert.deepEqual(found, [false, false, true, false]);
  dom.window.close();
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
function fakeClient() {
  let acquisitions = 0,
    releases = 0;
  let lock: any = null;
  const client = {
    state: async () => initialState(),
    mutate: async () => initialState(),
    subscribe: () => () => {},
    request: async (type: string) => {
      if (type === "lock.acquire") {
        acquisitions++;
        lock = {
          token: "token",
          tabId: 1,
          instanceId: "a",
          personaId: "gm",
          personaName: "GM",
          createdAt: 0,
          phase: "reserved",
          orphaned: false,
        };
        return { acquired: true, lock };
      }
      if (type === "lock.release") {
        releases++;
        lock = null;
      }
      if (type === "lock.get") return lock;
      return true;
    },
  } as Client;
  return {
    client,
    get acquisitions() {
      return acquisitions;
    },
    get releases() {
      return releases;
    },
  };
}
test("instruction-bearing persona blocks original send without visual-only consent", async () => {
  const dom = setup(markup);
  const a = new DOMChatGPTAdapter();
  const state = initialState();
  state.personas = [
    {
      id: "gm",
      name: "GM",
      instructions: "formal",
      avatars: {},
      version: 1,
      history: [],
    },
  ];
  const f = fakeClient();
  let sent = 0;
  let error = "";
  const guard = new SendGuard(a, f.client, {
    state: () => state,
    selection: () => ({ personaId: "gm", chainId: null, visualOnly: false }),
    error: (m) => (error = m),
    changed: () => {},
  });
  guard.install();
  a.sendButton()!.addEventListener("click", () => sent++);
  a.sendButton()!.click();
  await tick();
  assert.equal(sent, 0);
  assert.equal(f.acquisitions, 0);
  assert.match(error, /ainda nao foram aplicadas/);
  guard.dispose();
  dom.window.close();
});
test("explicit visual-only sends exactly once and keeps lock through generation", async () => {
  const dom = setup(markup);
  const a = new DOMChatGPTAdapter();
  const state = initialState();
  state.personas = [
    {
      id: "gm",
      name: "GM",
      instructions: "formal",
      avatars: {},
      version: 1,
      history: [],
    },
  ];
  const f = fakeClient();
  let sent = 0;
  const guard = new SendGuard(a, f.client, {
    state: () => state,
    selection: () => ({ personaId: "gm", chainId: null, visualOnly: true }),
    error: (m) => assert.fail(m),
    changed: () => {},
  });
  guard.install();
  a.sendButton()!.addEventListener("click", () => sent++);
  a.sendButton()!.click();
  await tick();
  assert.equal(sent, 1);
  assert.equal(f.acquisitions, 1);
  assert.equal(f.releases, 0);
  const snap = a.snapshot();
  guard.update({ ...snap, phase: "thinking" });
  await tick();
  guard.update({ ...snap, phase: "talking" });
  assert.equal(f.releases, 0);
  guard.update({ ...snap, phase: "unknown" });
  assert.equal(f.releases, 0);
  guard.update({ ...snap, phase: "idle" });
  await tick();
  assert.equal(f.releases, 1);
  guard.dispose();
  dom.window.close();
});
test("editing draft while acquiring lock aborts send and releases reservation", async () => {
  const dom = setup(markup);
  const a = new DOMChatGPTAdapter();
  const f = fakeClient();
  const original = f.client.request;
  f.client.request = async (type, payload) => {
    if (type === "lock.acquire")
      (
        document.querySelector("#prompt-textarea") as HTMLTextAreaElement
      ).value = "changed";
    return original(type, payload);
  };
  let sent = 0;
  const errors: string[] = [];
  const guard = new SendGuard(a, f.client, {
    state: () => initialState(),
    selection: emptySelection,
    error: (m) => errors.push(m),
    changed: () => {},
  });
  a.sendButton()!.addEventListener("click", () => sent++);
  await guard.send();
  assert.equal(sent, 0);
  assert.equal(f.releases, 1);
  assert.equal((a.composer() as HTMLTextAreaElement).value, "changed");
  assert.match(errors[0], /rascunho/);
  guard.dispose();
  dom.window.close();
});
test("draft changed during queue availability check is never submitted", async (t) => {
  const dom = setup(markup);
  const a = new DOMChatGPTAdapter();
  let sent = 0;
  let actions: { label: string; run: () => void }[] = [];
  let resolveCheck: (v: null) => void = () => {};
  const client = {
    state: async () => initialState(),
    mutate: async () => initialState(),
    subscribe: () => () => {},
    request: async (type: string) => {
      if (type === "lock.acquire")
        return {
          acquired: false,
          lock: { personaName: "Other", token: "other" },
        };
      if (type === "lock.get")
        return new Promise<null>((r) => (resolveCheck = r));
      return true;
    },
  } as Client;
  const guard = new SendGuard(a, client, {
    state: initialState,
    selection: emptySelection,
    error: (_m, as) => {
      if (as) actions = as;
    },
    changed: () => {},
  });
  a.sendButton()!.addEventListener("click", () => sent++);
  await guard.send();
  t.mock.timers.enable({ apis: ["setInterval"] });
  actions[0].run();
  t.mock.timers.tick(1200);
  await Promise.resolve();
  (a.composer() as HTMLTextAreaElement).value = "new private draft";
  resolveCheck(null);
  await tick();
  assert.equal(sent, 0);
  guard.dispose();
  t.mock.timers.reset();
  dom.window.close();
});
test("navigating away after generation starts holds lock instead of treating unrelated idle as completion", async () => {
  const dom = setup(markup);
  const a = new DOMChatGPTAdapter();
  const f = fakeClient();
  const guard = new SendGuard(a, f.client, {
    state: initialState,
    selection: emptySelection,
    error: () => {},
    changed: () => {},
  });
  await guard.send();
  const snap = a.snapshot();
  guard.update({ ...snap, phase: "thinking" });
  await tick();
  guard.update({
    ...snap,
    route: "/c/other",
    phase: "idle",
    conversation: {
      id: "other",
      title: "Other",
      url: "https://chatgpt.com/c/other",
    },
  });
  await tick();
  assert.equal(f.releases, 0);
  guard.dispose();
  dom.window.close();
});
