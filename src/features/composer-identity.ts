import type { State, Selection } from "../shared/model";
import { resolveRegions } from "../adapter/regions";
/** Optional local selector; the native editor/send/attachment nodes stay untouched. */
export class ComposerIdentity {
  private host = document.createElement("div");
  private button = document.createElement("button");
  constructor(open: () => void) {
    this.host.dataset.nagiOwned = "composer-identity";
    const shadow = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ":host{display:flex;justify-content:flex-end;padding-top:8px;box-sizing:border-box;width:100%;flex-shrink:0;align-self:stretch}button{font:12px/1.4 var(--nagi-ui-font,monospace);color:var(--nagi-ui-text,#d8e7ff);background:var(--nagi-ui-panel,#061c2b);border:1px solid var(--nagi-line,#18526a);border-radius:5px;padding:6px 10px;cursor:pointer}button:hover{border-color:var(--nagi-accent,#32d9f5)}button:focus-visible{outline:2px solid var(--nagi-accent,#32d9f5);outline-offset:2px}";
    this.button.type = "button";
    this.button.addEventListener("click", open);
    shadow.append(style, this.button);
  }
  apply(state: State, selection: Selection) {
    const s = state.settings;
    const region =
      s.enabled &&
      s.layout.variant === "network" &&
      s.layout.composerFrame &&
      s.personas
        ? resolveRegions().composerRoot
        : null;
    if (!region || region.matches("textarea,[contenteditable]")) {
      this.host.remove();
      return;
    }
    if (this.host.parentElement !== region) region.append(this.host);
    const persona = state.personas.find((p) => p.id === selection.personaId);
    const text = `Answer with: ${persona?.name ?? "ChatGPT"} ▾`;
    if (this.button.textContent !== text) this.button.textContent = text;
    this.button.setAttribute(
      "aria-label",
      "Selecionar Persona para o próximo envio",
    );
  }
  dispose() {
    this.host.remove();
  }
}
