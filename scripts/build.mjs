import { build } from "esbuild";
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
const base = {
  manifest_version: 3,
  name: "nAGI",
  version: JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ).version,
  description:
    "Temas opcionais, personas locais e Conversation Chains para ChatGPT Web.",
  permissions: ["storage"],
  host_permissions: ["https://chatgpt.com/*"],
  content_scripts: [
    {
      matches: ["https://chatgpt.com/*"],
      js: ["content.js"],
      run_at: "document_idle",
    },
  ],
  action: {
    default_title: "nAGI — controles e recuperacao",
    default_popup: "popup.html",
  },
  options_ui: { page: "options.html", open_in_tab: true },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'none'",
  },
};
for (const target of ["chromium", "firefox"]) {
  const out = `dist/${target}`;
  await mkdir(out, { recursive: true });
  await build({
    entryPoints: {
      content: "src/content.ts",
      background: "src/background/index.ts",
      options: "src/options.ts",
      popup: "src/popup.ts",
    },
    outdir: out,
    bundle: true,
    format: "iife",
    target: ["chrome121", "firefox121"],
    sourcemap: true,
    legalComments: "none",
  });
  const manifest = {
    ...base,
    ...(target === "chromium"
      ? {
          minimum_chrome_version: "121",
          background: { service_worker: "background.js" },
        }
      : {
          background: { scripts: ["background.js"] },
          browser_specific_settings: {
            gecko: {
              id: "nagi@local.extension",
              strict_min_version: "140.0",
              data_collection_permissions: { required: ["none"] },
            },
          },
        }),
  };
  await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
  for (const name of ["options", "popup"])
    await copyFile(`src/${name}.html`, `${out}/${name}.html`);
}
console.log("Built dist/chromium and dist/firefox");
