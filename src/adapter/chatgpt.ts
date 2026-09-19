import { resolveProjects } from "./projects";
import { resolveMessages } from "./messages";
import { selectors as S } from "./selectors";
import { GenerationTracker } from "./generation";
import { resolveRegions } from "./regions";
import type { Phase, ChainSession } from "../shared/model";
export interface NavLink {
  title: string;
  url: string;
  id: string;
}
export interface Snapshot {
  route: string;
  conversation: ChainSession | null;
  projectId: string | null;
  phase: Phase;
  health: { composer: boolean; send: boolean; sidebar: boolean; turns: number };
  scanMs: number;
}
export interface ChatGPTAdapter {
  snapshot(): Snapshot;
  recent(): NavLink[];
  projects(): NavLink[];
  newChat(): void;
  showSidebar(show: boolean): boolean;
  composer(): HTMLElement | null;
  sendButton(): HTMLButtonElement | null;
  isSendEvent(event: Event): boolean;
  sendOriginal(): void;
  observe(fn: (snapshot: Snapshot) => void): () => void;
  turns(): HTMLElement[];
}
export class DOMChatGPTAdapter implements ChatGPTAdapter {
  private tracker = new GenerationTracker();
  private lastAnswer = "";
  private route = "";
  private lastSnapshot: Snapshot | null = null;
  private hiddenSidebars = new Set<HTMLElement>();
  composer() {
    return document.querySelector<HTMLElement>(S.composer);
  }
  sendButton() {
    return document.querySelector<HTMLButtonElement>(S.send);
  }
  turns() {
    const legacy = [...document.querySelectorAll<HTMLElement>(S.turn)];
    const additional = resolveMessages()
      .map((r) => r.turn)
      .filter((node) => !legacy.some((t) => t.contains(node)));
    return [...new Set([...legacy, ...additional])];
  }
  private visible(el: HTMLElement | null) {
    return !!el && !el.hidden && el.getClientRects().length > 0;
  }
  snapshot(): Snapshot {
    const start = performance.now();
    const route = location.pathname;
    if (route !== this.route) {
      this.route = route;
      this.tracker.reset();
      this.lastAnswer = "";
    }
    const composer = this.composer();
    const stop = this.visible(document.querySelector(S.stop));
    const lastAssistant = resolveMessages()
      .filter((r) => r.role === "assistant")
      .at(-1)?.node;
    const answers =
      lastAssistant?.querySelectorAll<HTMLElement>(S.finalText) ?? [];
    const final = [...answers].filter((e) => !e.closest(S.progress)).at(-1);
    // Read only the last candidate answer; never persist or log text.
    const answer = final?.textContent ?? "";
    const changed = answer !== this.lastAnswer;
    this.lastAnswer = answer;
    const phase = this.tracker.update(
      { stop, ready: this.visible(composer), answerChanged: stop && changed },
      Date.now(),
    );
    const match = route.match(/\/c\/([\w-]+)$/);
    const project = route.match(/^\/g\/(g-p-[^/]+)/)?.[1] ?? null;
    const link =
      match && this.lastSnapshot?.route !== route
        ? this.recent().find((l) => l.id === match[1])
        : null;
    this.lastSnapshot = {
      route,
      conversation: match
        ? {
            id: match[1],
            url: `https://chatgpt.com${route}`,
            title:
              link?.title ||
              document.title.replace(/\s*[-–|]\s*ChatGPT$/, "") ||
              "Conversa",
          }
        : null,
      projectId: project,
      phase,
      health: {
        composer: !!composer,
        send: !!this.sendButton(),
        sidebar: resolveRegions().sidebar.length > 0,
        turns: this.turns().length,
      },
      scanMs: performance.now() - start,
    };
    return this.lastSnapshot;
  }
  private links(kind: "chat" | "project"): NavLink[] {
    const seen = new Set<string>();
    const result: NavLink[] = [];
    const links = resolveRegions().sidebar.flatMap((root) => [
      ...root.querySelectorAll<HTMLAnchorElement>("a[href]"),
    ]);
    links.forEach((a) => {
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return;
      const match =
        kind === "chat"
          ? u.pathname.match(/\/c\/([\w-]+)$/)
          : u.pathname.match(/^\/g\/(g-p-[^/]+)(?:\/project)?\/?$/);
      if (!match || seen.has(match[1])) return;
      seen.add(match[1]);
      result.push({
        id: match[1],
        title:
          a.textContent?.trim().slice(0, 200) ||
          a.getAttribute("aria-label") ||
          match[1],
        url: `https://chatgpt.com${u.pathname}`,
      });
    });
    return result;
  }
  recent() {
    return this.links("chat");
  }
  projects() {
    return resolveProjects();
  }
  newChat() {
    const link = document.querySelector<HTMLAnchorElement>(S.newChat);
    if (link) link.click();
    else location.assign("https://chatgpt.com/");
  }
  showSidebar(show: boolean) {
    const roots = show ? [] : resolveRegions().sidebar;
    for (const previous of this.hiddenSidebars)
      if (!roots.includes(previous))
        previous.removeAttribute("data-nagi-sidebar");
    this.hiddenSidebars = new Set(roots);
    for (const root of roots)
      if (root.getAttribute("data-nagi-sidebar") !== "hidden")
        root.setAttribute("data-nagi-sidebar", "hidden");
    document.documentElement.toggleAttribute(
      "data-nagi-sidebar-collapsed",
      !show && roots.length > 0,
    );
    return show || roots.length > 0;
  }
  isSendEvent(event: Event) {
    // Never interpret controls owned by nAGI as ChatGPT send actions.
    if (
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof Element && target.hasAttribute("data-nagi-owned"),
        )
    )
      return false;
    const el = event.target instanceof Element ? event.target : null;
    if (!el) return false;
    const composer = this.composer();
    if (event.type === "click") return !!el.closest(S.send);
    if (event.type === "submit")
      return !!composer && el === composer.closest("form");
    if (event instanceof KeyboardEvent)
      return (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing &&
        event.keyCode !== 229 &&
        !!composer &&
        (el === composer || composer.contains(el))
      );
    return false;
  }
  sendOriginal() {
    const button = this.sendButton();
    if (!button || button.disabled)
      throw new Error("Botao Enviar indisponivel. O rascunho foi preservado.");
    button.click();
  }
  observe(fn: (s: Snapshot) => void) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const scan = () => {
      timer = undefined;
      if (!stopped) fn(this.snapshot());
    };
    const schedule = () => {
      if (!timer) timer = setTimeout(scan, 160);
    };
    const observer = new MutationObserver((records) => {
      if (
        records.some((r) => {
          const el =
            r.target instanceof Element ? r.target : r.target.parentElement;
          return !!el && !el.closest("[data-nagi-owned]");
        })
      )
        schedule();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "disabled",
        "data-testid",
        "aria-label",
        "aria-selected",
        "aria-pressed",
        "aria-current",
        "aria-checked",
        "data-state",
      ],
    });
    // Lightweight fallback also detects pushState and completion without patching React/history.
    const interval = setInterval(schedule, 1000);
    scan();
    return () => {
      stopped = true;
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(timer);
    };
  }
}
