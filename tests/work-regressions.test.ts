import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { resolveHeader } from "../src/adapter/header.ts";
import { resolveMessageGroups } from "../src/adapter/messages.ts";
import { resolveRegions } from "../src/adapter/regions.ts";
import { MessageLayout } from "../src/features/message-layout.ts";
import { LayoutTheme } from "../src/features/layout-theme.ts";
import {
  ContextHeaderBridge,
  fixedCoordinates,
} from "../src/features/context-header.ts";
import { AuxiliaryPanels } from "../src/features/auxiliary-panels.ts";
import { initialState, emptySelection, presets } from "../src/shared/model.ts";
import { migrate } from "../src/shared/validation.ts";

function setup(body: string) {
  const dom = new JSDOM(`<!doctype html><body>${body}</body>`, {
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
      value: dom.window[key],
      configurable: true,
      writable: true,
    });
  Object.defineProperty(dom.window, "innerWidth", {
    value: 2338,
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
const work = `<div id="real-header"><span>Chat · Work</span><button>Share</button><button aria-haspopup="menu">More</button><button aria-label="Files and sources">Files</button></div><main><div id="thread"><section id="user"><div data-message-author-role="user">Prompt</div></section><section id="answer"><div id="reasoning"><button id="worked">Worked for 22m 42s</button></div><div id="answer-body"><div id="response" data-message-author-role="assistant"><div class="markdown">Answer</div></div><div id="feedback"><button id="copy" data-testid="copy-turn-action-button">Copy</button><button>Good response</button><button>Share</button><button aria-haspopup="menu">More</button></div></div></section></div></main>`;

test("Work feedback cannot become the header, even at the top of the viewport or with a stale integration mark", () => {
  const dom = setup(work),
    bridge = new ContextHeaderBridge();
  try {
    const header = document.querySelector<HTMLElement>("#real-header")!;
    const feedback = document.querySelector<HTMLElement>("#feedback")!;
    header.getBoundingClientRect = () => rect(0, 0, 2338, 48);
    feedback.getBoundingClientRect = () => rect(85, 0, 2167, 142.5);
    feedback.setAttribute("data-nagi-context-header", "");
    assert.equal(resolveHeader(), header);
    feedback.removeAttribute("data-nagi-context-header");
    const slot = document.createElement("div");
    slot.getBoundingClientRect = () => rect(1800, 98, 250, 34);
    document.body.append(slot);
    bridge.refresh(slot, true);
    assert.equal(header.querySelectorAll("[data-nagi-docked]").length, 3);
    assert.equal(feedback.querySelectorAll("[data-nagi-docked]").length, 0);
    bridge.refresh(slot, false);
    header.remove();
    assert.equal(resolveHeader(), null);
  } finally {
    bridge.dispose();
    dom.window.close();
  }
});

test("Work reasoning and action siblings share the message envelope, retain handlers and restore on pause", () => {
  const dom = setup(work),
    layout = new MessageLayout(),
    state = initialState();
  try {
    const groups = resolveMessageGroups();
    assert.deepEqual(
      groups.map((g) => g.envelope.id),
      ["user", "answer"],
    );
    assert.deepEqual(groups[1].accessories.map((n) => n.id).sort(), [
      "feedback",
      "reasoning",
    ]);
    const answer = document.querySelector<HTMLElement>("#answer")!;
    const before = answer.outerHTML;
    const copy = document.querySelector<HTMLButtonElement>("#copy")!;
    const worked = document.querySelector<HTMLButtonElement>("#worked")!;
    const parents = [copy.parentNode, worked.parentNode];
    let clicks = 0;
    [copy, worked].forEach((b) => b.addEventListener("click", () => clicks++));
    layout.apply(state, emptySelection(), "idle");
    assert.equal(answer.hasAttribute("data-nagi-message-envelope"), true);
    assert.equal(
      document.querySelectorAll("[data-nagi-message-accessory]").length,
      2,
    );
    assert.equal(
      document
        .querySelector("#response")!
        .hasAttribute("data-nagi-message-grouped"),
      true,
    );
    assert.equal(
      document
        .querySelector("#thread")!
        .hasAttribute("data-nagi-message-envelope"),
      false,
    );
    [copy, worked].forEach((b, i) => {
      assert.equal(b.parentNode, parents[i]);
      b.click();
    });
    assert.equal(clicks, 2);
    state.settings.enabled = false;
    layout.apply(state, emptySelection(), "idle");
    assert.equal(answer.outerHTML, before);
  } finally {
    layout.dispose();
    dom.window.close();
  }
});

test("composer cleanup reaches beyond eight wrappers without touching conversation content or the draft", () => {
  let composer =
    '<form><textarea id="prompt-textarea">Draft intact</textarea><button>Send</button></form>';
  for (let i = 0; i < 12; i++)
    composer = `<div id="layer-${i}" style="background:black">${composer}${i === 10 ? '<div id="shade" aria-hidden="true" style="background:black"></div><button id="tool" aria-hidden="true"></button>' : ""}</div>`;
  const dom = setup(
      `<main><section data-message-author-role="assistant">Answer</section>${composer}</main>`,
    ),
    layout = new LayoutTheme(),
    state = initialState();
  try {
    const before = document.querySelector("main")!.outerHTML;
    const regions = resolveRegions();
    assert.equal(regions.composerOuter.length, 12);
    assert.deepEqual(
      regions.composerDecorations.map((n) => n.id),
      ["shade"],
    );
    layout.apply(state.settings);
    assert.equal(
      document
        .querySelector("#layer-11")!
        .hasAttribute("data-nagi-layout-outer"),
      true,
    );
    assert.equal(
      document
        .querySelector("#shade")!
        .hasAttribute("data-nagi-layout-decoration"),
      true,
    );
    assert.equal(
      document.querySelector("main")!.hasAttribute("data-nagi-layout-outer"),
      false,
    );
    assert.equal(
      document.querySelector("section")!.hasAttribute("data-nagi-layout-outer"),
      false,
    );
    assert.equal(document.querySelector("textarea")!.value, "Draft intact");
    state.settings.enabled = false;
    layout.apply(state.settings);
    assert.equal(document.querySelector("main")!.outerHTML, before);
  } finally {
    layout.dispose();
    dom.window.close();
  }
});

test("right panel clears the measured shell without cumulative translation; left sidebar and native styles are preserved", () => {
  const dom = setup(
      '<aside id="left">Navigation</aside><aside id="right">Files and sources</aside>',
    ),
    panels = new AuxiliaryPanels();
  try {
    const left = document.querySelector<HTMLElement>("#left")!,
      right = document.querySelector<HTMLElement>("#right")!;
    left.getBoundingClientRect = () => rect(0, 52, 300, 517);
    right.getBoundingClientRect = () =>
      rect(
        2000,
        52 +
          (right.hasAttribute("data-nagi-aux-panel")
            ? parseFloat(right.style.getPropertyValue("--nagi-panel-shift"))
            : 0),
        300,
        517,
      );
    document.documentElement.style.setProperty(
      "--nagi-shell-height",
      "142.5px",
    );
    panels.apply(true);
    assert.equal(right.style.getPropertyValue("--nagi-panel-shift"), "102.5px");
    panels.apply(true);
    assert.equal(right.style.getPropertyValue("--nagi-panel-shift"), "102.5px");
    assert.equal(left.hasAttribute("data-nagi-aux-panel"), false);
    document.documentElement.style.setProperty("--nagi-shell-height", "180px");
    panels.apply(true);
    assert.equal(right.style.getPropertyValue("--nagi-panel-shift"), "140px");
    panels.apply(false);
    assert.equal(
      right.outerHTML,
      '<aside id="right">Files and sources</aside>',
    );
  } finally {
    panels.dispose();
    dom.window.close();
  }
});

test("header control coordinates account for a scaled and scrolled fixed containing block", () => {
  const dom = setup(
    '<div id="container" style="transform:scale(0.8)"><button>Share</button></div>',
  );
  try {
    const parent = document.querySelector<HTMLElement>("#container")!,
      button = document.querySelector("button")!;
    parent.getBoundingClientRect = () => rect(80, 40, 800, 400);
    for (const [key, value] of Object.entries({
      offsetWidth: 1000,
      offsetHeight: 500,
      clientLeft: 2,
      clientTop: 3,
      scrollLeft: 10,
      scrollTop: 120,
    }))
      Object.defineProperty(parent, key, { value });
    assert.deepEqual(fixedCoordinates(button, 400, 100), { x: 408, y: 192 });
    parent.style.transform = "none";
    assert.deepEqual(fixedCoordinates(button, 400, 100), { x: 400, y: 100 });
  } finally {
    dom.window.close();
  }
});

test("new installations use Network colors and layout; updates retain saved customization", () => {
  const fresh = migrate(undefined);
  assert.deepEqual(fresh.settings.theme, presets.Network);
  assert.equal(fresh.settings.theme.background, "#03131f");
  assert.equal(fresh.settings.theme.width, 1040);
  assert.equal(fresh.settings.layout.variant, "network");
  assert.equal(fresh.settings.enabled, true);
  assert.equal(fresh.settings.hideSidebar, true);
  const saved = initialState();
  saved.settings.theme.font = "Georgia";
  saved.settings.theme.background = "#123456";
  saved.settings.hideSidebar = false;
  assert.deepEqual(migrate(saved), saved);
});

test("legacy appearance opt-out is retired while saved palette, pause and sidebar choices survive", () => {
  const saved = {
    ...initialState(),
    settings: { ...initialState().settings, appearance: false },
  };
  saved.settings.theme.background = "#123456";
  saved.settings.enabled = false;
  saved.settings.hideSidebar = false;
  const migrated = migrate(saved);
  assert.equal("appearance" in migrated.settings, false);
  assert.equal(migrated.settings.theme.background, "#123456");
  assert.equal(migrated.settings.enabled, false);
  assert.equal(migrated.settings.hideSidebar, false);
});

test("user cards shrink to content and remain right-aligned without changing assistant width or native nodes", () => {
  const dom = setup(work),
    layout = new MessageLayout(),
    state = initialState();
  try {
    const user = document.querySelector<HTMLElement>(
      "[data-message-author-role=user]",
    )!;
    const text = user.firstChild;
    layout.apply(state, emptySelection(), "idle");
    assert.equal(dom.window.getComputedStyle(user).width, "fit-content");
    assert.equal(dom.window.getComputedStyle(user).marginLeft, "auto");
    assert.equal(
      dom.window.getComputedStyle(document.querySelector("#response")!).width,
      "100%",
    );
    assert.equal(user.firstChild, text);
    text!.textContent = "A long prompt ".repeat(100);
    layout.apply(state, emptySelection(), "idle");
    assert.equal(dom.window.getComputedStyle(user).maxWidth, "100%");
    assert.equal(dom.window.getComputedStyle(user).overflowWrap, "anywhere");
    state.settings.layout.messageCards = false;
    layout.apply(state, emptySelection(), "idle");
    assert.equal(user.hasAttribute("data-nagi-message-card"), false);
  } finally {
    layout.dispose();
    dom.window.close();
  }
});

function personaState() {
  const state = initialState();
  state.personas.push({
    id: "nagi",
    name: "nAGI",
    instructions: "",
    avatars: {
      idle: "data:image/png;base64,AAAA",
      thinking: "data:image/png;base64,BBBB",
      talking: "data:image/png;base64,CCCC",
    },
    version: 1,
    history: [],
  });
  return state;
}
const personaSelection = { ...emptySelection(), personaId: "nagi" };

test("thinking before the answer exists shows name, status and thinking avatar without relabeling history", () => {
  const dom = setup(work),
    layout = new MessageLayout(),
    state = personaState();
  try {
    const user = document.createElement("section");
    user.innerHTML = '<div data-message-author-role="user">Next prompt</div>';
    document.querySelector("#thread")!.append(user);
    layout.apply(state, personaSelection, "thinking");
    const pending = document.querySelector(
      "[data-nagi-owned=thinking-placeholder]",
    )!;
    const badge = pending.querySelector(
      "[data-nagi-owned=message-identity]",
    )!.shadowRoot!;
    assert.equal(
      badge.querySelector("img")!.getAttribute("src"),
      state.personas[0].avatars.thinking,
    );
    assert.equal(badge.querySelector(".name")!.textContent, "nAGI");
    assert.equal(badge.querySelector(".status")!.textContent, "Thinking...");
    assert.equal(badge.querySelector<HTMLElement>(".status")!.hidden, false);
    const old = document.querySelector(
      "#response [data-nagi-owned=message-identity]",
    )!.shadowRoot!;
    assert.equal(
      old.querySelector("img")!.getAttribute("src"),
      state.personas[0].avatars.idle,
    );
    assert.equal(old.querySelector<HTMLElement>(".status")!.hidden, true);
    layout.apply(state, personaSelection, "thinking");
    assert.equal(
      document.querySelectorAll("[data-nagi-owned=thinking-placeholder]")
        .length,
      1,
    );
    assert.equal(
      document.querySelector("[data-nagi-owned=thinking-placeholder]"),
      pending,
    );
    assert.equal(resolveMessageGroups().length, 3);
    layout.apply(state, personaSelection, "idle");
    assert.equal(
      document.querySelector("[data-nagi-owned=thinking-placeholder]"),
      null,
    );
  } finally {
    layout.dispose();
    dom.window.close();
  }
});

test("reasoning identity remains beside its own block after subsequent steps and the final answer", () => {
  const dom = setup(work),
    layout = new MessageLayout(),
    state = personaState();
  try {
    const answer = document.querySelector<HTMLElement>("#answer")!;
    const reasoning = document.querySelector<HTMLElement>("#reasoning")!;
    const worked = document.querySelector("#worked");
    layout.apply(state, personaSelection, "thinking");
    const host = reasoning.querySelector("[data-nagi-owned=message-identity]")!;
    assert.equal(host.parentElement, reasoning);
    assert.equal(reasoning.hasAttribute("data-nagi-reasoning"), true);
    assert.equal(
      host.shadowRoot!.querySelector("img")!.getAttribute("src"),
      state.personas[0].avatars.thinking,
    );
    const second = document.createElement("details");
    second.innerHTML =
      "<summary>Working for 3 seconds</summary><p>Next reasoning step</p>";
    reasoning.after(second);
    layout.apply(state, personaSelection, "thinking");
    assert.equal(host.parentElement, reasoning);
    assert.equal(
      second.querySelectorAll("[data-nagi-owned=message-identity]").length,
      1,
    );
    assert.equal(
      host.shadowRoot!.querySelector(".status")!.textContent,
      "Raciocínio",
    );
    layout.apply(state, personaSelection, "talking");
    layout.apply(state, personaSelection, "idle");
    assert.equal(host.parentElement, reasoning);
    assert.equal(
      host.shadowRoot!.querySelector("img")!.getAttribute("src"),
      state.personas[0].avatars.thinking,
    );
    assert.equal(document.querySelector("#worked"), worked);
    assert.equal(
      second.querySelectorAll("[data-nagi-owned=message-identity]").length,
      1,
    );
    state.settings.enabled = false;
    layout.apply(state, personaSelection, "idle");
    assert.equal(
      answer.querySelector("[data-nagi-owned=message-identity]"),
      null,
    );
  } finally {
    layout.dispose();
    dom.window.close();
  }
});

test("thinking placeholder hands off to a newly mounted answer and cleans up on module disable or route replacement", () => {
  const dom = setup(
      '<main><section><div data-message-author-role="user">Prompt</div></section></main>',
    ),
    layout = new MessageLayout(),
    state = personaState();
  try {
    layout.apply(state, personaSelection, "thinking");
    assert.equal(
      document.querySelectorAll("[data-nagi-owned=thinking-placeholder]")
        .length,
      1,
    );
    const next = document.createElement("section");
    next.innerHTML =
      '<button>Thinking</button><div data-message-author-role="assistant"></div>';
    document.querySelector("main")!.append(next);
    layout.apply(state, personaSelection, "thinking");
    assert.equal(
      document.querySelector("[data-nagi-owned=thinking-placeholder]"),
      null,
    );
    assert.equal(
      next.querySelectorAll("[data-nagi-owned=message-identity]").length,
      1,
    );
    delete state.personas[0].avatars.thinking;
    layout.apply(state, personaSelection, "thinking");
    assert.equal(
      next
        .querySelector("[data-nagi-owned=message-identity]")!
        .shadowRoot!.querySelector("img")!
        .getAttribute("src"),
      state.personas[0].avatars.idle,
    );
    state.settings.layout.messageNames = false;
    state.settings.layout.messageAvatars = false;
    layout.apply(state, personaSelection, "thinking");
    assert.equal(
      document.querySelectorAll("[data-nagi-owned=message-identity]").length,
      0,
    );
    state.settings.layout.messageNames = true;
    state.settings.layout.messageAvatars = true;
    layout.apply(state, personaSelection, "thinking");
    document.querySelector("main")!.replaceChildren();
    layout.apply(state, emptySelection(), "unknown");
    assert.equal(
      next.querySelectorAll("[data-nagi-owned=message-identity]").length,
      0,
    );
    assert.equal(
      document.querySelector("[data-nagi-owned=thinking-placeholder]"),
      null,
    );
  } finally {
    layout.dispose();
    dom.window.close();
  }
});
