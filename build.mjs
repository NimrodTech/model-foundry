// Builds the Model Foundry page: the drawing twice (isometric and a flat floor plan)
// from scene.mjs, plus the shell, styles, content and runtime.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import { STATIONS, PARTIES, SECTION_TEXT } from "./content.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const iso = await import("./scene.mjs?proj=iso");
const flat = await import("./scene.mjs?proj=flat");
const { W, H, T } = iso;
const svg = iso.svg + flat.svg;
const SECTIONS = iso.SECTION_LIST.map((sec) => ({ ...sec, ...SECTION_TEXT[sec.name] }));

// ---------- page ----------
const kitCss = k.ISO_CSS.slice(k.ISO_CSS.indexOf(".iso-svg{"));
const css = readFileSync(join(HERE, "page.css"), "utf8").replace("/*__KIT__*/", () => kitCss);
const runtime = readFileSync(join(HERE, "runtime.js"), "utf8");
const DATA = { W, H, T, PROJ: { iso: iso.DATA_PART, flat: flat.DATA_PART }, SECTIONS, STATIONS, PARTIES, ISLANDS: iso.ISLAND_NAMES };
const shell = readFileSync(join(HERE, "shell.html"), "utf8");
const page = shell
  .replace("/*__CSS__*/", () => css)
  .replace("<!--__SVG__-->", () => svg)
  .replace("/*__DATA__*/", () => `const DATA = ${JSON.stringify(DATA).replace(/<\//g, "<\\/")};`)
  .replace("/*__RUNTIME__*/", () => runtime);
writeFileSync(join(HERE, "model-foundry.html"), page);
writeFileSync(join(HERE, "preview.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${page}</body></html>`);
console.log("wrote model-foundry.html", (page.length / 1024).toFixed(0) + " KB");

// ---------- the standalone page: one file that can be hosted anywhere ----------
const bodyAt = page.indexOf('<div class="app');
const head = page.slice(0, bodyAt).replace(/<meta name="claude:[^>]*>\n?/g, "");
const licence = readFileSync(join(HERE, "kit", "LICENSE-anatomy"), "utf8").trim();
const description = "An animated isometric diagram of how a trillion-parameter language model gets made, from raw web pages through a hall of GPUs, human feedback and safety testing, to the chat window and back.";
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${description}">
<!--
The Model Foundry. Source: https://github.com/NimrodTech/model-foundry
Drawn with the Anatomy isometric kit: https://github.com/wheresryan22/anatomy

${licence}
-->
${head}</head>
<body>
${page.slice(bodyAt)}</body>
</html>
`;
mkdirSync(join(HERE, "docs"), { recursive: true });
writeFileSync(join(HERE, "docs", "index.html"), standalone);
// served as plain files on GitHub Pages, with no Jekyll processing
writeFileSync(join(HERE, "docs", ".nojekyll"), "");
console.log("wrote docs/index.html", (standalone.length / 1024).toFixed(0) + " KB");
