import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  resolveChatRows,
  resolveSidebarControl,
  resolveProjectsExpansion,
  pinChat,
} from "../src/adapter/navigation";
import { NavigationDock } from "../src/features/navigation-dock";

function setup() {
  const dom = new JSDOM(
    `<!doctype html><body>
    <nav id="history" data-nagi-sidebar="hidden">
      <button id="scheduled">Scheduled</button><button id="plugins">Plugins</button><a id="codex" href="/codex">Codex</a><button id="global-more" aria-haspopup="menu">More</button>
      <button id="projects" aria-expanded="false">Projects</button>
      <section><h3>Pinned</h3><ol><li id="pinned-row"><a href="/c/pinned">First chat</a><button id="unpin" aria-label="Unpin chat">◆</button><button aria-label="More" aria-haspopup="menu">⋯</button></li></ol></section>
      <section><h3>Recent chats</h3><ol><li id="regular-row"><a href="/c/regular">Second chat</a><button id="chat-more" aria-label="More" aria-haspopup="menu">⋯</button></li><li><a href="/c/projects">Projects</a></li></ol></section>
    </nav><main><div data-message-author-role="assistant"><a href="/c/fake">Fake</a><button>Scheduled</button></div></main>
    <div data-nagi-owned="test"><div id="slot"></div><div id="shortcut-slot"></div></div>
  </body>`,
    { url: "https://chatgpt.com/c/current" },
  );
  for (const key of [
    "window",
    "document",
    "location",
    "Element",
    "HTMLElement",
    "HTMLButtonElement",
    "HTMLTextAreaElement",
    "MutationObserver",
    "KeyboardEvent",
    "Event",
  ])
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  return dom;
}
const rect = (x: number, y: number, w: number, h: number) => ({
  x,
  y,
  left: x,
  top: y,
  width: w,
  height: h,
  right: x + w,
  bottom: y + h,
  toJSON() {
    return {};
  },
});

test("navigation discovers pinned sections, deduplicates chats and separates global More from chat menus", () => {
  const dom = setup();
  try {
    const rows = resolveChatRows();
    assert.deepEqual(
      rows.map((r) => [r.id, r.pinned]),
      [
        ["pinned", true],
        ["regular", false],
        ["projects", false],
      ],
    );
    assert.equal(rows[0].row.id, "pinned-row");
    assert.equal(rows[1].row.id, "regular-row");
    assert.equal(resolveSidebarControl("more")?.node.id, "global-more");
    assert.equal(resolveSidebarControl("scheduled")?.node.id, "scheduled");
    assert.equal(resolveSidebarControl("plugins")?.node.id, "plugins");
    assert.equal(resolveSidebarControl("codex")?.node.id, "codex");
    assert.equal(resolveProjectsExpansion()?.id, "projects");
    document.querySelector("#projects")!.setAttribute("aria-expanded", "true");
    assert.equal(resolveProjectsExpansion(), null);
    document.querySelector("#pinned-row")!.querySelector("a")!.textContent =
      "Renamed";
    assert.equal(resolveChatRows()[0].title, "Renamed");
  } finally {
    dom.window.close();
  }
});

