import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { resolveHeader } from "../src/adapter/header.ts";
import { HeaderIntegration } from "../src/features/header.ts";
import { createDiagnosticReport } from "../src/features/diagnostics.ts";
import { initialState } from "../src/shared/model.ts";
const bar =
  '<div id="top-strip" style="background:black"><div><span>PRIVATE TITLE · Work</span></div><div id="actions"><button id="share">Share</button><button id="menu" aria-haspopup="menu" aria-label="More options">…</button><button id="files" aria-label="Files and sources">Files</button></div></div>';
function setup(html = bar) {
  const dom = new JSDOM(
    `<!doctype html><body><div id="app">${html}<main><article><button>Share</button><button>More</button></article><textarea id="prompt-textarea"></textarea></main><aside>Sources</aside></div></body>`,
    { url: "https://chatgpt.com/c/test" },
  );
  for (const key of ["window", "document", "HTMLElement", "Element"] as const)
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  Object.defineProperty(dom.window, "innerWidth", {
    value: 1440,
    writable: true,
  });
  const header = document.querySelector<HTMLElement>("#top-strip")!;
  let width = 1440;
  header.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    right: width,
    top: 0,
    bottom: 48,
    width,
    height: 48,
    toJSON() {
      return {};
    },
  });
  return {
    dom,
    header,
    width(value: number) {
      width = value;
    },
  };
}
test("Work fallback resolves the shallow top bar, never conversation or right panel", () => {
  const f = setup();
  try {
    assert.equal(resolveHeader(), f.header);
    f.header.remove();
    assert.equal(resolveHeader(), null);
  } finally {
    f.dom.window.close();
  }
});
test("native actions and popover anchors survive integration; theme and two-row sizing are independent", () => {
  const f = setup();
  const feature = new HeaderIntegration();
  const settings = initialState().settings;
  try {
    const buttons = [...f.header.querySelectorAll("button")];
    const parents = buttons.map((b) => b.parentNode);
    let clicks = 0;
    buttons.forEach((b) => b.addEventListener("click", () => clicks++));
    assert.equal(feature.refresh(settings, 480), true);
    assert.equal(clicks, 0);
    assert.equal(
      document.documentElement.hasAttribute("data-nagi-theme"),
      false,
    );
    buttons.forEach((b, i) => {
      assert.equal(b.parentNode, parents[i]);
      b.click();
    });
    assert.equal(clicks, 3);
    assert.equal(buttons[1].getAttribute("aria-haspopup"), "menu");
    assert.equal(
      document.documentElement.hasAttribute("data-nagi-header-stacked"),
      false,
    );
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.innerHTML = '<button role="menuitem">Rename</button>';
    f.header.append(menu);
    feature.refresh(settings, 480);
    assert.equal(
      menu.querySelector("button")!.hasAttribute("data-nagi-header-control"),
      false,
    );
    f.width(800);
    feature.refresh(settings, 480);
    assert.equal(
      document.documentElement.hasAttribute("data-nagi-header-stacked"),
      true,
    );
    assert.equal(f.header.style.background, "black"); // underlying native inline style retained
  } finally {
    feature.dispose();
    f.dom.window.close();
  }
});
test("pause, native navigation and disposal restore the original header without stale marks", () => {
  const f = setup();
  const feature = new HeaderIntegration();
  const settings = initialState().settings;
  try {
    const original = f.header.outerHTML;
    feature.refresh(settings, 480);
    feature.refresh({ ...settings, enabled: false }, 480);
    assert.equal(f.header.outerHTML, original);
    feature.refresh(settings, 480);
    feature.refresh({ ...settings, navigation: "native" }, 480);
    assert.equal(f.header.outerHTML, original);
    feature.refresh(settings, 480);
    feature.dispose();
    assert.equal(f.header.outerHTML, original);
    assert.equal(
      document.documentElement.hasAttribute("data-nagi-header-active"),
      false,
    );
  } finally {
    feature.dispose();
    f.dom.window.close();
  }
});
test("React header replacement removes marks from old nodes and integrates the replacement", () => {
  const f = setup();
  const feature = new HeaderIntegration();
  const settings = initialState().settings;
  try {
    feature.refresh(settings, 480);
    const next = document.createElement("header");
    next.innerHTML = "<span>Next chat</span><button>Share</button>";
    next.getBoundingClientRect = f.header.getBoundingClientRect;
    f.header.replaceWith(next);
    feature.refresh(settings, 480);
    assert.equal(f.header.hasAttribute("data-nagi-header"), false);
    assert.equal(
      f.header.querySelectorAll("[data-nagi-header-control]").length,
      0,
    );
    assert.equal(next.hasAttribute("data-nagi-header"), true);
  } finally {
    feature.dispose();
    f.dom.window.close();
  }
});
test("header diagnostics expose action categories and geometry without titles, labels or IDs", () => {
  const f = setup();
  const feature = new HeaderIntegration();
  const state = initialState();
  try {
    feature.refresh(state.settings, 480);
    document.querySelector("#menu")!.setAttribute("title", "PRIVATE LABEL");
    const report = createDiagnosticReport(state);
    assert.equal(report.matches.header, true);
    assert.deepEqual(report.matches.headerControls, ["share", "menu", "files"]);
    assert.equal(report.active.headerIntegration, true);
    const json = JSON.stringify(report);
    assert.equal(json.includes("PRIVATE TITLE"), false);
    assert.equal(json.includes("PRIVATE LABEL"), false);
    assert.equal(json.includes("top-strip"), false);
  } finally {
    feature.dispose();
    f.dom.window.close();
  }
});
