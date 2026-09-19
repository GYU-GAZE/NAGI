import { uiCSS } from "./dom";

/** Separate browsing context: native document/window key handlers cannot see editing events.
 * No script, form submission, remote resource or arbitrary HTML runs in this frame.
 * Nodes and handlers are authored by the content script and adopted into its document. */
export class IsolatedPanel {
  readonly frame = document.createElement("iframe");
  private observer: MutationObserver;
  private native = false;
  private onResize = () => this.resize();
  private onKey: (event: KeyboardEvent) => void;
  constructor(
    readonly panel: HTMLElement,
    close: () => void,
  ) {
    this.frame.dataset.nagiOwned = "panel";
    this.frame.id = "nagi-panel-frame";
    this.frame.title = "Painel de opções nAGI";
    this.frame.setAttribute(
      "sandbox",
      "allow-same-origin allow-top-navigation-by-user-activation allow-downloads",
    );
    this.frame.setAttribute("referrerpolicy", "no-referrer");
    this.frame.style.cssText =
      "position:fixed;z-index:2147483601;display:none;border:1px solid #40506b;border-radius:10px;background:#182131;box-shadow:0 15px 50px #0005;color-scheme:dark;";
    this.frame.hidden = true;
    document.body.append(this.frame);
    const doc = this.frame.contentDocument;
    if (!doc) {
      this.frame.remove();
      throw new Error(
        "Painel isolado indisponível. Abra as opções pelo ícone da extensão.",
      );
    }
    doc.documentElement.lang = "pt-BR";
    const policy = doc.createElement("meta");
    policy.httpEquiv = "Content-Security-Policy";
    policy.content =
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";
    const style = doc.createElement("style");
    style.textContent = `${uiCSS}
:root{color-scheme:dark;font:13px/1.45 system-ui,sans-serif;color:#dce4f1;--accent:#b8d0fa}
html,body{margin:0;padding:0;background:#182131;overflow:hidden}
.panel{width:100%;margin:0;border:0;border-radius:0;box-shadow:none}
.body{max-height:var(--nagi-panel-body-height,65vh)}
`;
    doc.head.append(policy, style);
    doc.body.append(panel);
    // Links in menus navigate the real page, never the frame.
    doc.addEventListener(
      "click",
      (event) => {
        const target = event.target as Element | null;
        const anchor = target?.closest?.("a");
        if (anchor) anchor.target = "_top";
      },
      true,
    );
    this.onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    doc.addEventListener("keydown", this.onKey);
    this.observer = new MutationObserver(() => this.resize());
    this.observer.observe(panel, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener("resize", this.onResize);
  }
  place(native: boolean) {
    this.native = native;
    this.resize();
  }
  show() {
    this.panel.hidden = false;
    this.frame.hidden = false;
    this.frame.style.display = "block";
    this.resize();
  }
  hide() {
    this.panel.hidden = true;
    this.frame.hidden = true;
    this.frame.style.display = "none";
  }
  resize() {
    const width = Math.min(650, Math.max(240, window.innerWidth - 24));
    const integrated = document.documentElement.hasAttribute(
      "data-nagi-header-active",
    );
    const panelTop = integrated
      ? document.documentElement.hasAttribute("data-nagi-header-stacked")
        ? 120
        : 68
      : 60;
    const maximum = Math.max(
      160,
      window.innerHeight - (this.native ? 100 : panelTop + 24),
    );
    this.frame.style.width = `${width}px`;
    this.frame.contentDocument?.documentElement.style.setProperty(
      "--nagi-panel-body-height",
      `${maximum - 55}px`,
    );
    this.frame.style.height = `${Math.min(maximum, Math.max(80, this.panel.offsetHeight + 2 || 450))}px`;
    this.frame.style.left = this.native
      ? "auto"
      : `${Math.max(12, (window.innerWidth - width) / 2)}px`;
    this.frame.style.right = this.native ? "16px" : "auto";
    this.frame.style.top = this.native ? "auto" : `${panelTop}px`;
    this.frame.style.bottom = this.native ? "64px" : "auto";
  }
  dispose() {
    this.observer.disconnect();
    window.removeEventListener("resize", this.onResize);
    this.frame.remove();
  }
}