test("docked native rows retain parent, pin and menu handlers; mounting never performs an account action", () => {
  const dom = setup();
  const dock = new NavigationDock();
  try {
    const item = resolveChatRows()[0];
    const originalParent = item.row.parentElement;
    const slot = document.querySelector<HTMLElement>("#slot")!;
    slot.getBoundingClientRect = () => rect(350, 240, 480, 44);
    let pins = 0,
      menus = 0;
    item.row.querySelector<HTMLButtonElement>("#unpin")!.onclick = () => pins++;
    const more =
      item.row.querySelector<HTMLButtonElement>("[aria-label=More]")!;
    more.onclick = () => {
      menus++;
      const menu = document.createElement("div");
      menu.setAttribute("role", "menu");
      for (const label of [
        "Share",
        "Rename",
        "Pin chat",
        "Archive",
        "Delete",
        "Move to Project",
      ]) {
        const action = document.createElement("button");
        action.textContent = label;
        menu.append(action);
      }
      document.body.append(menu);
    };
    dock.refresh([{ ...item, node: item.row, slot, kind: "row" }]);
    assert.equal(pins, 0);
    assert.equal(menus, 0);
    assert.equal(item.row.parentElement, originalParent);
    assert.equal(item.row.style.getPropertyValue("--nagi-nav-x"), "350px");
    assert.equal(item.row.style.getPropertyValue("--nagi-nav-y"), "240px");
    assert.equal(item.sidebar.hasAttribute("data-nagi-nav-root"), true);
    more.click();
    assert.equal(menus, 1);
    assert.deepEqual(
      [...document.querySelectorAll("[role=menu] button")].map(
        (n) => n.textContent,
      ),
      ["Share", "Rename", "Pin chat", "Archive", "Delete", "Move to Project"],
    );
    item.row.querySelector<HTMLButtonElement>("#unpin")!.click();
    assert.equal(pins, 1);
    dock.refresh([]);
    assert.equal(item.row.parentElement, originalParent);
    assert.equal(item.row.hasAttribute("data-nagi-nav-target"), false);
    assert.equal(item.row.hasAttribute("style"), false);
    assert.equal(document.querySelector("[data-nagi-nav-path]"), null);
    assert.equal(item.sidebar.getAttribute("data-nagi-sidebar"), "hidden");
  } finally {
    dock.dispose();
    dom.window.close();
  }
});

test("docking preserves an expanded sidebar and hides controls outside a scrolling panel", () => {
  const dom = setup();
  const dock = new NavigationDock();
  try {
    const item = resolveChatRows()[0];
    item.sidebar.removeAttribute("data-nagi-sidebar");
    const frame = document.createElement("iframe");
    document.body.append(frame);
    frame.getBoundingClientRect = () => rect(200, 100, 600, 500);
    const body = frame.contentDocument!.createElement("div");
    body.className = "body";
    frame.contentDocument!.body.append(body);
    const slot = frame.contentDocument!.createElement("div");
    body.append(slot);
    body.getBoundingClientRect = () => rect(0, 50, 600, 400);
    slot.getBoundingClientRect = () => rect(10, 60, 560, 44);
    dock.refresh([{ ...item, node: item.row, slot, kind: "row" }]);
    assert.equal(item.sidebar.hasAttribute("data-nagi-nav-path"), false);
    assert.equal(item.row.style.getPropertyValue("--nagi-nav-x"), "210px");
    assert.equal(item.row.style.getPropertyValue("--nagi-nav-y"), "160px");
    assert.equal(item.row.hasAttribute("data-nagi-nav-clipped"), false);
    slot.getBoundingClientRect = () => rect(10, 420, 560, 44);
    dock.position();
    assert.equal(item.row.hasAttribute("data-nagi-nav-clipped"), true);
    item.row.remove();
    dock.refresh([{ ...item, node: item.row, slot, kind: "row" }]);
    assert.equal(item.row.hasAttribute("data-nagi-nav-target"), false);
  } finally {
    dock.dispose();
    dom.window.close();
  }
});

test("quick Pin uses only the matching native menu and leaves other actions untouched", async () => {
  const dom = setup();
  try {
    let pins = 0,
      deletes = 0;
    const trigger = document.querySelector<HTMLElement>("#chat-more")!;
    trigger.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key !== "ArrowDown") return;
      const menu = document.createElement("div");
      menu.id = "chat-menu";
      menu.setAttribute("role", "menu");
      trigger.setAttribute("aria-controls", "chat-menu");
      for (const label of ["Delete", "Pin chat"]) {
        const b = document.createElement("button");
        b.setAttribute("role", "menuitem");
        b.textContent = label;
        b.onclick = () => (label === "Delete" ? deletes++ : pins++);
        menu.append(b);
      }
      document.body.append(menu);
    });
    assert.equal(await pinChat("regular"), true);
    assert.equal(pins, 1);
    assert.equal(deletes, 0);
    assert.equal(await pinChat("missing"), false);
  } finally {
    dom.window.close();
  }
});

test("quick Pin never acts on an unrelated open menu", async () => {
  const dom = setup();
  try {
    let wrong = 0;
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    const action = document.createElement("button");
    action.setAttribute("role", "menuitem");
    action.textContent = "Pin chat";
    action.onclick = () => wrong++;
    menu.append(action);
    document.body.append(menu);
    assert.equal(await pinChat("regular"), false);
    assert.equal(wrong, 0);
  } finally {
    dom.window.close();
  }
});
