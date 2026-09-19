import type { State, Selection, Phase } from "../shared/model";
import { resolveMessageGroups } from "../adapter/messages";
import { Marks } from "./marks";

interface Identity {
  host: HTMLElement;
  image: HTMLImageElement;
  initials: HTMLElement;
  name: HTMLElement;
  status: HTMLElement;
}
export class MessageLayout {
  private marks = new Marks();
  private badges = new Map<HTMLElement, Identity>();
  private pending: HTMLElement | null = null;
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
[data-nagi-message-envelope]{--nagi-envelope-inset:0px;box-sizing:border-box!important;max-width:var(--nagi-thread-width,1040px)!important;width:100%!important;margin:var(--nagi-message-gap,24px) auto!important;padding:0 var(--nagi-envelope-inset)!important;font-family:var(--nagi-ui-font,monospace)!important;color:var(--nagi-ui-text)!important}
[data-nagi-message-envelope][data-nagi-envelope-identity]{--nagi-envelope-inset:calc(var(--nagi-avatar-size,64px) + 24px);padding-inline:var(--nagi-envelope-inset)!important}
[data-nagi-message-path]{box-sizing:border-box!important;display:block!important;max-width:100%!important;width:100%!important;margin-inline:0!important;padding-inline:0!important}
[data-nagi-message][data-nagi-message-grouped]{width:100%!important;max-width:100%!important;margin:16px 0!important}
[data-nagi-message-accessory]{box-sizing:border-box!important;max-width:100%!important;margin-inline:0!important;font-family:var(--nagi-ui-font,monospace)!important;font-size:var(--nagi-ui-font-size,15px)!important;color:var(--nagi-ui-text)!important}
[data-nagi-message-accessory] :is(button,summary,div,span,p,a){font-family:var(--nagi-ui-font,monospace)!important}
[data-nagi-message] pre{max-width:100%;overflow-x:auto}
@media(max-width:600px){[data-nagi-turn]{padding-inline:12px!important}[data-nagi-message=user]{max-width:calc(100% - var(--nagi-identity-space))!important}[data-nagi-message-card]{padding:12px!important}}
[data-nagi-message=user][data-nagi-message-card]{width:fit-content!important;min-width:0!important;overflow-wrap:anywhere!important;text-align:start!important}
[data-nagi-message=user][data-nagi-message-grouped]{max-width:100%!important;margin-left:auto!important;margin-right:0!important}
[data-nagi-message=user][data-nagi-message-standalone]:not([data-nagi-message-grouped]){margin-left:auto!important;margin-right:max(var(--nagi-identity-space),calc((100% - var(--nagi-thread-width,1040px)) / 2 + var(--nagi-identity-space)))!important}
[data-nagi-message=user] [data-nagi-message-surface]{min-width:0!important;width:auto!important;max-width:100%!important;overflow-wrap:anywhere!important;text-align:start!important}
[data-nagi-thinking-envelope]{position:relative!important;min-height:calc(var(--nagi-avatar-size,64px) + 64px)!important}
[data-nagi-owned=message-identity][data-nagi-thinking-identity]{position:absolute!important;top:0!important;left:0!important;right:auto!important;width:var(--nagi-avatar-size,64px)!important}
[data-nagi-owned=thinking-placeholder]{position:relative!important;box-sizing:border-box!important;max-width:var(--nagi-thread-width,1040px)!important;width:100%!important;min-height:calc(var(--nagi-avatar-size,64px) + 64px)!important;margin:var(--nagi-message-gap,24px) auto!important;padding:0 calc(var(--nagi-avatar-size,64px) + 24px)!important}
`;
    document.head.append(this.style);
  }
  private badge(node: HTMLElement, parent = node): Identity {
    const existing = this.badges.get(node);
    if (existing) {
      if (existing.host.parentElement !== parent) parent.append(existing.host);
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
    const status = document.createElement("span");
    status.className = "status";
    status.textContent = "Thinking...";
    status.setAttribute("role", "status");
    status.hidden = true;
    style.textContent +=
      ".status{display:block;margin-top:4px;font-size:11px;overflow-wrap:anywhere}";
    shadow.append(style, image, initials, name, status);
    parent.append(host);
    const badge = { host, image, initials, name, status };
    this.badges.set(node, badge);
    return badge;
  }
  private showIdentity(
    badge: Identity,
    name: string,
    image: string,
    avatars: boolean,
    names: boolean,
    thinking: boolean,
  ) {
    if (badge.name.textContent !== name) badge.name.textContent = name;
    badge.name.hidden = !names;
    badge.status.hidden = !thinking;
    const initials = Array.from(name.trim()).slice(0, 2).join("").toUpperCase();
    if (badge.initials.textContent !== initials)
      badge.initials.textContent = initials;
    badge.image.hidden = !avatars || !image;
    badge.initials.hidden = !avatars || !!image;
    if (image && badge.image.getAttribute("src") !== image)
      badge.image.src = image;
    if (!image) badge.image.removeAttribute("src");
    badge.host.setAttribute(
      "aria-label",
      thinking ? `${name}: Thinking...` : name,
    );
  }
  apply(state: State, selection: Selection, phase: Phase) {
    const s = state.settings,
      l = s.layout;
    const active =
      s.enabled &&
      l.variant === "network" &&
      (l.messageCards || l.messageAvatars || l.messageNames);
    const regions = active ? resolveMessageGroups() : [];
    const nodes = new Set(regions.map((r) => r.node));
    const identities = l.messageAvatars || l.messageNames;
    const last = regions.at(-1);
    const thinking = active && identities && phase === "thinking";
    const thinkingGroup = thinking && last?.role === "assistant" ? last : null;
    const pendingParent =
      last?.envelope.parentElement ??
      document.querySelector<HTMLElement>("main,[role=main]");
    if (thinking && !thinkingGroup && pendingParent) {
      if (!this.pending) {
        this.pending = document.createElement("div");
        this.pending.dataset.nagiOwned = "thinking-placeholder";
      }
      if (last) {
        if (last.envelope.nextElementSibling !== this.pending)
          last.envelope.after(this.pending);
      } else if (this.pending.parentElement !== pendingParent)
        pendingParent.append(this.pending);
      nodes.add(this.pending);
    } else {
      this.pending?.remove();
      this.pending = null;
    }
    const groups = regions.filter((r) => r.envelope !== r.node);
    this.marks.set(
      "data-nagi-message-envelope",
      groups.map((r) => r.envelope),
    );
    this.marks.set(
      "data-nagi-envelope-identity",
      l.messageAvatars || l.messageNames ? groups.map((r) => r.envelope) : [],
    );
    this.marks.set(
      "data-nagi-message-grouped",
      groups.map((r) => r.node),
    );
    this.marks.set(
      "data-nagi-message-path",
      groups
        .flatMap((r) => r.path)
        .filter((p) => !groups.some((g) => g.envelope === p)),
    );
    this.marks.set(
      "data-nagi-message-accessory",
      groups.flatMap((r) => r.accessories),
    );
    this.marks.set(
      "data-nagi-thinking-envelope",
      thinkingGroup && thinkingGroup.envelope !== thinkingGroup.node
        ? [thinkingGroup.envelope]
        : [],
    );
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
    const messageNodes = regions.map((r) => r.node);
    this.marks.set(
      "data-nagi-message-card",
      l.messageCards ? messageNodes : [],
    );
    this.marks.set("data-nagi-has-identity", identities ? messageNodes : []);
    this.marks.set("data-nagi-message", messageNodes);
    const surfaces = new Set<HTMLElement>(),
      paths = new Set<HTMLElement>();
    const persona = s.personas
      ? state.personas.find((p) => p.id === selection.personaId)
      : null;
    const lastAssistant = last?.role === "assistant" ? last.node : null;
    if (this.pending) {
      const badge = this.badge(this.pending);
      badge.host.toggleAttribute("data-nagi-thinking-identity", true);
      this.showIdentity(
        badge,
        persona?.name ?? "ChatGPT",
        persona?.avatars.thinking ?? persona?.avatars.idle ?? "",
        l.messageAvatars,
        l.messageNames,
        true,
      );
    }
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
        const atEnvelope = r === thinkingGroup && r.envelope !== r.node;
        const badge = this.badge(r.node, atEnvelope ? r.envelope : r.node);
        badge.host.toggleAttribute("data-nagi-thinking-identity", atEnvelope);
        const name =
          r.role === "user" ? l.userName : (persona?.name ?? "ChatGPT");
        const currentPhase =
          r.node === lastAssistant && phase !== "unknown" ? phase : "idle";
        const image =
          r.role === "user"
            ? l.userAvatar
            : (persona?.avatars[currentPhase] ?? persona?.avatars.idle ?? "");
        this.showIdentity(
          badge,
          name,
          image,
          l.messageAvatars,
          l.messageNames,
          r.role === "assistant" && currentPhase === "thinking",
        );
      }
    }
    this.marks.set("data-nagi-message-surface", l.messageCards ? surfaces : []);
    this.marks.set("data-nagi-thread-path", paths);
  }
  dispose() {
    this.pending?.remove();
    this.pending = null;
    this.marks.clear();
    for (const badge of this.badges.values()) badge.host.remove();
    this.badges.clear();
    this.style.remove();
  }
}
