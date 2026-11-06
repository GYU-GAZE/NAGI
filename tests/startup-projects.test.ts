import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { primeAppearance, waitForBody } from "../src/features/early-theme.ts";
import {
  resolveProjects,
  resolveProjectsControl,
} from "../src/adapter/projects.ts";
import { initialState } from "../src/shared/model.ts";

test("Projects recognizes native lists outside sidebar IDs and excludes chat content and external links", () => {
  const dom = new JSDOM(
    '<div role="dialog"><a href="/projects/abc">Work project</a><a href="/g/g-p-123/project">Chat project</a></div><main><div data-message-author-role="assistant"><a href="/projects/fake">Example</a></div></main><a href="https://example.com/projects/no">External</a>',
    { url: "https://chatgpt.com/" },
  );
  try {
    assert.deepEqual(
      resolveProjects(dom.window.document).map((p) => p.title),
      ["Work project", "Chat project"],
    );
    dom.window.document.body.innerHTML =
      '<form><button type="button" id="projects">Project</button></form>';
    const control = resolveProjectsControl(dom.window.document)!;
    let opens = 0;
    control.onclick = () => opens++;
    control.click();
    assert.equal(opens, 1);
    assert.equal(control.id, "projects");
    control.removeAttribute("type");
    assert.equal(resolveProjectsControl(dom.window.document), null);
  } finally {
    dom.window.close();
  }
});
test("early appearance uses saved palette before body exists, restores markers and respects pause/failure", async () => {
  const dom = new JSDOM(
    "<!doctype html><html><head></head><body></body></html>",
  );
  try {
    const doc = dom.window.document;
    doc.body.remove();
    const state = initialState();
    state.settings.theme.background = "#123456";
    const stop = await primeAppearance(async () => state, doc);
    assert.equal(
      doc.documentElement.style.getPropertyValue("--nagi-background"),
      "#123456",
    );
    assert.equal(
      doc.documentElement.hasAttribute("data-nagi-preload-sidebar"),
      true,
    );
    let ready = false;
    const pending = waitForBody(doc).then(() => {
      ready = true;
    });
    assert.equal(ready, false);
    doc.documentElement.append(doc.createElement("body"));
    await pending;
    stop();
    assert.equal(doc.documentElement.hasAttribute("data-nagi-preload"), false);
    state.settings.enabled = false;
    (await primeAppearance(async () => state, doc))();
    assert.equal(doc.documentElement.hasAttribute("data-nagi-preload"), false);
    (
      await primeAppearance(async () => {
        throw new Error("storage");
      }, doc)
    )();
    assert.equal(
      doc.documentElement.hasAttribute("data-nagi-preload-sidebar"),
      false,
    );
  } finally {
    dom.window.close();
  }
});
