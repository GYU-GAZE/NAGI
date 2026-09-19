import { startApp } from "./app";
import { ExtensionClient } from "./shared/platform";
void startApp(new ExtensionClient()).catch(() => {
  const button = document.createElement("button");
  button.textContent =
    "nAGI indisponível · recarregue ou abra as opções da extensão";
  button.dataset.nagiOwned = "recovery";
  button.style.cssText =
    "position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#192335;color:white;border:1px solid #8196ba;padding:10px;border-radius:8px";
  button.onclick = () => button.remove();
  document.body.append(button);
});
