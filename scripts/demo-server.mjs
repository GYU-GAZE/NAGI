import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
await build({
  entryPoints: ["demo/client.ts"],
  outfile: "demo/build/demo.js",
  bundle: true,
  format: "iife",
  target: "es2022",
});
createServer(async (req, res) => {
  const path =
    req.url === "/build/demo.js" ? "demo/build/demo.js" : "demo/index.html";
  try {
    res.setHeader(
      "Content-Type",
      path.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8",
    );
    res.end(await readFile(path));
  } catch {
    res.statusCode = 404;
    res.end();
  }
}).listen(4173, "0.0.0.0", () =>
  console.log("Local fixture: http://localhost:4173/c/demo-session"),
);
