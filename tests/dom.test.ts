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
test("visual-only sends use the original event once without acquiring a lock", async () => {
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
  let sent = 0;
  const f = fakeClient();
  const guard = new SendGuard(a, f.client, {
    state: () => state,
    selection: () => ({ personaId: "gm", chainId: null, visualOnly: true }),
    error: (m) => assert.fail(m),
    changed: () => {},
  });
  guard.install();
  a.sendButton()!.addEventListener("click", () => sent++);
  a.sendButton()!.click();
  assert.equal(sent, 1);
  assert.equal(f.acquisitions, 0);
  guard.update({ ...a.snapshot(), phase: "thinking" });
  guard.update({ ...a.snapshot(), route: "/c/other", phase: "unknown" });
  a.sendButton()!.click();
  assert.equal(sent, 2);
  assert.equal(f.acquisitions, 0);
  guard.dispose();
  dom.window.close();
});
test("new chat ID assignment preserves selection before generation is recognized, with no held-lock warning", () => {
  const dom = setup(markup);
  dom.window.history.replaceState({}, "", "/");
  const a = new DOMChatGPTAdapter();
  const f = fakeClient();
  const guard = new SendGuard(a, f.client, {
    state: initialState,
    selection: emptySelection,
    error: (m) => assert.fail(m),
    changed: () => {},
  });
  guard.install();
  a.sendButton()!.click();
  dom.window.history.replaceState({}, "", "/c/new");
  const snapshot = { ...a.snapshot(), phase: "unknown" as const };
  assert.equal(guard.promotesNewChat(snapshot), true);
  guard.update(snapshot);
  assert.equal(guard.promotesNewChat(snapshot), false);
  assert.equal(f.acquisitions, 0);
  guard.dispose();
  dom.window.close();
});
test("following a history link cancels new-chat selection promotion", () => {
  const dom = setup(markup);
  dom.window.history.replaceState({}, "", "/");
  const a = new DOMChatGPTAdapter();
  const guard = new SendGuard(a, fakeClient().client, {
    state: initialState,
    selection: emptySelection,
    error: (m) => assert.fail(m),
    changed: () => {},
  });
  guard.install();
  a.sendButton()!.click();
  const link = document.querySelector<HTMLAnchorElement>('a[href="/c/b"]')!;
  link.addEventListener("click", (e) => e.preventDefault());
  link.click();
  dom.window.history.replaceState({}, "", "/c/b");
  assert.equal(guard.promotesNewChat(a.snapshot()), false);
  guard.dispose();
  dom.window.close();
});
test("different visual Personas can send while another tab is generating or storage holds a legacy lock", () => {
  const dom = setup(markup);
  const a = new DOMChatGPTAdapter();
  const state = initialState();
  state.personas = ["a", "b"].map((id) => ({
    id,
    name: id,
    instructions: "",
    avatars: {},
    version: 1,
    history: [],
  }));
  let sent = 0;
  const client = {
    ...fakeClient().client,
    request: async () => {
      assert.fail("Sending must not consult or wait for another tab");
    },
  } as Client;
  const guards = ["a", "b"].map(
    (personaId) =>
      new SendGuard(a, client, {
        state: () => state,
        selection: () => ({ personaId, chainId: null, visualOnly: true }),
        error: (m) => assert.fail(m),
        changed: () => {},
      }),
  );
  a.sendButton()!.addEventListener("click", () => sent++);
  void guards[0].send();
  guards[0].update({ ...a.snapshot(), phase: "thinking" });
  void guards[1].send();
  assert.equal(sent, 2);
  guards.forEach((g) => g.dispose());
  dom.window.close();
});
