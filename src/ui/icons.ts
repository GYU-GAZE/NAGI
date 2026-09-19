const paths: Record<string, string> = {
  home: "M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10",
  plus: "M12 4v16M4 12h16",
  recent: "M4 7V3m0 4h4M4 7a9 9 0 1 1-1 8M12 7v5l3 2",
  folder: "M3 6h7l2 2h9v12H3zM3 6V4h6l2 2",
  chain:
    "m9 15 6-6M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  pause: "M9 4v16M15 4v16",
  sidebar: "M3 4h18v16H3zM9 4v16",
  debug: "M8 3h8v4H8zM6 8h12v11H6zM3 10h3m12 0h3M3 16h3m12 0h3",
};
export function icon(name: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", name === "chain" ? "-2 0 28 24" : "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", paths[name] ?? paths.settings);
  svg.append(path);
  return svg;
}
