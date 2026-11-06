import { VERSION } from "./shared/version";
import { ExtensionClient } from "./shared/platform";
import { el, button, uiCSS, note } from "./ui/dom";
const shadow = document.querySelector("#app")!.attachShadow({ mode: "open" });
shadow.append(el("style", uiCSS));
const root = el("div", undefined, "body");
shadow.append(root);
const client = new ExtensionClient();
void client
  .state()
  .then((s) => {
    root.append(
      el("h1", "nAGI"),
      note(`${VERSION} · primeiro marco`),
      button(s.settings.enabled ? "Pausar nAGI" : "Ativar nAGI", () => {
        void client
          .mutate({ type: "settings", patch: { enabled: !s.settings.enabled } })
          .then(() => window.close())
          .catch((e) => root.append(note(String(e))));
      }),
      button("Configurações e recuperação", () => {
        void chrome.runtime.openOptionsPage();
      }),
      note(
        "Personas: identidade visual. Instruções da conta não são alteradas.",
      ),
    );
  })
  .catch((e) => root.append(el("p", String(e), "error")));
