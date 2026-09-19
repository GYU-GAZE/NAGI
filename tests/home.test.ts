import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { resolveModeControls } from "../src/adapter/modes.ts";
import { resolveHeader, readHeaderContext } from "../src/adapter/header.ts";
import { ModeSwitcher } from "../src/ui/mode-switcher.ts";
import { ContextHeaderBridge } from "../src/features/context-header.ts";
import {
  NativeTheme,
  resolveHomeRegions,
} from "../src/features/native-theme.ts";
import { Appearance } from "../src/features/appearance.ts";
import { initialState } from "../src/shared/model.ts";
import { createDiagnosticReport } from "../src/features/diagnostics.ts";
function setup(body: string) {
  const dom = new JSDOM(`<!doctype html><body>${body}</body>`, {
    url: "https://chatgpt.com/",
  });
  for (const key of [
    "window",
    "document",
    "location",
    "HTMLElement",
    "Element",
  ] as const)
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      configurable: true,
      writable: true,
    });
  return dom;
}
function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  };
}
const pair =
  '<nav id="sidebar"><div role="tablist"><button id="chat" role="tab" aria-selected="false">Chat</button><button id="work" role="tab" aria-selected="true">Work</button></div></nav>';
test("mode switch finds native tabs in the hidden sidebar and only selects on user activation", () => {
  const dom = setup(pair);
  let clicks = 0;
  const switcher = new ModeSwitcher(() => {});
  try {
    document.querySelector("nav")!.setAttribute("data-nagi-sidebar", "hidden");
    const chat = document.querySelector<HTMLButtonElement>("#chat")!;
    const work = document.querySelector<HTMLButtonElement>("#work")!;
    chat.onclick = () => {
      clicks++;
      chat.setAttribute("aria-selected", "true");
      work.setAttribute("aria-selected", "false");
    };
    const parent = chat.parentNode;
    switcher.update(true);
    assert.equal(resolveModeControls().active, "work");
    assert.equal(clicks, 0);
    switcher.host
      .querySelector<HTMLButtonElement>('[aria-label="Chat normal"]')!
      .click();
    assert.equal(clicks, 1);
    assert.equal(chat.parentNode, parent);
    assert.equal(resolveModeControls().active, "chat");
    assert.equal(
      switcher.host
        .querySelector('[aria-label="Chat normal"]')!
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(readHeaderContext(null).work, false);
    switcher.update(false);
    assert.equal(switcher.host.hidden, true);
  } finally {
    dom.window.close();
  }
});
test("mode switch rereads replaced native controls and honors unavailable modes", () => {
  const dom = setup(pair);
  let calls = 0;
  const switcher = new ModeSwitcher(() => {});
  try {
    switcher.update(true);
    const old = document.querySelector<HTMLButtonElement>("#chat")!;
    const next = old.cloneNode(true) as HTMLButtonElement;
    old.replaceWith(next);
    next.onclick = () => calls++;
    switcher.host
      .querySelector<HTMLButtonElement>('[aria-label="Chat normal"]')!
      .click();
    assert.equal(calls, 1);
    next.disabled = true;
    switcher.update(true);
    assert.equal(
      switcher.host.querySelector<HTMLButtonElement>(
        '[aria-label="Chat normal"]',
      )!.disabled,
      true,
    );
    switcher.host
      .querySelector<HTMLButtonElement>('[aria-label="Chat normal"]')!
      .click();
    assert.equal(calls, 1);
  } finally {
    dom.window.close();
  }
});
test("Chat/Work text in messages, project links and untrusted external links is not a mode switch", () => {
  const dom = setup(
    '<main><section><div data-message-author-role="assistant"><nav><button>Chat</button><button>Work</button></nav></div></section></main><nav><a href="/c/123">Chat</a><a href="/g/g-p-test/project">Work</a></nav><nav><a href="https://example.com/">Chat</a><a href="/work">Work</a></nav>',
  );
  try {
    assert.equal(resolveModeControls().chat, null);
    const switcher = new ModeSwitcher(() => {});
    switcher.update(true);
    assert.equal(switcher.host.hidden, true);
    assert.equal(
      switcher.host.querySelector('[aria-label="Alternar entre Chat e Work"]'),
      null,
    );
  } finally {
    dom.window.close();
  }
});
test("plain home header with mode tabs is recognized without Share and selection is not inferred from both labels", () => {
  const dom = setup(
    '<div id="top"><div role="tablist"><button role="tab" aria-selected="true">Chat</button><button role="tab" aria-selected="false">Work</button></div></div><main><textarea id="prompt-textarea"></textarea></main>',
  );
  try {
    const header = document.querySelector<HTMLElement>("#top")!;
    header.getBoundingClientRect = () => rect(0, 0, 1024, 48);
    assert.equal(resolveHeader(), header);
    assert.equal(readHeaderContext(header).work, false);
  } finally {
    dom.window.close();
  }
});
test("native mode dropdown docks in its context slot only on the empty home page without losing its menu or click handler", () => {
  const dom = setup(
    '<header><button id="mode" aria-haspopup="menu">Work</button><button>Share</button></header>',
  );
  const bridge = new ContextHeaderBridge();
  try {
    const header = document.querySelector<HTMLElement>("header")!;
    header.getBoundingClientRect = () => rect(0, 0, 1024, 48);
    const original = header.outerHTML;
    const mode = document.querySelector<HTMLButtonElement>("#mode")!;
    let clicks = 0;
    mode.onclick = () => clicks++;
    const actions = document.createElement("div"),
      slot = document.createElement("div");
    actions.getBoundingClientRect = () => rect(800, 98, 200, 34);
    slot.getBoundingClientRect = () => rect(220, 25, 124, 34);
    document.body.append(actions, slot);
    assert.equal(bridge.refresh(actions, true, slot).modeDocked, true);
    assert.equal(mode.style.getPropertyValue("--nagi-dock-x"), "220px");
    assert.equal(mode.style.getPropertyValue("--nagi-dock-y"), "25px");
    assert.equal(clicks, 0);
    mode.click();
    assert.equal(clicks, 1);
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.innerHTML =
      '<button role="menuitemradio" aria-checked="false">Chat</button><button role="menuitemradio" aria-checked="true">Work</button>';
    header.append(menu);
    bridge.refresh(actions, true, slot);
    assert.equal(mode.hasAttribute("data-nagi-docked"), true);
    assert.equal(menu.querySelector("[data-nagi-docked]"), null);
    menu.remove();
    dom.window.history.pushState({}, "", "/c/loading");
    assert.equal(bridge.refresh(actions, true, slot).modeDocked, false);
    assert.equal(mode.hasAttribute("data-nagi-docked"), false);
    assert.equal(mode.style.getPropertyValue("--nagi-dock-x"), "");
    bridge.refresh(actions, false, slot);
    assert.equal(header.outerHTML, original);
  } finally {
    bridge.dispose();
    dom.window.close();
  }
});
const home =
  '<main><h1 style="font-family:Arial">What should we work on?</h1><form><textarea id="prompt-textarea">PRIVATE DRAFT</textarea><button>Send</button></form><div id="tabs" role="tablist" class="bg-black"><button role="tab">Projects</button><button role="tab">Files</button></div><section id="card" class="rounded-3xl bg-token-main-surface-secondary"><img src="data:image/png;base64,AAAA"><h3>PRIVATE SUGGESTION</h3><p>Try Work</p><button>Try</button></section></main>';
test("home cards and tabs receive editable theme surfaces while preserving media, drafts and handlers", () => {
  const dom = setup(home),
    theme = new NativeTheme(),
    appearance = new Appearance();
  try {
    const before = document.querySelector("main")!.outerHTML;
    const state = initialState();
    state.settings.theme.font = "Georgia";
    appearance.apply(state.settings);
    const card = document.querySelector<HTMLElement>("#card")!;
    const image = card.querySelector("img")!;
    let clicks = 0;
    card.querySelector("button")!.onclick = () => clicks++;
    theme.apply(true);
    assert.equal(resolveHomeRegions().length, 1);
    assert.equal(card.hasAttribute("data-nagi-native-panel"), true);
    assert.equal(card.hasAttribute("data-nagi-native-card"), true);
    assert.equal(
      document.querySelector("#tabs")!.hasAttribute("data-nagi-native-panel"),
      true,
    );
    assert.equal(
      document.querySelector("form")!.hasAttribute("data-nagi-native-panel"),
      false,
    );
    assert.equal(image.hasAttribute("data-nagi-native-panel"), false);
    assert.equal(document.querySelector("textarea")!.value, "PRIVATE DRAFT");
    card.querySelector("button")!.click();
    assert.equal(clicks, 1);
    const json = JSON.stringify(createDiagnosticReport(state));
    assert.equal(json.includes("PRIVATE SUGGESTION"), false);
    theme.apply(false);
    appearance.dispose();
    assert.equal(document.querySelector("main")!.outerHTML, before);
  } finally {
    theme.dispose();
    appearance.dispose();
    dom.window.close();
  }
});
test("new menus are themed and home-only marks retire when a conversation mounts", () => {
  const dom = setup(home),
    theme = new NativeTheme();
  try {
    theme.apply(true);
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.innerHTML = '<div class="bg-black"><button>Rename</button></div>';
    document.body.append(menu);
    theme.apply(true);
    assert.equal(menu.hasAttribute("data-nagi-native-panel"), true);
    assert.equal(
      menu.firstElementChild!.hasAttribute("data-nagi-native-panel"),
      true,
    );
    const response = document.createElement("article");
    response.innerHTML =
      '<div data-message-author-role="assistant"><pre><code><span class="bg-black">code</span></code></pre></div>';
    document.querySelector("main")!.append(response);
    theme.apply(true);
    assert.equal(document.querySelector("[data-nagi-home]"), null);
    assert.equal(
      document.querySelector("#card")!.hasAttribute("data-nagi-native-panel"),
      false,
    );
    assert.equal(response.querySelector("[data-nagi-native-panel]"), null);
    theme.dispose();
    assert.equal(menu.hasAttribute("data-nagi-native-panel"), false);
  } finally {
    theme.dispose();
    dom.window.close();
  }
});

test("stale mode buttons cannot switch an existing chat or trigger navigation recovery", () => {
  const dom = setup(pair);
  const switcher = new ModeSwitcher(() => {});
  try {
    let calls = 0;
    document.querySelector<HTMLButtonElement>("#chat")!.onclick = () => calls++;
    switcher.update(true);
    const button = switcher.host.querySelector<HTMLButtonElement>(
      '[aria-label="Chat normal"]',
    )!;
    dom.window.history.pushState({}, "", "/c/existing");
    button.click();
    assert.equal(calls, 0);
    assert.equal(switcher.host.hidden, true);
    dom.window.history.pushState({}, "", "/");
    switcher.update(true);
    document.querySelector("nav")!.remove();
    button.click();
    assert.equal(calls, 0);
    assert.equal(switcher.host.hidden, true);
  } finally {
    dom.window.close();
  }
});
