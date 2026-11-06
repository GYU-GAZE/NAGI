import { test } from "node:test";
import assert from "node:assert/strict";
import { Coordinator, type KV } from "../src/background/coordinator.ts";
import {
  initialState,
  newChain,
  type Persona,
  type Selection,
} from "../src/shared/model.ts";
import {
  migrate,
  reduce,
  validImage,
  safeChatURL,
} from "../src/shared/validation.ts";
import { GenerationTracker } from "../src/adapter/generation.ts";
class Memory implements KV {
  map = new Map<string, unknown>();
  async get(k: string) {
    return structuredClone(this.map.get(k));
  }
  async set(k: string, v: unknown) {
    await Promise.resolve();
    this.map.set(k, structuredClone(v));
  }
}
const setup = () => {
  const local = new Memory(),
    session = new Memory();
  return { local, session, c: new Coordinator(local, session, () => 1234) };
};
const alice = { tabId: 1, instanceId: "a" },
  bob = { tabId: 2, instanceId: "b" };
const persona = {
  id: "gm",
  name: "GM",
  instructions: "Formal prose.",
  avatars: {},
};
test("same persona permits independent concurrent tab reservations", async () => {
  const { c } = setup();
  const results = await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      c.acquire({ tabId: i, instanceId: String(i) }, null),
    ),
  );
  assert.equal(results.filter((r) => r.acquired).length, 50);
  assert.equal(new Set(results.map((r) => r.lock.token)).size, 50);
});
test("lock persists through service worker reconstruction without expiry", async () => {
  const { c, local, session } = setup();
  const first = await c.acquire(alice, null);
  const restarted = new Coordinator(local, session, () => 1e15);
  const next = await restarted.acquire(alice, null);
  assert.equal(next.acquired, false);
  assert.equal(next.lock.token, first.lock.token);
});
test("a different tab cannot release another transaction", async () => {
  const { c } = setup();
  const { lock } = await c.acquire(alice, null);
  await assert.rejects(c.update(bob, lock.token, "release"));
  assert.ok(await c.lock());
});
test("stale instance and stale token cannot release replacement lock", async () => {
  const { c } = setup();
  const { lock } = await c.acquire(alice, null);
  await assert.rejects(
    c.update({ ...alice, instanceId: "new" }, lock.token, "release"),
  );
  await c.update(alice, lock.token, "release");
  await c.acquire(alice, null);
  await assert.rejects(c.recover(lock.token));
});
test("reload marks owner orphaned and never automatically releases", async () => {
  const { c } = setup();
  await c.acquire(alice, null);
  await c.orphan(1, "reloaded");
  assert.equal((await c.lock())?.orphaned, true);
  assert.equal(
    (await c.acquire({ ...alice, instanceId: "reloaded" }, null)).acquired,
    false,
  );
});
test("hello from same instance leaves ownership intact", async () => {
  const { c } = setup();
  await c.acquire(alice, null);
  await c.orphan(1, "a");
  assert.equal((await c.lock())?.orphaned, false);
});
test("explicit recovery checks expected token and allows next owner", async () => {
  const { c } = setup();
  const { lock } = await c.acquire(alice, null);
  await c.recover(lock.token);
  assert.equal((await c.acquire(bob, null)).acquired, true);
});
test("generation marker and matching release operate on persisted state", async () => {
  const { c } = setup();
  const { lock } = await c.acquire(alice, null);
  await c.update(alice, lock.token, "generating");
  assert.equal((await c.lock())?.phase, "generating");
  await c.update(alice, lock.token, "release");
  assert.equal(await c.lock(), null);
});
test("serialized independent settings edits survive concurrent writes", async () => {
  const { c } = setup();
  await Promise.all([
    c.mutate({ type: "settings", patch: { hideSidebar: true } }),
    c.mutate({ type: "settings", patch: { debug: true } }),
    c.mutate({ type: "settings", patch: { keepTurns: 50 } }),
  ]);
  const s = await c.state();
  assert.equal(s.revision, 3);
  assert.equal(s.settings.hideSidebar, true);
  assert.equal(s.settings.debug, true);
  assert.equal(s.settings.keepTurns, 50);
});
test("failed transaction does not poison writer queue or storage", async () => {
  const { c } = setup();
  await assert.rejects(c.mutate({ type: "settings", patch: { keepTurns: 0 } }));
  await c.mutate({ type: "settings", patch: { debug: true } });
  assert.equal((await c.state()).revision, 1);
});
test("future/corrupt schemas never silently reset", async () => {
  assert.throws(() => migrate({ schema: 99 }));
  assert.throws(() => migrate(null));
  assert.equal(migrate(undefined).schema, 1);
  const { c, local } = setup();
  await local.set("nagi", { schema: 99 });
  await assert.rejects(c.mutate({ type: "settings", patch: { debug: true } }));
  assert.deepEqual(await local.get("nagi"), { schema: 99 });
});
test("persona edit conflict preserves newer version and instruction history", async () => {
  const { c } = setup();
  await c.mutate({ type: "persona.save", persona, expectedVersion: 0 });
  await c.mutate({
    type: "persona.save",
    persona: { ...persona, instructions: "New" },
    expectedVersion: 1,
  });
  await assert.rejects(
    c.mutate({
      type: "persona.save",
      persona: { ...persona, instructions: "Stale" },
      expectedVersion: 1,
    }),
  );
  const p = (await c.state()).personas[0];
  assert.equal(p.instructions, "New");
  assert.equal(p.history[0].instructions, persona.instructions);
  assert.equal(p.version, 2);
});
test("chain ordering and current session are explicit and persisted", async () => {
  const { c } = setup();
  const chain = newChain("Campaign", "g-p-example");
  chain.sessions = ["A", "C", "B"].map((id) => ({
    id,
    title: id,
    url: `https://chatgpt.com/c/${id}`,
  }));
  chain.currentSession = "C";
  await c.mutate({ type: "chain.save", chain, expectedVersion: 0 });
  const stored = (await c.state()).chains[0];
  assert.deepEqual(
    stored.sessions.map((s) => s.id),
    ["A", "C", "B"],
  );
  assert.equal(stored.currentSession, "C");
  assert.equal(stored.projectId, "g-p-example");
});
test("duplicate sessions and dangling current session are rejected", () => {
  const s = initialState();
  const chain = newChain("x", null);
  chain.sessions = [
    { id: "A", title: "A", url: "https://chatgpt.com/c/A" },
    { id: "A", title: "A", url: "https://chatgpt.com/c/A" },
  ];
  assert.throws(() =>
    reduce(s, { type: "chain.save", chain, expectedVersion: 0 }),
  );
  chain.sessions = [];
  chain.currentSession = "gone";
  assert.throws(() =>
    reduce(s, { type: "chain.save", chain, expectedVersion: 0 }),
  );
});
test("concurrent stale chain edits fail instead of losing organization", async () => {
  const { c } = setup();
  const chain = newChain("x", null);
  await c.mutate({ type: "chain.save", chain, expectedVersion: 0 });
  const results = await Promise.allSettled([
    c.mutate({
      type: "chain.save",
      chain: { ...chain, name: "One" },
      expectedVersion: 1,
    }),
    c.mutate({
      type: "chain.save",
      chain: { ...chain, name: "Two" },
      expectedVersion: 1,
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});
test("deleting persona clears chain defaults without deleting chats", async () => {
  const { c } = setup();
  await c.mutate({ type: "persona.save", persona, expectedVersion: 0 });
  const chain = newChain("x", null);
  chain.defaultPersonaId = "gm";
  chain.lastPersonaId = "gm";
  await c.mutate({ type: "chain.save", chain, expectedVersion: 0 });
  await c.mutate({ type: "persona.delete", id: "gm", expectedVersion: 1 });
  const s = await c.state();
  assert.equal(s.chains.length, 1);
  assert.equal(s.chains[0].defaultPersonaId, null);
  assert.equal(s.chains[0].lastPersonaId, null);
});
test("persona selection is isolated by both tab and route", async () => {
  const { c } = setup();
  const value: Selection = {
    personaId: "gm",
    visualOnly: false,
    chainId: null,
  };
  await c.selection(1, "/c/a", value);
  assert.equal((await c.selection(2, "/c/a")).personaId, null);
  assert.equal((await c.selection(1, "/c/b")).personaId, null);
  assert.equal((await c.selection(1, "/c/a")).personaId, "gm");
});
test("remote avatars, SVG and malicious CSS/URLs are rejected", () => {
  assert.equal(validImage("https://example.com/avatar.png"), false);
  assert.equal(validImage("data:image/svg+xml;base64,AAA="), false);
  assert.equal(validImage("data:image/png;base64,AAAA"), true);
  assert.equal(safeChatURL("javascript:alert(1)"), false);
  assert.equal(safeChatURL("https://chatgpt.com.evil/c/a"), false);
  assert.equal(safeChatURL("https://chatgpt.com/c/a?leak=1"), false);
  assert.equal(safeChatURL("https://chatgpt.com/c/a"), true);
  const s = initialState();
  assert.throws(() =>
    reduce(s, {
      type: "settings",
      patch: {
        theme: { ...s.settings.theme, font: "x; background:url(https://evil)" },
      },
    }),
  );
});
test("generation can alternate thinking and talking repeatedly", () => {
  const t = new GenerationTracker();
  assert.equal(
    t.update({ ready: true, stop: false, answerChanged: false }, 0),
    "idle",
  );
  assert.equal(
    t.update({ ready: true, stop: true, answerChanged: false }, 100),
    "thinking",
  );
  assert.equal(
    t.update({ ready: true, stop: true, answerChanged: true }, 200),
    "talking",
  );
  assert.equal(
    t.update({ ready: true, stop: true, answerChanged: false }, 1400),
    "thinking",
  );
  assert.equal(
    t.update({ ready: true, stop: true, answerChanged: true }, 1600),
    "talking",
  );
  t.update({ ready: true, stop: false, answerChanged: false }, 1700);
  assert.equal(
    t.update({ ready: true, stop: false, answerChanged: false }, 3000),
    "idle",
  );
});
test("missing composer is unknown and never idle completion", () => {
  const t = new GenerationTracker();
  t.update({ ready: true, stop: true, answerChanged: true }, 0);
  assert.equal(
    t.update({ ready: false, stop: false, answerChanged: false }, 20000),
    "unknown",
  );
});
test("transient missing stop does not signal generation completion", () => {
  const t = new GenerationTracker();
  t.update({ ready: true, stop: true, answerChanged: false }, 0);
  assert.equal(
    t.update({ ready: true, stop: false, answerChanged: false }, 100),
    "thinking",
  );
  assert.equal(
    t.update({ ready: true, stop: true, answerChanged: false }, 300),
    "thinking",
  );
});

test("0.1 state migrates additively to modular layout without losing theme, personas or chains", () => {
  const original = initialState();
  original.settings.theme.background = "#123456";
  (original.settings as any).layout = undefined;
  const migrated = migrate(original);
  assert.equal(migrated.settings.layout.variant, "network");
  assert.equal(migrated.settings.theme.background, "#123456");
  assert.equal(original.settings.layout, undefined);
  const edited = reduce(migrated, {
    type: "settings",
    patch: {
      layout: {
        ...migrated.settings.layout,
        userName: "PRIVATE USER",
        messageCards: false,
      },
    },
  });
  assert.equal(edited.settings.layout.messageCards, false);
  assert.equal(edited.settings.layout.grid, true);
  assert.equal(edited.settings.layout.userName, "PRIVATE USER");
  assert.throws(() =>
    reduce(edited, {
      type: "settings",
      patch: {
        layout: { ...edited.settings.layout, accent: "red;display:none" },
      },
    }),
  );
  assert.throws(() =>
    reduce(edited, {
      type: "settings",
      patch: {
        layout: {
          ...edited.settings.layout,
          userAvatar: "https://remote/avatar.png",
        },
      },
    }),
  );
  assert.throws(() =>
    reduce(edited, {
      type: "settings",
      patch: { layout: { ...edited.settings.layout, avatarSize: 500 } },
    }),
  );
});

test("same-persona holders release separately and block a different persona until all finish", async () => {
  const { c, local, session } = setup();
  await c.mutate({ type: "persona.save", persona, expectedVersion: 0 });
  await c.mutate({
    type: "persona.save",
    persona: { ...persona, id: "other", name: "Other" },
    expectedVersion: 0,
  });
  const a = await c.acquire(alice, "gm"),
    b = await c.acquire(bob, "gm");
  assert.equal(a.acquired, true);
  assert.equal(b.acquired, true);
  assert.notEqual(a.lock.token, b.lock.token);
  const third = { tabId: 3, instanceId: "c" };
  assert.equal((await c.acquire(third, "other")).acquired, false);
  await c.update(alice, a.lock.token, "release");
  const restarted = new Coordinator(local, session);
  assert.equal((await restarted.lock(b.lock.token))?.tabId, 2);
  assert.equal((await restarted.acquire(third, "other")).acquired, false);
  await assert.rejects(restarted.update(alice, b.lock.token, "release"));
  await restarted.update(bob, b.lock.token, "release");
  assert.equal((await restarted.acquire(third, "other")).acquired, true);
});
test("legacy reservation migration and orphan recovery preserve other same-persona holders", async () => {
  const { c, session } = setup();
  await session.set("lock", {
    ...alice,
    token: "legacy",
    personaId: null,
    personaName: "ChatGPT",
    phase: "generating",
    orphaned: false,
    createdAt: 1,
  });
  const b = await c.acquire(bob, null);
  assert.equal(b.acquired, true);
  await c.orphan(1);
  assert.equal((await c.lock("legacy"))?.orphaned, true);
  assert.equal((await c.lock(b.lock.token))?.orphaned, false);
  await c.recover("legacy");
  assert.equal(await c.lock("legacy"), null);
  assert.ok(await c.lock(b.lock.token));
  await c.update(bob, b.lock.token, "release");
  assert.equal(await c.lock(), null);
});
