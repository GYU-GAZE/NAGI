import { ExtensionClient } from "./shared/platform";
import { SettingsUI } from "./ui/settings";
import { uiCSS, el } from "./ui/dom";
const host = document.querySelector<HTMLElement>("#app")!;
const shadow = host.attachShadow({ mode: "open" });
shadow.append(el("style", uiCSS));
const root = el("div", undefined, "body");
shadow.append(root);
const client = new ExtensionClient();
void client
  .state()
  .then((state) => {
    new SettingsUI(root, {
      client,
      state: () => state,
      refresh: (s) => (state = s),
    }).render();
  })
  .catch((e) => root.append(el("p", String(e), "error")));
