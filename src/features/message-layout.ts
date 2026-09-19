import type { State, Selection, Phase } from "../shared/model";
import { resolveMessages } from "../adapter/messages";
import { Marks } from "./marks";

interface Identity {
  host: HTMLElement;
  image: HTMLImageElement;
  initials: HTMLElement;
  name: HTMLElement;
}
export class MessageLayout {
  private marks = new Marks();
  private badges = new Map<HTMLElement, Identity>();
  private style = document.createElement("style");
  constructor() {
    this.style.dataset.nagiOwned = "message-layout";
    this.style.textContent = `
[data-nagi-thread-path]{max-width:none!important;min-width:0!important;width:100%!important}
[data-nagi-turn]{box-sizing:border-box!important;background:transparent!important;border:0!important;box-shadow:none!important;max-width:var(--nagi-thread-width,1040px)!important;width:100%!important;margin-inline:auto!important;padding:0 16px!important;margin-block:var(--nagi-message-gap,24px)!important;scroll-margin-top:calc(var(--nagi-shell-height,140px) + 20px)!important}
[data-nagi-message]{--nagi-identity-space:0px;box-sizing:border-box!important;position:relative!important;display:block!important;max-width:none!important;min-width:0!important;width:calc(100% - var(--nagi-identity-space))!important;color:var(--nagi-ui-text)!important;font:var(--nagi-ui-font-size,15px)/1.65 var(--nagi-ui-font,monospace)!important;scroll-margin-top:calc(var(--nagi-shell-height,140px) + 20px)!important;overflow:visible!important}
[data-nagi-message][data-nagi-has-identity]{--nagi-identity-space:calc(var(--nagi-avatar-size,64px) + 24px)}
[data-nagi-message=assistant]{margin-left:var(--nagi-identity-space)!important;margin-right:0!important}
[data-nagi-message=user]{margin-left:auto!important;margin-right:var(--nagi-identity-space)!important;max-width:calc(88% - var(--nagi-identity-space))!important}
[data-nagi-message-card]{background:linear-gradient(135deg,color-mix(in srgb,var(--nagi-ui-panel) 94%,transparent),var(--nagi-ui-panel))!important;border:1px solid var(--nagi-line)!important;border-radius:6px!important;box-shadow:none!important;padding:18px 22px!important}
[data-nagi-message-surface]{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important;max-width:none!important;color:inherit!important}
[data-nagi-message] > [data-nagi-owned=message-identity]{position:absolute!important;top:0!important;width:var(--nagi-avatar-size,64px)!important;display:block!important;margin:0!important;padding:0!important}
[data-nagi-message=assistant] > [data-nagi-owned=message-identity]{right:calc(100% + 24px)!important;left:auto!important}
[data-nagi-message=user] > [data-nagi-owned=message-identity]{left:calc(100% + 24px)!important;right:auto!important}
[data-nagi-message-standalone]{width:calc(min(100%,var(--nagi-thread-width,1040px)) - 2 * var(--nagi-identity-space))!important;max-width:calc(min(100%,var(--nagi-thread-width,1040px)) - 2 * var(--nagi-identity-space))!important;margin:var(--nagi-message-gap,24px) auto!important}
[data-nagi-message] pre{max-width:100%;overflow-x:auto}
@media(max-width:600px){[data-nagi-turn]{padding-inline:12px!important}[data-nagi-message=user]{max-width:calc(100% - var(--nagi-identity-space))!important}[data-nagi-message-card]{padding:12px!important}}
`;
    document.head.append(this.style);
  }
  private badge(node: HTMLElement): Identity {
    const existing = this.badges.get(node);
    if (existing) {
      if (!node.contains(existing.host)) node.append(existing.host);
      return existing;
    }
    const host = document.createElement("div");
    host.dataset.nagiOwned = "message-identity";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `:host{font:13px/1.4 var(--nagi-ui-font,monospace);color:var(--nagi-accent,#32d9f5);text-align:center}*{box-sizing:border-box}[hidden]{display:none!important}img,.initials{width:100%;aspect-ratio:1;object-fit:cover;image-rendering:auto;border:1px solid var(--nagi-accent,#32d9f5);border-radius:5px;background:var(--nagi-ui-panel,#061c2b)}.initials{display:grid;place-items:center;font-size:22px}span.name{display:block;margin-top:6px;overflow-wrap:anywhere;font-weight:600}`;
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    const initials = document.createElement("span");
    initials.className = "initials";
    const name = document.createElement("span");
    name.className = "name";
    shadow.append(style, image, initials, name);
    node.append(host);
    const badge = { host, image, initials, name };
    this.badges.set(node, badge);
    return badge;
  }
  apply(state: State, selection: Selection, phase: Phase) {
    const s = state.settings,
      l = s.layout;
    const active =
      s.enabled &&
      l.variant === "network" &&
      (l.messageCards || l.messageAvatars || l.messageNames);
    const regions = active ? resolveMessages() : [];
    const nodes = new Set(regions.map((r) => r.node));
    for (const [node, badge] of this.badges)
      if (!nodes.has(node) || (!l.messageAvatars && !l.messageNames)) {
        badge.host.remove();
        this.badges.delete(node);
      }
    this.marks.set(
      "data-nagi-turn",
      regions.filter((r) => r.turn !== r.node).map((r) => r.turn),
    );
    this.marks.set(
      "data-nagi-message-standalone",
      regions.filter((r) => r.turn === r.node).map((r) => r.node),
    );
    this.marks.set("data-nagi-message-card", l.messageCards ? [...nodes] : []);
    this.marks.set(
      "data-nagi-has-identity",
      l.messageAvatars || l.messageNames ? [...nodes] : [],
    );
    this.marks.set("data-nagi-message", nodes);
    const surfaces = new Set<HTMLElement>(),
      paths = new Set<HTMLElement>();
    const persona = s.personas
      ? state.personas.find((p) => p.id === selection.personaId)
      : null;
    const lastAssistant = regions
      .filter((r) => r.role === "assistant")
      .at(-1)?.node;
    for (const r of regions) {
      r.node.dataset.nagiMessage = r.role;
      // Do not move or copy conversation content. Clear decorative wrappers only.
      for (const content of r.node.querySelectorAll<HTMLElement>(
        ".markdown,.whitespace-pre-wrap,[data-message-content]",
      )) {
        if (content.closest("pre,code,[data-nagi-owned]")) continue;
        for (
          let p: HTMLElement | null = content;
          p && p !== r.node;
          p = p.parentElement
        ) {
          if (p.matches("button,a,pre,code,table")) break;
          surfaces.add(p);
        }
      }
      for (
        let p = r.node.parentElement, depth = 0;
        p && depth < 8;
        p = p.parentElement, depth++
      ) {
        if (
          p.matches("main,body,[role=main]") ||
          p.querySelector("#prompt-textarea,form")
        )
          break;
        paths.add(p);
      }
      if (l.messageAvatars || l.messageNames) {
        const badge = this.badge(r.node);
        const name =
          r.role === "user" ? l.userName : (persona?.name ?? "ChatGPT");
        const currentPhase =
          r.node === lastAssistant && phase !== "unknown" ? phase : "idle";
        const image =
          r.role === "user"
            ? l.userAvatar
            : (persona?.avatars[currentPhase] ?? persona?.avatars.idle ?? "");
        if (badge.name.textContent !== name) badge.name.textContent = name;
        badge.name.hidden = !l.messageNames;
        const initials = Array.from(name.trim())
          .slice(0, 2)
          .join("")
          .toUpperCase();
        if (badge.initials.textContent !== initials)
          badge.initials.textContent = initials;
        badge.image.hidden = !l.messageAvatars || !image;
        badge.initials.hidden = !l.messageAvatars || !!image;
        if (image && badge.image.getAttribute("src") !== image)
          badge.image.src = image;
        if (!image) badge.image.removeAttribute("src");
        badge.host.setAttribute(
          "aria-label",
          r.role === "user" ? name : `Persona visual: ${name}`,
        );
      }
    }
    this.marks.set("data-nagi-message-surface", l.messageCards ? surfaces : []);
    this.marks.set("data-nagi-thread-path", paths);
  }
  dispose() {
    this.marks.clear();
    for (const badge of this.badges.values()) badge.host.remove();
    this.badges.clear();
    this.style.remove();
  }
}
