import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { initialState, emptySelection } from "../src/shared/model.ts";
import { readHeaderContext } from "../src/adapter/header.ts";
import { resolveMessages } from "../src/adapter/messages.ts";
import { MessageLayout } from "../src/features/message-layout.ts";
import { LayoutTheme } from "../src/features/layout-theme.ts";
import { ContextHeaderBridge } from "../src/features/context-header.ts";
import { PromptNavigator } from "../src/features/prompt-navigator.ts";
import { ComposerIdentity } from "../src/features/composer-identity.ts";
import { ContextBar } from "../src/ui/context-bar.ts";
import { createDiagnosticReport } from "../src/features/diagnostics.ts";
const html =
  '<header id="page-header"><span>PRIVATE TITLE · Work</span><div><button id="share">Share</button><button id="more" aria-haspopup="menu">More</button><button id="files" aria-label="Files and sources">Files</button></div></header><main><div id="thread"><div data-message-author-role="user"><div class="whitespace-pre-wrap">PRIVATE PROMPT <code>code</code></div></div><div data-message-role="assistant"><div class="markdown"><p>PRIVATE ANSWER</p><pre><code>const x = 1</code></pre><button id="copy">Copy</button></div></div><div data-testid="user-message">SECOND PROMPT</div></div></main><form><div id="composer-background"><textarea id="prompt-textarea">PRIVATE DRAFT</textarea><button type="button" data-testid="send-button">Send</button></div></form>';
