import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { DOMChatGPTAdapter } from "../src/adapter/chatgpt.ts";
import { Appearance } from "../src/features/appearance.ts";
import { initialState } from "../src/shared/model.ts";
import { createDiagnosticReport } from "../src/features/diagnostics.ts";
import { resolveRegions } from "../src/adapter/regions.ts";
function setup(body: string) {
  const dom = new JSDOM(`<!doctype html><body>${body}</body>`, {
    url: "https://chatgpt.com/c/private-conversation-id",
  });
  for (const k of [
    "window",
    "document",
    "location",
    "Element",
    "HTMLElement",
    "HTMLTextAreaElement",
    "KeyboardEvent",
  ] as const)
    Object.defineProperty(globalThis, k, {
      value: (dom.window as any)[k],
      writable: true,
      configurable: true,
    });
  return dom;
}
const layout = `<div id="app-layout"><div id="sidebar-slot" style="width:260px"><div id="stage-slideover-sidebar"><div id="sidebar-interior"><nav id="history"><a href="/c/private-session">Secret title</a></nav><footer>Private account</footer></div></div><div id="stage-sidebar-tiny-bar">Rail</div></div><section id="page"><main><article data-testid="conversation-turn-1"><div data-message-author-role="assistant"><div class="markdown">Private answer</div></div></article></main><div id="thread-bottom-container" style="background:black"><div id="composer-pad"><form><div id="composer-background" style="background:rgb(0,0,0);border:8px solid black;box-shadow:0 0 5px black"><div id="editor-wrapper"><textarea id="prompt-textarea">Private draft</textarea></div><div id="tool-row"><button data-testid="send-button">Send</button><button aria-label="Attach">+</button></div></div></form></div></div></section></div>`;
test("sidebar collapse removes the entire reserved slot, history, account footer and rail, then restores it", () => {
  const dom = setup(layout);
  const appearance = new Appearance();
  const adapter = new DOMChatGPTAdapter();
  try {
    const regions = resolveRegions();
    assert.deepEqual(
      regions.sidebar.map((e) => e.id),
      ["sidebar-slot"],
    );
    assert.equal(adapter.showSidebar(false), true);
    assert.equal(
      dom.window.getComputedStyle(document.querySelector("#sidebar-slot")!)
        .display,
      "none",
    );
    assert.equal(
      document.querySelector("#app-layout")!.hasAttribute("data-nagi-sidebar"),
      false,
    );
    assert.equal(
      document.querySelector("#page")!.hasAttribute("data-nagi-sidebar"),
      false,
    );
    adapter.showSidebar(true);
    assert.notEqual(
      dom.window.getComputedStyle(document.querySelector("#sidebar-slot")!)
        .display,
      "none",
    );
    assert.equal(
      (document.querySelector("#sidebar-slot") as HTMLElement).style.width,
      "260px",
    );
  } finally {
    appearance.dispose();
    dom.window.close();
  }
});
test("unknown sidebar ID can be found from navigation structure without hiding chat message navigation", () => {
  const dom = setup(
    '<div><aside id="new-sidebar"><div><nav><a href="/c/test">History</a></nav></div><footer>Account</footer></aside><main><article data-message-author-role="assistant"><nav id="history"><a href="/c/test">Example in answer</a></nav></article><textarea id="prompt-textarea"></textarea></main></div>',
  );
  try {
    const regions = resolveRegions();
    assert.deepEqual(
      regions.sidebar.map((e) => e.id),
      ["new-sidebar"],
    );
    assert.equal(regions.composerRoot?.id, "prompt-textarea");
  } finally {
    dom.window.close();
  }
});
test("composer covers editor and tool wrappers, does not repaint the conversation and cleans replaced nodes", () => {
  const dom = setup(layout);
  const theme = new Appearance();
  const s = initialState().settings;
  try {
    theme.apply(s);
    const r = resolveRegions();
    assert.equal(r.composerRoot?.tagName, "FORM");
    assert.ok(r.composerLayers.some((e) => e.id === "tool-row"));
    assert.ok(r.composerLayers.some((e) => e.id === "composer-background"));
    assert.ok(r.composerOuter.some((e) => e.id === "thread-bottom-container"));
    assert.equal(
      document
        .querySelector("article")!
        .hasAttribute("data-nagi-composer-layer"),
      false,
    );
    const old = document.querySelector("form")!;
    const replacement = old.cloneNode(true) as HTMLElement;
    old.replaceWith(replacement);
    theme.refreshRegions(s);
    assert.equal(old.hasAttribute("data-nagi-composer-root"), false);
    assert.equal(replacement.hasAttribute("data-nagi-composer-root"), true);
    s.enabled = false;
    theme.apply(s);
    assert.equal(
      document.querySelectorAll(
        "[data-nagi-composer-root],[data-nagi-composer-layer],[data-nagi-composer-outer],[data-nagi-surface]",
      ).length,
      0,
    );
    assert.equal(
      (document.querySelector("#composer-background") as HTMLElement).style
        .border,
      "8px solid black",
    );
  } finally {
    theme.dispose();
    dom.window.close();
  }
});
test("diagnostic report is allowlisted and excludes text, raw HTML, URLs and private settings/entities", () => {
  const dom = setup(layout);
  const state = initialState();
  try {
    state.personas.push({
      id: "PRIVATEPERSONAID",
      name: "PRIVATENAME",
      instructions: "PRIVATEINSTRUCTIONS",
      avatars: { idle: "data:image/png;base64,PRIVATEIMAGE" },
      history: [],
      version: 1,
    });
    const root = document.querySelector("#composer-background")!;
    root.setAttribute("title", "PRIVATETITLE");
    root.setAttribute("data-unknown", "PRIVATEATTR");
    root.className =
      "rounded-xl bg-token-main-surface-primary PRIVATECLASS bg-token-SECRETCLASS bg-[url(SECRETASSET)]";
    (state.settings as any).futureSecret = "PRIVATEFUTURE";
    const report = createDiagnosticReport(state);
    const json = JSON.stringify(report);
    for (const secret of [
      "Private answer",
      "Private draft",
      "Secret title",
      "Private account",
      "private-conversation-id",
      "private-session",
      "PRIVATEPERSONAID",
      "PRIVATENAME",
      "PRIVATEINSTRUCTIONS",
      "PRIVATEIMAGE",
      "PRIVATETITLE",
      "PRIVATEATTR",
      "PRIVATECLASS",
      "SECRETCLASS",
      "SECRETASSET",
      "PRIVATEFUTURE",
    ])
      assert.equal(json.includes(secret), false, secret);
    assert.equal(report.counts.personas, 1);
    assert.equal(report.matches.composer, true);
    assert.equal(report.settings.theme.composer, state.settings.theme.composer);
    assert.ok(json.includes("rounded-xl"));
    assert.ok(json.includes("bg-token-main-surface-primary"));
  } finally {
    dom.window.close();
  }
});
