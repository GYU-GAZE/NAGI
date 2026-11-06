import { migrate } from "../shared/validation";

export function waitForBody(doc: Document = document): Promise<void> {
  if (doc.body) return Promise.resolve();
  return new Promise((resolve) => {
    const observer = new doc.defaultView!.MutationObserver(() => {
      if (doc.body) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(doc, { childList: true, subtree: true });
  });
}
/** Apply saved colors at document_start; never hide the whole document. */
export async function primeAppearance(
  read: () => Promise<unknown>,
  doc: Document = document,
): Promise<() => void> {
  let root: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(timer);
    root?.removeAttribute("data-nagi-preload");
    root?.removeAttribute("data-nagi-preload-sidebar");
  };
  try {
    const settings = migrate(await read()).settings;
    if (!settings.enabled) return stop;
    if (!doc.documentElement) await waitForBody(doc);
    root = doc.documentElement;
    for (const [name, value] of Object.entries({
      background: settings.theme.background,
      text: settings.theme.text,
      "composer-bg": settings.theme.composer,
      "code-bg": settings.theme.code,
      font: settings.theme.font,
      "font-size": `${settings.theme.fontSize}px`,
      accent: settings.layout.accent,
    }))
      root.style.setProperty(`--nagi-${name}`, value);
    root.setAttribute("data-nagi-preload", "");
    root.toggleAttribute(
      "data-nagi-preload-sidebar",
      settings.hideSidebar && settings.navigation === "topbar",
    );
    timer = setTimeout(stop, 5000);
    return stop;
  } catch {
    stop();
    return stop;
  }
}