function setup() {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    url: "https://chatgpt.com/c/test",
  });
  for (const key of [
    "window",
    "document",
    "location",
    "HTMLElement",
    "Element",
  ] as const)
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  document.querySelector<HTMLElement>("header")!.getBoundingClientRect = () =>
    rect(0, 0, 1440, 48);
  Object.defineProperty(dom.window, "innerWidth", {
    value: 1440,
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
    toJSON() {
      return {};
    },
  };
}
test("message roles work without article wrappers and exclude side panels, drafts and nested duplicates", () => {
  const dom = setup();
  try {
    document
      .querySelector("[data-message-author-role=user]")!
      .firstElementChild!.setAttribute("data-testid", "user-message");
    const aside = document.createElement("aside");
    aside.innerHTML = '<div data-message-author-role="user">Example</div>';
    document.body.append(aside);
    assert.deepEqual(
      resolveMessages().map((r) => r.role),
      ["user", "assistant", "user"],
    );
    assert.equal(
      resolveMessages()[0].node.hasAttribute("data-message-author-role"),
      true,
    );
  } finally {
    dom.window.close();
  }
});
test("cards preserve message nodes, controls and draft; modules toggle and detached badges clean up", () => {
  const dom = setup(),
    feature = new MessageLayout(),
    state = initialState();
  try {
    state.settings.layout.userName = "<script>user</script>";
    state.personas.push({
      id: "nagi",
      name: "nAGI",
      instructions: "",
      avatars: { idle: "data:image/png;base64,AAAA" },
      version: 1,
      history: [],
    });
    const selection = { ...emptySelection(), personaId: "nagi" };
    const messages = resolveMessages(),
      user = messages[0].node,
      assistant = messages[1].node;
    const original = assistant.querySelector(".markdown")!,
      code = assistant.querySelector("code")!;
    const copy = document.querySelector<HTMLButtonElement>("#copy")!;
    let copies = 0;
    copy.addEventListener("click", () => copies++);
    feature.apply(state, selection, "idle");
    assert.equal(assistant.querySelector(".markdown"), original);
    assert.equal(assistant.querySelector("code"), code);
    copy.click();
    assert.equal(copies, 1);
    assert.equal(
      document.querySelector<HTMLTextAreaElement>("textarea")!.value,
      "PRIVATE DRAFT",
    );
    assert.equal(user.getAttribute("data-nagi-message"), "user");
    assert.equal(assistant.getAttribute("data-nagi-message"), "assistant");
    const badge = user.querySelector("[data-nagi-owned]")!.shadowRoot!;
    assert.equal(
      badge.querySelector(".name")!.textContent,
      "<script>user</script>",
    );
    assert.equal(badge.querySelector("script"), null);
    assert.equal(
      assistant
        .querySelector("[data-nagi-owned]")!
        .shadowRoot!.querySelector("img")!
        .getAttribute("src"),
      "data:image/png;base64,AAAA",
    );
    state.settings.layout.messageCards = false;
    feature.apply(state, selection, "idle");
    assert.equal(
      document.querySelectorAll("[data-nagi-message-card]").length,
      0,
    );
    assert.equal(
      document.querySelectorAll("[data-nagi-owned=message-identity]").length,
      3,
    );
    state.settings.layout.messageAvatars = false;
    state.settings.layout.messageNames = false;
    feature.apply(state, selection, "idle");
    assert.equal(document.querySelectorAll("[data-nagi-message]").length, 0);
    state.settings.layout.messageNames = true;
    feature.apply(state, selection, "idle");
    user.remove();
    feature.apply(state, selection, "idle");
    assert.equal(user.querySelector("[data-nagi-owned]"), null);
    assert.equal(user.hasAttribute("data-nagi-message"), false);
    state.settings.enabled = false;
    feature.apply(state, selection, "idle");
    assert.equal(document.querySelectorAll("[data-nagi-message]").length, 0);
  } finally {
    feature.dispose();
    dom.window.close();
  }
});
test("native share/menu/files are docked in place, anchored to the visible slot, restored on toggle and never clicked automatically", () => {
  const dom = setup(),
    bridge = new ContextHeaderBridge();
  try {
    const header = document.querySelector("header")!,
      original = header.outerHTML;
    const buttons = [...header.querySelectorAll("button")],
      parents = buttons.map((b) => b.parentNode);
    let actions = 0;
    buttons.forEach((b) => b.addEventListener("click", () => actions++));
    const slot = document.createElement("div");
    slot.getBoundingClientRect = () => rect(950, 98, 250, 34);
    document.body.append(slot);
    bridge.refresh(slot, true);
    assert.equal(actions, 0);
    assert.equal(buttons[0].style.getPropertyValue("--nagi-dock-x"), "950px");
    assert.equal(buttons[0].style.getPropertyValue("--nagi-dock-y"), "98px");
    buttons.forEach((b, i) => {
      assert.equal(b.parentNode, parents[i]);
      b.click();
    });
    assert.equal(actions, 3);
    const popup = document.createElement("div");
    popup.setAttribute("role", "menu");
    popup.innerHTML = "<button>Rename</button>";
    header.append(popup);
    bridge.refresh(slot, true);
    assert.equal(
      popup.firstElementChild!.hasAttribute("data-nagi-docked"),
      false,
    );
    popup.remove();
    bridge.refresh(slot, false);
    assert.equal(header.outerHTML, original);
    bridge.refresh(slot, true);
    const next = document.createElement("header");
    next.innerHTML = "<button>Share</button>";
    next.getBoundingClientRect = () => rect(0, 0, 1440, 48);
    header.replaceWith(next);
    bridge.refresh(slot, true);
    assert.equal(header.hasAttribute("data-nagi-context-header"), false);
    assert.equal(next.hasAttribute("data-nagi-context-header"), true);
  } finally {
    bridge.dispose();
    dom.window.close();
  }
});
test("prompt navigation counts sent user messages, scrolls loaded nodes, respects reduced motion and handles route changes", () => {
  const dom = setup(),
    nav = new PromptNavigator(() => {});
  try {
    const users = resolveMessages()
      .filter((r) => r.role === "user")
      .map((r) => r.node);
    let scrolled: unknown = null;
    users[0].getBoundingClientRect = () => rect(0, -500, 500, 120);
    users[1].getBoundingClientRect = () => rect(0, 180, 500, 120);
    users[1].scrollIntoView = (options) => {
      scrolled = options;
    };
    nav.update(true, true);
    assert.equal(nav.host.textContent!.includes("Prompt 1 / 2"), true);
    nav.host
      .querySelector<HTMLButtonElement>('[aria-label="Próximo prompt"]')!
      .click();
    assert.deepEqual(scrolled, { behavior: "auto", block: "start" });
    const panel = document.createElement("div");
    nav.renderList(panel, () => {});
    assert.equal(panel.querySelectorAll("button").length, 2);
    assert.equal(panel.textContent!.includes("PRIVATE DRAFT"), false);
    assert.equal(panel.textContent!.includes("PRIVATE ANSWER"), false);
    dom.window.history.pushState({}, "", "/c/other");
    users.forEach((n) => n.remove());
    nav.update(true, false);
    assert.equal(
      nav.host.textContent!.includes("Sem prompts detectados"),
      true,
    );
    assert.equal(
      nav.host.querySelector<HTMLButtonElement>(
        '[aria-label="Próximo prompt"]',
      )!.disabled,
      true,
    );
    nav.update(false, false);
    assert.equal(
      document.querySelectorAll("[data-nagi-prompt-target]").length,
      0,
    );
  } finally {
    nav.dispose();
    dom.window.close();
  }
});
test("context separates actual project/work/chain/persona and chain session links from prompt arrows", () => {
  const dom = setup(),
    state = initialState(),
    bar = new ContextBar(() => {}, document.createElement("div"));
  try {
    document.querySelector("header span")!.textContent = "Current · Work";
    state.chains.push({
      id: "chain",
      name: "Campaign",
      projectId: "g-p-test",
      sessions: [
        { id: "before", title: "Before", url: "https://chatgpt.com/c/before" },
        { id: "test", title: "Current", url: "https://chatgpt.com/c/test" },
        { id: "after", title: "After", url: "https://chatgpt.com/c/after" },
      ],
      currentSession: "test",
      defaultPersonaId: null,
      lastPersonaId: null,
      rememberLastPersona: true,
      continuationMessage: "",
      version: 1,
    });
    bar.update(
      state,
      { ...emptySelection(), chainId: "chain" },
      {
        route: "/c/test",
        conversation: state.chains[0].sessions[1],
        projectId: "g-p-test",
        phase: "idle",
        health: { composer: true, send: true, sidebar: false, turns: 3 },
        scanMs: 0,
      },
      [
        {
          id: "g-p-test",
          title: "Project",
          url: "https://chatgpt.com/g/g-p-test/project",
        },
      ],
    );
    assert.ok(bar.host.textContent!.includes("Work"));
    assert.ok(bar.host.textContent!.includes("Campaign"));
    assert.ok(bar.host.textContent!.includes("Persona: ChatGPT"));
    assert.equal(
      bar.host.querySelector<HTMLAnchorElement>(
        '[aria-label="Próxima sessão da Chain"]',
      )!.href,
      "https://chatgpt.com/c/after",
    );
    assert.equal(bar.host.querySelector(".chat-title")!.textContent, "Current");
  } finally {
    dom.window.close();
  }
});
test("composer identity does not replace the editor, send node or draft and removes itself when its module is off", () => {
  const dom = setup();
  let opens = 0;
  const feature = new ComposerIdentity(() => opens++),
    state = initialState();
  try {
    const editor = document.querySelector("textarea"),
      send = document.querySelector("[data-testid=send-button]");
    feature.apply(state, emptySelection());
    const host = document.querySelector("[data-nagi-owned=composer-identity]")!;
    host.shadowRoot!.querySelector("button")!.click();
    assert.equal(opens, 1);
    assert.equal(document.querySelector("textarea"), editor);
    assert.equal(document.querySelector("[data-testid=send-button]"), send);
    state.settings.layout.composerFrame = false;
    feature.apply(state, emptySelection());
    assert.equal(
      document.querySelector("[data-nagi-owned=composer-identity]"),
      null,
    );
  } finally {
    feature.dispose();
    dom.window.close();
  }
});
test("diagnostics include module coverage but exclude prompt previews and local user identity", () => {
  const dom = setup(),
    state = initialState(),
    layout = new LayoutTheme(),
    messages = new MessageLayout();
  try {
    state.settings.layout.userName = "PRIVATE NAME";
    state.settings.layout.userAvatar = "data:image/png;base64,PRIVATEAVATAR";
    layout.apply(state.settings);
    messages.apply(state, emptySelection(), "idle");
    const report = createDiagnosticReport(state),
      json = JSON.stringify(report);
    assert.equal(report.counts.userMessages, 2);
    assert.equal(report.counts.assistantMessages, 1);
    assert.equal(report.active.messageCards, 3);
    assert.equal(report.settings.layout.hasUserAvatar, true);
    for (const secret of [
      "PRIVATE NAME",
      "PRIVATEAVATAR",
      "PRIVATE PROMPT",
      "PRIVATE ANSWER",
      "PRIVATE DRAFT",
      "PRIVATE TITLE",
    ])
      assert.equal(json.includes(secret), false, secret);
    state.settings.enabled = false;
    layout.apply(state.settings);
    assert.equal(
      document.documentElement.hasAttribute("data-nagi-layout"),
      false,
    );
    assert.equal(
      document.querySelectorAll("[data-nagi-layout-composer]").length,
      0,
    );
  } finally {
    messages.dispose();
    layout.dispose();
    dom.window.close();
  }
});

test("header context does not infer Work from an ordinary chat title and reads explicit title/project hooks", () => {
  const dom = setup();
  try {
    const header = document.querySelector<HTMLElement>("header")!;
    header.innerHTML =
      '<h1>My Work notes</h1><a href="https://chatgpt.com/g/g-p-real/project">Real project</a><button>Share</button>';
    const result = readHeaderContext(header);
    assert.equal(result.work, false);
    assert.equal(result.title, "My Work notes");
    assert.equal(result.project?.title, "Real project");
    header.append(document.createTextNode("Work"));
    assert.equal(readHeaderContext(header).work, true);
  } finally {
    dom.window.close();
  }
});
