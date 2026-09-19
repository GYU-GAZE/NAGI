/** Test harness only: never included in extension builds. No real account access. */
import { Coordinator, type KV } from "../src/background/coordinator";
import { startApp } from "../src/app";
import type { Client } from "../src/shared/platform";
import {
  initialState,
  presets,
  type State,
  type Command,
} from "../src/shared/model";
const kv: KV = {
  get: async (k) => {
    const v = localStorage.getItem(`nagi-fixture:${k}`);
    return v ? JSON.parse(v) : undefined;
  },
  set: async (k, v) => {
    localStorage.setItem(`nagi-fixture:${k}`, JSON.stringify(v));
  },
};
const coordinator = new Coordinator(kv, kv);
const instanceId = crypto.randomUUID();
const tabId = Math.floor(Math.random() * 1e9);
let listeners: ((s: State) => void)[] = [];
const client: Client = {
  state: () => coordinator.state(),
  mutate: async (c: Command) => {
    const state = await navigator.locks.request("nagi-fixture", () =>
      coordinator.mutate(c),
    );
    listeners.forEach((fn) => fn(state));
    return state;
  },
  request: async <T>(type: string, payload: object = {}): Promise<T> => {
    const p = payload as Record<string, any>;
    return (await navigator.locks.request("nagi-fixture", async () => {
      switch (type) {
        case "hello":
          return true;
        case "selection":
          return coordinator.selection(tabId, p.key, p.value);
        case "lock.get":
          return coordinator.lock(typeof p.token === "string" ? p.token : undefined);
        case "lock.acquire":
          return coordinator.acquire({ tabId, instanceId }, p.personaId);
        case "lock.release":
          return coordinator.update({ tabId, instanceId }, p.token, "release");
        case "lock.generating":
          return coordinator.update(
            { tabId, instanceId },
            p.token,
            "generating",
          );
        case "lock.recover":
          return coordinator.recover(p.token);
        default:
          throw new Error("Unknown fixture request");
      }
    })) as T;
  },
  subscribe: (fn) => {
    listeners.push(fn);
    const listener = (e: StorageEvent) => {
      if (e.key === "nagi-fixture:nagi" && e.newValue)
        fn(JSON.parse(e.newValue));
    };
    window.addEventListener("storage", listener);
    return () => {
      listeners = listeners.filter((f) => f !== fn);
      window.removeEventListener("storage", listener);
    };
  },
};
async function boot() {
  if (!(await kv.get("nagi"))) {
    const state = initialState();
    state.settings.hideSidebar = true;
    state.settings.showName = true;
    state.settings.theme = { ...presets.Network };
    state.settings.layout.userName = "Gyu";
    await kv.set("nagi", state);
  }
  await startApp(client);
}
void boot();
for (const id of ["demo-share", "demo-more", "demo-files"]) {
  document
    .getElementById(id)!
    .addEventListener("click", () =>
      document.querySelector<HTMLDialogElement>("#demo-dialog")!.showModal(),
    );
}
const conversation = document.querySelector("#conversation")!;
let count = 0;
let active: ReturnType<typeof setTimeout>[] = [];
function turn(role: string, text: string) {
  const article = document.createElement("article");
  article.dataset.testid = `conversation-turn-${count++}`;
  const message = document.createElement("div");
  message.dataset.messageAuthorRole = role;
  const content = document.createElement("div");
  content.className = "markdown";
  content.textContent = text;
  message.append(content);
  article.append(message);
  conversation.append(article);
  return content;
}
for (let i = 0; i < 4; i++)
  turn(
    i % 2 ? "assistant" : "user",
    i % 2
      ? "Esta é uma conversa de teste local. Temas, navegação e organização funcionam sem acessar uma conta real."
      : "Sessão de teste " + String(Math.ceil((i + 1) / 2)).padStart(2, "0"),
  );
const form = document.querySelector("form")!;
const composer =
  document.querySelector<HTMLTextAreaElement>("#prompt-textarea")!;
const send = document.querySelector<HTMLButtonElement>(
  "[data-testid=send-button]",
)!;
function generate() {
  if (!composer.value.trim() || active.length) return;
  turn("user", composer.value);
  composer.value = "";
  send.disabled = true;
  const stop = document.createElement("button");
  stop.type = "button";
  stop.dataset.testid = "stop-button";
  stop.textContent = "Parar de gerar";
  form.append(stop);
  const progress = document.createElement("div");
  progress.role = "status";
  progress.textContent = "Consultando material visível…";
  conversation.append(progress);
  let final: HTMLElement;
  const finish = () => {
    active.forEach(clearTimeout);
    active = [];
    stop.remove();
    progress.remove();
    send.disabled = false;
  };
  stop.onclick = finish;
  active = [
    setTimeout(() => {
      final = turn("assistant", "Resposta");
    }, 1600),
    setTimeout(() => {
      final.textContent += " em andamento…";
    }, 2200),
    setTimeout(() => {
      progress.textContent = "Verificando outra etapa…";
    }, 3600),
    setTimeout(() => {
      final.textContent += " nova parte do texto.";
    }, 5500),
    setTimeout(finish, 6800),
  ];
}
form.addEventListener("submit", (e) => {
  e.preventDefault();
  generate();
});
composer.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    generate();
  }
});
document.querySelector("#many")!.addEventListener("click", () => {
  for (let i = 0; i < 600; i++) {
    const node = turn("assistant", "Teste de renderização " + i);
    for (let j = 0; j < 20; j++) {
      const p = document.createElement("p");
      p.textContent =
        "Conteúdo local sintético para comparação de layout e pintura. ".repeat(
          7,
        );
      node.append(p);
    }
  }
});
document
  .querySelector("#benchmark")!
  .addEventListener("click", () => void benchmark());
async function benchmark() {
  const out = document.querySelector("#benchmark-output")!;
  const state = await client.state();
  const original = state.settings.performance;
  const scroll = document.querySelector<HTMLElement>("main")!;
  const samples: Record<string, number[]> = { off: [], on: [] };
  const frame = () =>
    new Promise<number>((resolve) => requestAnimationFrame(resolve));
  for (const mode of ["off", "on", "on", "off"]) {
    await client.mutate({
      type: "settings",
      patch: { performance: mode === "on" },
    });
    scroll.scrollTop = 0;
    await frame();
    await frame();
    const start = await frame();
    let prev = start;
    for (let i = 0; i < 100; i++) {
      scroll.scrollTop += 60;
      const now = await frame();
      samples[mode].push(now - prev);
      prev = now;
    }
    out.textContent = "Comparando… " + mode;
  }
  await client.mutate({ type: "settings", patch: { performance: original } });
  const results = Object.fromEntries(
    Object.entries(samples).map(([mode, values]) => {
      values.sort((a, b) => a - b);
      return [
        mode,
        {
          frames: values.length,
          medianMs: +values[Math.floor(values.length * 0.5)].toFixed(2),
          p95Ms: +values[Math.floor(values.length * 0.95)].toFixed(2),
          over25ms: values.filter((v) => v > 25).length,
        },
      ];
    }),
  );
  out.textContent = JSON.stringify(
    { turns: count, fixture: true, results },
    null,
    2,
  );
  scroll.scrollTop = scroll.scrollHeight;
}
