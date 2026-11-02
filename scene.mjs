// The Model Foundry drawing in one projection: import it as scene.mjs?proj=iso or
// scene.mjs?proj=flat (straight down, a floor plan). build.mjs assembles both.
// Builds the Model Foundry page: an isometric campus where a trillion-parameter
// model is made, station by station. Geometry comes from the Anatomy kit.
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { STATIONS } from "./content.mjs";

export const PROJ = new URL(import.meta.url).searchParams.get("proj") === "flat" ? "flat" : "iso";
const W = 2400;
const H = 1380;
const T = 6; // station plate top
const P = k.fitProjection(
  [[-300, -660, -14], [2140, -660, -14], [-300, 3000, -14], [2140, 3000, -14], [-300, -660, 150], [2140, -660, 150], [-300, 3000, 150]],
  W, H, PROJ === "flat" ? { pad: 16, azimuth: 90, elevation: 90 } : { pad: 16 },
);

// ---------- primitives ----------
const at = (p) => k.iso(p, P);
const pth = (pts, closed = false) => k.pathOf(pts.map(at), closed);
const dep = (x, y, z = 0) => k.depthOf([x, y, z], P);
const r1 = (n) => Math.round(n * 10) / 10;

function box(x, y, w, d, z, h, o = {}) {
  const r = o.r ?? Math.min(1.2, w / 4, d / 4);
  return k.solidSvg(k.slabOf({ x, y, w, d, r }, z, h, P, o.steps ?? 3, o.bevel ?? 0), {
    tone: o.tone ?? "mid", crease: o.crease ?? "faint", lit: o.lit, className: o.cls, inner: o.inner,
  });
}
function cyl(cx, cy, r, z, h, o = {}) {
  const steps = o.steps ?? Math.max(14, Math.min(48, Math.round(r * 2.2)));
  return k.solidSvg(k.cylinder(cx, cy, r, z, h, P, steps, o.bevel ?? 0), {
    tone: o.tone ?? "mid", crease: o.crease ?? "faint", lit: o.lit, className: o.cls,
  });
}
const line = (pts, o = {}) => k.lineSvg(pth(pts), { tone: o.tone ?? "lo", className: o.cls, free: o.free });
const dots = (pts, o = {}) => k.dotsSvg(pts.map(at), { size: o.size ?? 0.9, tone: o.tone ?? "mid", pulse: o.pulse });
function turned(cx, cy, z, profile, o = {}) {
  const F = G.frameAlong([cx, cy, z], [0, 0, 1]);
  return k.solidSvg(G.solidOf(profile, F, P), { tone: o.tone ?? "mid", crease: o.crease ?? "none", className: o.cls, lit: o.lit });
}
const ball = (c, r, o = {}) => k.solidSvg(G.sphereOf(c, r, P), { tone: o.tone ?? "hi", crease: "none", className: o.cls });
const halo = (plan, z, h = 0.1, blur = 9) => `<path class="iso-halo" d="${k.haloOf(plan, z, h, P)}"${blur !== 9 ? ` style="filter:blur(${blur}px)"` : ""}/>`;
const text = (x, y, z, s, o = {}) => k.faceTextSvg(k.topMatrix([x, y], z, P, o.along ?? "x"), s, { size: o.size ?? 10, tone: o.tone ?? "lo", anchor: o.anchor ?? "start" });

// A painter's list: items sorted back to front by the depth of their footprint.
// Flat paint (labels on a plate) goes in its own layer, under everything that stands.
class Scene {
  constructor() { this.items = []; this.floor = []; }
  add(x, y, z, svg) { this.items.push({ key: dep(x, y, z), i: this.items.length, svg }); return this; }
  paint(svg) { this.floor.push(svg); return this; }
  floorSvg() { return this.floor.join(""); }
  toString() { return this.items.sort((a, b) => a.key - b.key || a.i - b.i).map((it) => it.svg).join(""); }
}

// ---------- parts library ----------
function person(x, y, z, o = {}) {
  const out = [];
  let base = z;
  if (o.seated) {
    out.push(cyl(x, y, 3.2, z, 5.5, { tone: "lo" }));
    base = z + 5.5;
  } else {
    out.push(cyl(x - 0.2, y - 1.5, 1.3, z, 9, { tone: "mid", steps: 10 }));
    out.push(cyl(x + 0.2, y + 1.5, 1.3, z, 9, { tone: "mid", steps: 10 }));
    base = z + 9;
  }
  out.push(k.solidSvg(k.slabOf({ x: x - 2.6, y: y - 3.6, w: 5.2, d: 7.2, r: 2.4 }, base, 8.5, P, 4, 0.5), { tone: "hi", crease: "faint", className: "torso" }));
  out.push(ball([x, y, base + 11.6], 2.9, { cls: "head" }));
  return `<g class="human">${out.join("")}</g>`;
}

// A desk with a monitor; the screen faces +y, the seated person sits in front of it.
function desk(sc, x, y, z, o = {}) {
  const parts = [];
  for (const [dx, dy] of [[-8, -3.5], [7, -3.5], [-8, 2.5], [7, 2.5]]) parts.push(box(x + dx, y + dy, 1, 1, z, 8, { tone: "lo", crease: "none", r: 0.3 }));
  parts.push(box(x - 9, y - 4.5, 18, 9, z + 8, 1.2, { tone: "mid" }));
  const screens = o.two ? [x - 6.5, x + 0.5] : [x - 5.5];
  const sw = o.two ? 6 : 11;
  for (const sx of screens) {
    parts.push(box(sx + sw / 2 - 0.8, y - 2.8, 1.6, 1.2, z + 9.2, 2, { tone: "lo", crease: "none", r: 0.3 }));
    parts.push(box(sx, y - 3.6, sw, 1.2, z + 11, o.two ? 6 : 7.5, { tone: "hi", cls: "screen", r: 0.4 }));
    const face = y - 2.4;
    const top = z + 11 + (o.two ? 6 : 7.5);
    for (let i = 1; i <= 3; i++) parts.push(line([[sx + 1.2, face, top - i * 1.7], [sx + sw - 1.2 - (i % 2) * 2.4, face, top - i * 1.7]], { tone: i === 1 ? "mid" : "faint", cls: "scr", free: true }));
  }
  if (o.papers) for (let i = 0; i < 4; i++) parts.push(box(x + 3.5, y + 0.2, 4.4, 3.2, z + 9.2 + i * 0.5, 0.45, { tone: "lo", crease: "none", r: 0.3 }));
  sc.add(x, y, z, parts.join(""));
  if (o.person !== false) sc.add(x, y + 8, z, person(x, y + 8, z, { seated: true }));
}

// A rack whose front faces +y, with server seams and status LEDs.
function rack(x, y, w, d, z, h, o = {}) {
  const out = [box(x, y, w, d, z, h, { tone: o.tone ?? "mid", cls: o.cls, r: 0.6 })];
  const face = y + d;
  const seams = [];
  for (let zz = z + 4; zz < z + h - 2; zz += o.pitch ?? 3.6) seams.push(pth([[x + 1, face, zz], [x + w - 1, face, zz]]));
  out.push(k.lineSvg(seams.join(""), { tone: "faint" }));
  const leds = [];
  for (let zz = z + h - 3.5; zz > z + 4; zz -= (o.pitch ?? 3.6) * 2) leds.push([x + 2, face, zz]);
  out.push(dots(leds, { size: 0.8, tone: "lo", cls: "led" }));
  if (o.pulse) out.push(`<g class="led-live">${dots([[x + w - 2.2, face, z + h - 5]], { size: 1.1, tone: "hi", pulse: true })}</g>`);
  return out.join("");
}

function crate(x, y, z, s, o = {}) {
  return box(x, y, s, s, z, s * (o.tall ?? 0.8), { tone: o.tone ?? "mid", r: 0.6, bevel: 0.5, inner: line([[x + s, y + 2, z + s * (o.tall ?? 0.8) * 0.5], [x + s, y + s - 2, z + s * (o.tall ?? 0.8) * 0.5]], { tone: "faint" }) });
}

// A turned silo with a conical roof.
function silo(sc, x, y, z, r, h) {
  sc.add(x, y, z, turned(x, y, z, [[0, r], [h, r], [h + r * 0.55, 3.5], [h + r * 0.55 + 3, 3.5]], { tone: "mid" })
    + line([[x + r * 0.71, y + r * 0.71, z + 4], [x + r * 0.71, y + r * 0.71, z + h - 4]], { tone: "faint" })
    + k.lineSvg([0.25, 0.5, 0.75].map((f) => G.arcOf(G.frameAlong([x, y, z], [0, 0, 1]), h * f, r, P)).join(""), { tone: "faint" }));
}

// A hyperbolic cooling tower with its open throat at the top.
function coolingTower(sc, x, y, z, rBase, h) {
  const waist = rBase * 0.62;
  const s0 = h * 0.72;
  const c = s0 / Math.sqrt((rBase / waist) ** 2 - 1);
  const rOf = (s) => waist * Math.sqrt(1 + ((s - s0) / c) ** 2);
  const prof = [];
  for (let i = 0; i <= 16; i++) { const s = (h * i) / 16; prof.push([s, rOf(s), i > 0 && i < 16 ? 1 : 0]); }
  const F = G.frameAlong([x, y, z], [0, 0, 1]);
  const rt = rOf(h);
  const body = k.solidSvg(G.solidOf(prof, F, P), { tone: "mid", crease: "none" });
  const mouth = `<path class="iso-shade" data-shade="0" d="${pth(k.circleRing(x, y, rt - 1.6, 40).map(([a, b]) => [a, b, z + h]), true)}"/>`;
  const legs = [];
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; if (Math.cos(a - Math.PI / 4) < 0.05) continue; legs.push(pth([[x + Math.cos(a) * rBase, y + Math.sin(a) * rBase, z], [x + Math.cos(a + 0.18) * rBase, y + Math.sin(a + 0.18) * rBase, z + 7]])); }
  sc.add(x, y, z, body + mouth + k.lineSvg(legs.join(""), { tone: "lo" }) + k.lineSvg(G.arcOf(F, 7, rOf(7), P), { tone: "lo" }) + k.lineSvg(G.arcOf(F, h - 3, rOf(h - 3), P), { tone: "faint" }) + `<g class="steam" data-x="${x}" data-y="${y}" data-z="${z + h}"></g>`);
}

function transformer(sc, x, y, z) {
  const out = [box(x, y, 26, 20, z, 22, { tone: "mid", bevel: 0.6 })];
  const fins = [];
  for (let i = 3; i < 26; i += 3) fins.push(pth([[x + i, y + 20, z + 3], [x + i, y + 20, z + 19]]));
  for (let i = 3; i < 20; i += 3) fins.push(pth([[x + 26, y + i, z + 3], [x + 26, y + i, z + 19]]));
  out.push(k.lineSvg(fins.join(""), { tone: "lo" }));
  for (const dx of [6, 13, 20]) {
    out.push(cyl(x + dx, y + 10, 1.8, z + 22, 9, { tone: "hi", steps: 14 }));
    out.push(k.lineSvg([25, 27, 29].map((zz) => k.sideArc(x + dx, y + 10, 2.4, z + zz, P, 14)).join(""), { tone: "mid" }));
  }
  sc.add(x + 13, y + 10, z, out.join(""));
}

function dialGauge(x, y, z, r, turn = 0.3) {
  const out = [cyl(x, y, r, z, 3, { tone: "hi", bevel: 0.4 })];
  const ticks = k.radialTicks(x, y, r - 1.2, 30, 5, z + 3, [1, 2.2], P);
  out.push(k.lineSvg(ticks.minor, { tone: "lo" }), k.lineSvg(ticks.major, { tone: "mid" }));
  const a = turn * Math.PI * 2;
  out.push(`<path class="iso-line needle" data-tone="lit" data-free="start" data-cx="${x}" data-cy="${y}" data-z="${z + 3.2}" data-r="${r - 2}" d="${k.lineOnTop([x, y], [x + Math.sin(a) * (r - 2), y - Math.cos(a) * (r - 2)], z + 3.2, P)}"/>`);
  return out.join("");
}

// A lattice mast: four posts with X bracing on the two faces we see.
function mast(sc, x, y, z, h, s = 10) {
  const out = [];
  for (const [dx, dy] of [[0, 0], [s, 0], [0, s], [s, s]].sort((a, b) => a[0] + a[1] - b[0] - b[1])) out.push(box(x + dx - 0.8, y + dy - 0.8, 1.6, 1.6, z, h, { tone: "mid", crease: "none", r: 0.3 }));
  const br = [];
  for (let zz = z; zz < z + h - 12; zz += 14) {
    br.push(pth([[x, y + s, zz], [x + s, y + s, zz + 14]]), pth([[x + s, y + s, zz], [x, y + s, zz + 14]]));
    br.push(pth([[x + s, y, zz], [x + s, y + s, zz + 14]]), pth([[x + s, y + s, zz], [x + s, y, zz + 14]]));
  }
  out.push(k.lineSvg(br.join(""), { tone: "lo" }));
  out.push(box(x - 3, y - 3, s + 6, s + 6, z + h, 2, { tone: "mid" }));
  out.push(cyl(x + s / 2, y + s / 2, 1, z + h + 2, 24, { tone: "hi", steps: 10 }));
  out.push(`<g class="beacon">${dots([[x + s / 2, y + s / 2, z + h + 26]], { size: 2, tone: "hi", pulse: true })}</g>`);
  sc.add(x + s / 2, y + s / 2, z, out.join(""));
}

// ---------- the world ----------
// Eleven stations on a snake of four rows. Plates are sized by how much time,
// compute and judgement goes into each step; the compute hall is the giant.
const ZONES = {
  s01: { cx: 640, cy: 120, w: 760, lanes: ["w", "e"] },
  s02: { cx: 1260, cy: 120, w: 240, d: 240, lanes: ["w", "e"] },
  s03: { cx: 800, cy: 670, w: 680, d: 420, by: 610, lanes: [], pkLast: true, lift: [470, 490, 1110, 1130, T + 3 + 52.4] },
  s04: { cx: 330, cy: 1340, w: 280, lanes: ["n", "e", "w"] },
  s05: { cx: 690, cy: 1340, w: 280, lanes: ["w", "e"] },
  s06: { cx: 1080, cy: 1340, w: 340, lanes: ["w", "e"] },
  s07: { cx: 1470, cy: 1340, w: 280, lanes: ["w", "e"] },
  s08: { cx: 1470, cy: 1970, w: 280, lanes: ["e", "w"] },
  s09: { cx: 1130, cy: 1970, w: 240, lanes: ["e", "w"] },
  s10: { cx: 800, cy: 1970, w: 240, lanes: ["e", "w"] },
  s11: { cx: 330, cy: 1970, w: 360, lanes: ["e", "w"] },
};
const ISLANDS = {
  web: { cx: -40, cy: 120, lanes: ["e"], name: "The open internet" },
  brokers: { cx: 40, cy: -330, lanes: ["e"], name: "Licensors & data brokers" },
  chips: { cx: 1980, cy: 420, lanes: [], name: "Chip supply chain" },
  power: { cx: 1980, cy: 1080, lanes: [], name: "Utilities & energy" },
  annotators: { cx: -60, cy: 1340, lanes: ["e"], name: "Annotators & labellers" },
  users: { cx: -110, cy: 1970, lanes: ["e"], name: "Users & society" },
  evaluators: { cx: 1130, cy: 2700, lanes: [], name: "Independent evaluators" },
  gov: { cx: 760, cy: 2700, lanes: [], name: "Governments & regulators" },
};
// Every plate has an apron along its front edge carrying its name, painted large.
// No belt ever leaves a plate through its front, so the apron stays clear.
const APRON = { station: 96, island: 70 };
// Layout facts for audit.mjs, which checks that nothing overlaps: text boxes, pads, conduits.
export const AUDIT = { texts: [], pads: [], conds: [] };
let AUD_VIEW = "loop";
// a painted line of text as a box on the ground; per = advance per character in em
const textBox = (x, y, str, size, anchor, per) => { const w = str.length * size * per; return { x: anchor === "end" ? x - w : x, y: y - size * 0.74, w, d: size * 0.95 }; };
const MONO = 0.64, SPACED = 0.72; // plain face text (.04em tracking), section names (.12em)
for (const [id, z] of [...Object.entries(ZONES), ...Object.entries(ISLANDS)]) z.id = id;
for (const z of Object.values(ZONES)) { z.w ??= 300; z.d ??= 300; z.by ??= z.cy; z.top = T; z.apron = APRON.station; }
for (const z of Object.values(ISLANDS)) { z.w = 260; z.d = 260; z.by = z.cy; z.top = 0; z.apron = APRON.island; }
const planOf = (z) => ({ x: z.cx - z.w / 2, y: z.cy - z.d / 2, w: z.w, d: z.d + z.apron, r: 10 });
const SBY = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

// Lay a name out on an apron: one line if it reads big enough, else the best two-line break.
// Text is mono, about 0.66 em per character.
function nameLines(num, name, avail, max1, max2) {
  const fit = (lines) => Math.min(...lines.map((ln) => avail / (ln.length * MONO)));
  const pre = num ? `${num} ` : "";
  const one = [`${pre}${name}`];
  let best = { lines: one, size: Math.min(max1, fit(one)) };
  const words = name.split(" ");
  for (let i = 1; i < words.length; i++) {
    const two = [`${pre}${words.slice(0, i).join(" ")}`, `${" ".repeat(pre.length)}${words.slice(i).join(" ")}`];
    const size = Math.min(max2, fit(two));
    const longest = (ls) => Math.max(...ls.map((l) => l.length));
    // a clearly bigger size wins; at the same size, the more even break wins
    if (size > best.size * 1.12 || (best.lines.length === 2 && size >= best.size && longest(two) < longest(best.lines))) best = { lines: two, size };
  }
  return { lines: best.lines, size: r1(best.size) };
}
function apronLabel(z, plan, top, label, num, max1, max2, tone) {
  const y0 = z.cy + z.d / 2;
  const out = [k.lineSvg(k.lineOnTop([plan.x + 12, y0], [plan.x + plan.w - 12, y0], top, P), { tone: "lo" })];
  const { lines, size } = nameLines(num, label.toUpperCase(), plan.w - 40, max1, max2);
  const lh = size * 1.12;
  const block = size * 0.94 + lh * (lines.length - 1);
  const first = y0 + (z.apron - block) / 2 + size * 0.74;
  lines.forEach((ln, i) => {
    out.push(text(plan.x + 20, r1(first + i * lh), top, ln, { size, tone }));
    AUDIT.texts.push({ kind: "apron", zone: z.id, box: textBox(plan.x + 20, first + i * lh, ln, size, "start", MONO), str: ln });
  });
  return out.join("");
}

// Lanes carry the belt from a zone's centre to its edge.
function beltSvg(x0, y0, x1, y1, z, o = {}) {
  const half = o.half ?? 9;
  const alongX = y0 === y1;
  const plan = alongX
    ? { x: Math.min(x0, x1), y: y0 - half, w: Math.abs(x1 - x0), d: half * 2, r: 1 }
    : { x: x0 - half, y: Math.min(y0, y1), w: half * 2, d: Math.abs(y1 - y0), r: 1 };
  const top = z + 2.4;
  const out = [k.solidSvg(k.slabOf(plan, z, 2.4, P, 2, 0), { tone: "lo", crease: "none", className: o.cls ?? "belt" })];
  const rollers = [];
  const len = alongX ? plan.w : plan.d;
  for (let s = 6; s < len - 3; s += 9) {
    if (alongX) rollers.push(pth([[plan.x + s, plan.y + 1.5, top], [plan.x + s, plan.y + plan.d - 1.5, top]]));
    else rollers.push(pth([[plan.x + 1.5, plan.y + s, top], [plan.x + plan.w - 1.5, plan.y + s, top]]));
  }
  out.push(k.lineSvg(rollers.join(""), { tone: "faint" }));
  return out.join("");
}
function lanesOf(z) {
  const out = [];
  const reach = { e: [z.cx + z.w / 2, z.cy], w: [z.cx - z.w / 2, z.cy], n: [z.cx, z.cy - z.d / 2], s: [z.cx, z.cy + z.d / 2] };
  const pad = { e: [z.cx - 9, z.cy], w: [z.cx + 9, z.cy], n: [z.cx, z.cy + 9], s: [z.cx, z.cy - 9] };
  for (const l of z.lanes) out.push(beltSvg(pad[l][0], pad[l][1], reach[l][0], reach[l][1], z.top));
  // painted walkway lines either side of each belt, ending on the plate groove
  const walk = [];
  for (const l of z.lanes) {
    const along = l === "e" || l === "w";
    const sgn = l === "e" || l === "s" ? 1 : -1;
    const from = 30, to = (along ? z.w : z.d) / 2 - 7;
    for (const off of [-19, 19]) {
      if (along) walk.push(k.lineOnTop([z.cx + sgn * from, z.cy + off], [z.cx + sgn * to, z.cy + off], z.top, P));
      else walk.push(k.lineOnTop([z.cx + off, z.cy + sgn * from], [z.cx + off, z.cy + sgn * to], z.top, P));
    }
  }
  if (walk.length) out.push(k.lineSvg(walk.join(""), { tone: "faint" }));
  return out.join("");
}

// Conduits on the ground: a shallow tray with a flow line on top.
function conduit(points, kind, o = {}) {
  const wid = o.w ?? 7;
  AUDIT.conds.push({ view: AUD_VIEW, kind, points, w: wid });
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const alongX = a[1] === b[1];
    const plan = alongX
      ? { x: Math.min(a[0], b[0]) - wid / 2, y: a[1] - wid / 2, w: Math.abs(b[0] - a[0]) + wid, d: wid, r: 1 }
      : { x: a[0] - wid / 2, y: Math.min(a[1], b[1]) - wid / 2, w: wid, d: Math.abs(b[1] - a[1]) + wid, r: 1 };
    out.push(k.solidSvg(k.slabOf(plan, 0, 1.4, P, 2, 0), { tone: "faint", crease: "none", className: "tray" }));
  }
  const d = pth(points.map(([x, y]) => [x, y, 1.5]));
  out.push(`<path class="flow f-${kind}${o.heavy ? " heavy" : ""}" d="${d}"/>`);
  return `<g class="conduit c-${kind}" data-kind="${kind}"${o.party ? ` data-party="${o.party}"` : ""}>${out.join("")}</g>`;
}

// ---------- station plate ----------
function stationBase(id, z) {
  const plan = planOf(z);
  const out = [halo(plan, 0, T)];
  out.push(k.solidSvg(k.slabOf(plan, 0, T, P, 6, 1.2), { tone: "mid", crease: "faint", className: "plate" }));
  out.push(k.lineSvg(k.planOutline(k.insetPlan(plan, 7), T, P), { tone: "faint" }));
  const screws = k.corners(plan, 14);
  out.push(k.lineSvg(screws.map(([x, y]) => k.ring(x, y, 3, T, P, 16)).join(""), { tone: "lo" }));
  out.push(dots(screws.map(([x, y]) => [x, y, T]), { size: 0.9, tone: "mid" }));
  out.push(`<g class="apron">${apronLabel(z, plan, T, SBY[id].name, SBY[id].n, 40, 34, "hi")}</g>`);
  return out.join("");
}
function islandBase(id, z) {
  const plan = { ...planOf(z), r: 18 };
  const out = [halo(plan, -14, 14)];
  out.push(k.solidSvg(k.slabOf(plan, -14, 14, P, 8, 1.4), { tone: "mid", crease: "faint", className: "plate" }));
  out.push(k.lineSvg(k.planOutline(k.insetPlan(plan, 8), 0, P), { tone: "faint" }));
  const screws = k.corners(plan, 16);
  out.push(k.lineSvg(screws.map(([x, y]) => k.ring(x, y, 3, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(dots(screws.map(([x, y]) => [x, y, 0]), { size: 0.9, tone: "mid" }));
  out.push(`<g class="apron isl">${apronLabel(z, plan, 0, z.name, "", 24, 24, "mid")}</g>`);
  return out.join("");
}

// A merged step's machines carry its id, so the panel can light them up.
const tagged = (sc, pid) => ({ add: (x, y, z, svg) => sc.add(x, y, z, `<g class="part" data-part="${pid}">${svg}</g>`), paint: (svg) => sc.paint(svg) });
// a step's name painted on the plate in front of its machine
const floorLabel = (sc, x, y, s, size = 12) => sc.paint(text(x, y, T, s, { size, tone: "mid" }));

// ---------- stations ----------
const BUILD = {};

// 01 Data refinery: one line of four machines. Intake hopper, sieve tower,
// token press, blending silos.
BUILD.s01 = (sc0, { cx, cy }) => {
  const [m1, m2, m3, m4] = [cx - 285, cx - 95, cx + 95, cx + 285];
  // the licensed feed from the brokers comes in from the back, onto the intake
  sc0.paint(beltSvg(m1, cy - 150, m1, cy - 9, T));
  // ----- intake: a big hopper over the belt, fed by crawlers, licences and generators
  {
    const sc = tagged(sc0, "s01");
    const legs = [[-30, -30], [30, -30], [-30, 30], [30, 30]].map(([dx, dy]) => box(m1 + dx - 2, cy + dy - 2, 4, 4, T, 34, { tone: "lo", crease: "none", r: 0.5 })).join("");
    const F = G.frameAlong([m1, cy, T + 30], [0, 0, 1]);
    const hop = k.solidSvg(G.solidOf([[0, 8, 0], [6, 12, 1], [44, 46, 0], [50, 46, 0]], F, P), { tone: "hi", crease: "none" });
    const mouth = `<path class="iso-shade" data-shade="0" d="${pth(k.circleRing(m1, cy, 42, 48).map(([a, b]) => [a, b, T + 80]), true)}"/>`;
    sc.add(m1, cy, T, legs + hop + mouth + k.lineSvg(G.arcOf(F, 22, 26, P) + G.arcOf(F, 36, 38, P), { tone: "faint" }));
    mast(sc, m1 + 52, cy - 120, T, 92, 12);
    const cr = [[-84, -126, 0], [-64, -126, 0], [-84, -106, 0], [-64, -106, 0], [-84, -126, 1]];
    for (const [dx, dy, lv] of cr) sc.add(m1 + dx + 8, cy + dy + 8, T + lv * 14, crate(m1 + dx, cy + dy, T + lv * 14.4, 18));
    sc.add(m1 - 70, cy + 70, T, rack(m1 - 86, cy + 54, 16, 18, T, 40, { pulse: true }) + rack(m1 - 70, cy + 54, 16, 18, T, 40));
    sc.add(m1 + 70, cy + 64, T, person(m1 + 70, cy + 64, T));
    floorLabel(sc, m1 - 40, cy + 104, "INTAKE");
  }
  // ----- filter & deduplicate: a tower of sieves, each finer than the last, rejects falling to a bin
  {
    const sc = tagged(sc0, "s02");
    const parts = [];
    for (const [dx, dy] of [[-34, -34], [32, -34], [-34, 32], [32, 32]]) parts.push(box(m2 + dx, cy + dy, 2.5, 2.5, T, 92, { tone: "lo", crease: "none", r: 0.5 }));
    [0, 1, 2].forEach((i) => {
      const z = T + 30 + i * 22, s = 70;
      parts.push(box(m2 - s / 2, cy - s / 2, s, s, z, 7, { tone: i === 2 ? "hi" : "mid", bevel: 0.6 }));
    });
    const mesh = [];
    for (let s = 6; s < 70; s += 6) { mesh.push(k.lineOnTop([m2 - 35 + s, cy - 32], [m2 - 35 + s, cy + 32], T + 81, P)); mesh.push(k.lineOnTop([m2 - 32, cy - 35 + s], [m2 + 32, cy - 35 + s], T + 81, P)); }
    parts.push(k.lineSvg(mesh.join(""), { tone: "lo" }));
    sc.add(m2, cy, T, parts.join(""));
    // reject bin behind, with the chute from the tower
    sc.add(m2, cy - 105, T, box(m2 - 26, cy - 122, 52, 30, T, 20, { tone: "lo", bevel: 0.6 }) + `<path class="iso-shade" data-shade="0" d="${pth(k.roundedPlan({ x: m2 - 22, y: cy - 118, w: 44, d: 22, r: 1 }, 3).map(([a, b]) => [a, b, T + 20]), true)}"/>` + line([[m2, cy - 92, T + 20], [m2, cy - 36, T + 48]], { tone: "mid" }));
    // duplicate-catching drums
    for (const dx of [-36, -8]) sc.add(m2 + dx, cy + 80, T, cyl(m2 + dx, cy + 80, 12, T, 30, { tone: "mid" }) + k.lineSvg(k.ring(m2 + dx, cy + 80, 8, T + 30, P, 32), { tone: "lo" }));
    sc.add(m2 + 50, cy + 80, T, rack(m2 + 38, cy + 68, 24, 20, T, 26) + dialGauge(m2 + 50, cy + 78, T + 26, 8, 0.62));
    floorLabel(sc, m2 - 60, cy + 104, "FILTER · DEDUPLICATE");
  }
  // ----- tokenize: the press that cuts text into token bricks
  {
    const sc = tagged(sc0, "s03");
    sc.add(m3, cy - 34, T, box(m3 - 34, cy - 40, 68, 80, T, 6, { tone: "mid", bevel: 0.8 }) + box(m3 - 7, cy - 42, 14, 9, T + 6, 84, { tone: "mid", bevel: 0.4 }));
    sc.add(m3, cy + 34, T + 6, box(m3 - 7, cy + 33, 14, 9, T + 6, 84, { tone: "mid", bevel: 0.4 }));
    sc.add(m3 + 1, cy + 1, T + 80, box(m3 - 14, cy - 46, 28, 92, T + 90, 16, { tone: "hi", bevel: 0.8 }) + cyl(m3, cy - 22, 15, T + 106, 6, { tone: "hi" }) + k.lineSvg(k.knurl(m3, cy - 22, 15, T + 106, T + 112, 40, P), { tone: "lo" }) + cyl(m3, cy + 20, 5, T + 106, 10, { tone: "mid" }));
    sc.add(m3, cy, T + 60, `<g class="ram" data-z="0">${box(m3 - 17, cy - 22, 34, 44, T + 50, 12, { tone: "hi", lit: true, bevel: 0.6 })}${box(m3 - 3, cy - 3, 6, 6, T + 62, 28, { tone: "mid", crease: "none" })}</g>`);
    // token bricks stacked by the output side
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) for (let lv = 0; lv < 2 - (c % 2); lv++) {
      const x = m3 + 30 + c * 11, y = cy + 48 + r * 11;
      sc.add(x + 4, y + 4, T + lv * 9, box(x, y, 9, 9, T + lv * 9, 8, { tone: lv ? "hi" : "mid", r: 0.6 }));
    }
    // the vocabulary: a chest of drawers
    const cab = [box(m3 - 70, cy - 126, 56, 24, T, 40, { tone: "mid", bevel: 0.6 })];
    const dr = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const x0 = m3 - 67 + c * 13, z0 = T + 4 + r * 9; dr.push(pth([[x0, cy - 102, z0], [x0 + 11.4, cy - 102, z0], [x0 + 11.4, cy - 102, z0 + 7], [x0, cy - 102, z0 + 7]], true)); }
    cab.push(k.lineSvg(dr.join(""), { tone: "lo" }));
    sc.add(m3 - 42, cy - 114, T, cab.join(""));
    floorLabel(sc, m3 - 40, cy + 104, "TOKENIZE");
  }
  // ----- mix & shard: one silo per source, chutes into a blending drum, shards out the front
  {
    const sc = tagged(sc0, "s04");
    [-63, -21, 21, 63].forEach((dx, i) => {
      silo(sc, m4 + dx, cy - 100, T, 17, 58 + (i % 2) * 10);
      sc.add(m4 + dx, cy - 60, T, line([[m4 + dx, cy - 83, T + 8], [m4 + dx, cy - 50, T + 8], [m4 + dx * 0.3, cy - 22, T + 30]], { tone: "lo" }));
    });
    sc.add(m4, cy, T, cyl(m4, cy, 30, T, 34, { tone: "hi", bevel: 0.8 }) + k.lineSvg([10, 22].map((z) => k.sideArc(m4, cy, 30, T + z, P, 40)).join(""), { tone: "faint" }) + box(m4 - 10, cy - 10, 20, 20, T + 34, 12, { tone: "mid" }) + cyl(m4, cy, 4, T + 46, 8, { tone: "mid" }));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let lv = 0; lv < 2; lv++) {
      const x = m4 + 8 + c * 20, y = cy + 44 + r * 20;
      sc.add(x + 8, y + 8, T + lv * 12, box(x, y, 16, 16, T + lv * 12.4, 12, { tone: lv ? "hi" : "mid", bevel: 0.4 }));
    }
    floorLabel(sc, m4 - 80, cy + 104, "MIX · SHARD");
  }
};

// 02 Design office: a scale model of the architecture, the scaling-law board, small test runs.
BUILD.s02 = (sc, { cx, cy }) => {
  const bx = cx - 105, by = cy - 108, bw = 84;
  sc.add(bx + bw / 2, by, T, box(bx, by, bw, 3, T + 10, 50, { tone: "hi", bevel: 0.4 }) + box(bx + 6, by, 2, 3, T, 10, { tone: "lo", crease: "none" }) + box(bx + bw - 8, by, 2, 3, T, 10, { tone: "lo", crease: "none" })
    + line([[bx + 8, by + 3, T + 54], [bx + 8, by + 3, T + 16], [bx + bw - 6, by + 3, T + 16]], { tone: "mid" })
    + line(Array.from({ length: 24 }, (_, i) => { const t = i / 23; return [bx + 10 + t * (bw - 20), by + 3, T + 18 + 32 * Math.pow(1 - t * 0.92, 2.2)]; }), { tone: "lit", cls: "curve" })
    + dots([0.1, 0.3, 0.5, 0.7].map((t) => [bx + 10 + t * (bw - 20), by + 3, T + 18 + 32 * Math.pow(1 - t * 0.92, 2.2) + 1.2]), { size: 1.4, tone: "hi" }));
  sc.add(bx + 40, by + 30, T, person(bx + 40, by + 30, T));
  // the hero: a scale model of the network, layer on layer, each with a ring of experts
  const ax = cx + 52, ay = cy - 52;
  const arch = [box(ax - 34, ay - 34, 68, 68, T, 5, { tone: "mid", bevel: 0.6 })];
  for (const [dx, dy] of [[-28, -28], [28, -28], [-28, 28], [28, 28]]) arch.push(box(ax + dx - 1.2, ay + dy - 1.2, 2.4, 2.4, T + 5, 84, { tone: "lo", crease: "none", r: 0.4 }));
  for (let l = 0; l < 6; l++) {
    const z = T + 12 + l * 13;
    arch.push(box(ax - 30, ay - 30, 60, 60, z, 2.4, { tone: l === 5 ? "hi" : "mid" }));
    for (let e = 0; e < 8; e++) { const a = (e / 8) * Math.PI * 2; const on = (e + l) % 4 === 1; arch.push(box(ax + Math.cos(a) * 19 - 3, ay + Math.sin(a) * 19 - 3, 6, 6, z + 2.4, 5, { tone: on ? "hi" : "lo", lit: on && l === 5, r: 0.6 })); }
  }
  sc.add(ax, ay, T, arch.join(""));
  // test runs on a small cluster
  for (let i = 0; i < 4; i++) sc.add(cx + 40 + i * 15 + 7, cy + 52, T, rack(cx + 36 + i * 15, cy + 42, 14, 18, T, 32, { pulse: i % 2 === 0 }));
  desk(sc, cx - 70, cy + 48, T, { papers: true });
};

// 03 Pretraining: the GPU hall, with the checkpoint annex along its front.
BUILD.s03 = (sc0) => {
  const X0 = 460, Y0 = 460, HW = 680, HD = 300;
  const F = T + 3; // raised floor
  const sc = tagged(sc0, "s06");
  // back walls (cutaway: only the far two sides stand)
  sc.add(X0, Y0, -50, box(X0 + 4, Y0 + 4, HW - 8, 4, T, 44, { tone: "lo", bevel: 0.4 }) + box(X0 + 4, Y0 + 4, 4, HD - 8, T, 44, { tone: "lo", bevel: 0.4 }));
  sc.add(X0, Y0, -40, k.solidSvg(k.slabOf({ x: X0 + 10, y: Y0 + 10, w: HW - 20, d: HD - 20, r: 4 }, T, 3, P, 4, 0.6), { tone: "lo", crease: "faint" })
    + k.lineSvg(Array.from({ length: 33 }, (_, i) => k.lineOnTop([X0 + 10 + i * 20, Y0 + 10], [X0 + 10 + i * 20, Y0 + HD - 10], F, P)).join(""), { tone: "faint" }));
  // GPU rack rows, fronts facing +y, either side of the belt
  const rows = [480, 516, 552, 640, 676, 712];
  const RX0 = 568, RW = 12, N = 30;
  rows.forEach((ry, ri) => {
    for (let i = 0; i < N; i++) {
      const x = RX0 + i * RW;
      const cdu = i % 10 === 9;
      sc.add(x + RW / 2, ry + 8, F, rack(x, ry, RW, 16, F, cdu ? 28 : 32, { tone: cdu ? "lo" : "mid", pulse: !cdu && (i * 7 + ri * 3) % 5 === 0, cls: cdu ? "cdu" : "gpu" }));
    }
    const tray = box(RX0, ry + 4, RW * N, 8, F + 42, 2, { tone: "mid", crease: "none", r: 0.6 }) + box(RX0 - 3, ry + 7, 2, 2, F, 42, { tone: "lo", crease: "none", r: 0.4 }) + box(RX0 + RW * N + 1, ry + 7, 2, 2, F, 42, { tone: "lo", crease: "none", r: 0.4 });
    const cables = k.lineSvg([2, 4, 6].map((dy) => pth([[RX0 + 2, ry + 4 + dy, F + 44], [RX0 + RW * N - 2, ry + 4 + dy, F + 44]])).join(""), { tone: "faint" });
    sc.add(RX0 + (RW * N) / 2, ry + 16.5, F + 30, tray + cables);
  });
  for (let i = 0; i < 4; i++) sc.add(486 + i * 16, 488, F, rack(480 + i * 16, 478, 14, 18, F, 46, { pitch: 2.2, pulse: true, cls: "spine" }));
  sc.add(500, 545, F, line([[486, 496, F + 44], [486, 560, F + 44], [568, 560, F + 44]], { tone: "lo" }) + line([[512, 496, F + 44], [512, 524, F + 44], [568, 524, F + 44]], { tone: "lo" }));
  sc.add(512, 640, F, box(474, 632, 76, 3, F, 40, { tone: "hi", bevel: 0.4 })
    + line(Array.from({ length: 30 }, (_, i) => { const t = i / 29; const spike = Math.exp(-((t - 0.55) ** 2) / 0.0008) * 6; return [480 + t * 64, 635, F + 10 + 24 * Math.pow(1 - t * 0.9, 3) + spike]; }), { tone: "lit", cls: "curve" })
    + line([[480, 635, F + 36], [480, 635, F + 8], [546, 635, F + 8]], { tone: "mid" }));
  desk(sc, 490, 668, F);
  desk(sc, 530, 668, F, { two: true });
  desk(sc, 510, 712, F);
  coolingTower(sc, 990, 520, T, 32, 92);
  coolingTower(sc, 1078, 520, T, 32, 92);
  for (const x of [960, 1010, 1060]) sc.add(x + 18, 566, T, box(x, 557, 36, 18, T, 16, { tone: "mid", bevel: 0.6 }) + cyl(x + 9, 566, 6, T + 16, 2, { tone: "lo" }) + cyl(x + 27, 566, 6, T + 16, 2, { tone: "lo" }) + k.lineSvg([3, 4.5].map((r) => k.ring(x + 9, 566, r, T + 18, P, 20) + k.ring(x + 27, 566, r, T + 18, P, 20)).join(""), { tone: "faint" }));
  sc.add(940, 566, T + 4, line([[958, 566, T + 10], [934, 566, T + 10], [934, 576, F + 46], [568, 576, F + 46]], { tone: "mid", cls: "coolant" }));
  // data comes in at floor level, rides a lift and an overhead rail above the aisle
  const RZ = F + 50;
  sc.add(1135, 610, T, beltSvg(1140, 610, 1120, 610, T));
  sc.add(465, 610, T, beltSvg(460, 610, 480, 610, T));
  for (const lx of [470, 1110]) sc.add(lx + 10, 610, RZ + 40, box(lx, 600, 20, 20, T, RZ + 2.4 - T, { tone: "mid", bevel: 0.5, inner: k.lineSvg(Array.from({ length: 6 }, (_, i) => pth([[lx + 20, 602, T + 8 + i * 8], [lx + 20, 618, T + 8 + i * 8]])).join(""), { tone: "faint" }) }));
  const rail = [box(490, 603, 620, 14, RZ, 2.4, { tone: "lo", crease: "none", cls: "belt" })];
  rail.push(k.lineSvg(Array.from({ length: 68 }, (_, i) => k.lineOnTop([494 + i * 9, 604.5], [494 + i * 9, 615.5], RZ + 2.4, P)).join(""), { tone: "faint" }));
  for (let x = 560; x < 1100; x += 90) rail.push(box(x - 1, 609, 2, 2, F, RZ - F, { tone: "lo", crease: "none", r: 0.4 }));
  sc.add(800, 610, RZ + 60, rail.join(""));
  transformer(sc, 965, 640, T);
  transformer(sc, 1005, 640, T);
  transformer(sc, 1045, 640, T);
  for (const x of [962, 1002, 1042, 1082]) sc.add(x + 10, 712, T, box(x, 700, 22, 24, T, 28, { tone: "mid", bevel: 0.5, inner: line([[x + 22, 702, T + 14], [x + 22, 722, T + 14]], { tone: "faint" }) }) + dots([[x + 6, 724, T + 22], [x + 12, 724, T + 22]], { size: 1, tone: "hi" }));
  sc.add(1105, 660, T, box(1092, 636, 26, 40, T, 4, { tone: "lo" }) + [1098, 1112].map((x) => cyl(x, 656, 2, T + 4, 30, { tone: "hi", steps: 12 })).join("") + line([[1098, 656, T + 34], [1112, 656, T + 34]], { tone: "mid" }));
  floorLabel(sc, 600, 758, "PRETRAINING · THE GPU HALL", 9);
  // ----- the annex: checkpoints and mid-training
  const an = tagged(sc0, "s07");
  // storage arrays where snapshots land
  for (let i = 0; i < 14; i++) an.add(486 + i * 17 + 8, 790, T, rack(486 + i * 17, 780, 16, 16, T, 22, { pitch: 2.4, pulse: i % 4 === 1, cls: "store" }));
  // the vault for the chosen checkpoints, door facing +y
  const vx = 760, vy = 772, vw = 70, vd = 52, vh = 46;
  const ring = (r, z0) => pth(Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * Math.PI * 2; return [vx + vw / 2 + Math.cos(a) * r, vy + vd, z0 + Math.sin(a) * r]; }), true);
  an.add(vx + vw / 2, vy + vd / 2, T, box(vx, vy, vw, vd, T, vh, { tone: "hi", bevel: 1 }) + k.lineSvg(ring(16, T + 23) + ring(12, T + 23), { tone: "mid" }) + k.lineSvg(Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return pth([[vx + vw / 2, vy + vd, T + 23], [vx + vw / 2 + Math.cos(a) * 10, vy + vd, T + 23 + Math.sin(a) * 10]]); }).join(""), { tone: "mid" }) + dots([[vx + vw / 2, vy + vd, T + 23]], { size: 1.6, tone: "hi" }));
  // context stretcher: a long ruler with a carriage, 8K to 128K
  const rx = 870, ry = 790;
  an.add(rx + 60, ry + 10, T, box(rx, ry, 130, 14, T, 4, { tone: "mid" }) + k.lineSvg(k.topTicks(rx + 4, rx + 126, 4, 5, ry + 1, T + 4, [2.5, 5], P).minor, { tone: "lo" }) + k.lineSvg(k.topTicks(rx + 4, rx + 126, 4, 5, ry + 1, T + 4, [2.5, 5], P).major, { tone: "mid" }));
  an.add(rx + 90, ry + 7, T + 4, `<g class="stretch">${box(rx + 84, ry - 2, 14, 18, T + 4, 8, { tone: "hi", lit: true, bevel: 0.5 })}</g>`);
  desk(an, 1050, 790, T);
  floorLabel(an, 486, 828, "CHECKPOINTS · MID-TRAINING", 9);
};

// 04 Fine-tuning: a roller press that stamps people's example answers onto the model.
BUILD.s04 = (sc, { cx, cy }) => {
  // two side frames, each an arch the belt passes through
  const frame = (x) => [cy - 32, cy + 28].map((y) => box(x, y, 5, 5, T, 72, { tone: "mid", crease: "none", r: 0.6 })).join("") + box(x - 1, cy - 34, 7, 69, T + 72, 7, { tone: "hi", bevel: 0.5 });
  sc.add(cx - 46, cy, T, frame(cx - 48));
  // the rollers: the lower one carries the model, the upper one the written examples
  const roller = (z, r, tone) => k.solidSvg(G.solidOf([[0, 0], [0, r], [84, r], [84, 0]], G.frameAlong([cx - 42, cy, z], [1, 0, 0]), P), { tone, crease: "none" });
  sc.add(cx, cy, T + 24, roller(T + 26, 13, "mid"));
  sc.add(cx, cy + 1, T + 50, roller(T + 53, 13, "hi") + k.lineSvg(Array.from({ length: 7 }, (_, i) => pth([[cx - 36 + i * 12, cy + 4, T + 65.4], [cx - 36 + i * 12, cy + 9, T + 64]])).join(""), { tone: "faint" }));
  sc.add(cx + 46, cy, T, frame(cx + 44));
  // a sheet of examples feeding in over the top roller, and the stack it comes from
  sc.add(cx, cy - 30, T + 66, k.solidSvg(k.slabOf({ x: cx - 30, y: cy - 42, w: 60, d: 26, r: 0.5 }, T + 64, 0.8, P, 2), { tone: "hi", lit: true, crease: "none" }));
  for (let i = 0; i < 8; i++) sc.add(cx - 62, cy - 70, T + i, box(cx - 76, cy - 80, 30, 20, T + i * 0.9, 0.8, { tone: i === 7 ? "hi" : "lo", crease: "none", lit: i === 7 }));
  // the writers
  for (const [dx, dy] of [[-90, -100], [95, -100], [-95, 62], [95, 62]]) desk(sc, cx + dx, cy + dy, T, { papers: true });
};

// 05 Reward model: a balance weighing answer A against answer B, raters behind it.
BUILD.s05 = (sc, { cx, cy }) => {
  for (const dx of [-96, -32, 32, 96]) desk(sc, cx + dx, cy - 112, T, { two: true });
  const bx = cx, by = cy - 30;
  sc.add(bx, by, T, cyl(bx, by, 22, T, 6, { tone: "mid", bevel: 0.6 }) + cyl(bx, by, 3.4, T + 6, 82, { tone: "mid", steps: 14 }) + cyl(bx, by, 6, T + 86, 5, { tone: "hi" }));
  sc.add(bx, by + 1, T + 90, `<g class="balance" data-x="${bx}" data-y="${by}" data-z="${T + 90}" data-arm="62" data-drop="38"></g>`);
  // answer cards A and B on the table in front
  sc.add(cx - 80, cy + 82, T, box(cx - 100, cy + 70, 40, 26, T, 14, { tone: "mid", bevel: 0.5 }) + box(cx - 96, cy + 74, 14, 18, T + 14, 0.8, { tone: "hi", lit: true, crease: "none" }) + box(cx - 78, cy + 74, 14, 18, T + 14, 0.8, { tone: "hi", crease: "none" }));
  sc.add(cx + 95, cy + 90, T, rack(cx + 80, cy + 76, 16, 20, T, 38, { pulse: true }) + rack(cx + 96, cy + 76, 16, 20, T, 38));
  sc.add(cx + 50, cy + 110, T, person(cx + 50, cy + 112, T));
};

// 06 Reinforcement learning: a practice carousel. Task pods ride round the model; a verifier lights on success.
BUILD.s06 = (sc, { cx, cy }) => {
  sc.add(cx, cy, T, cyl(cx, cy, 92, T, 5, { tone: "mid", bevel: 1, steps: 80 }) + k.lineSvg(k.ring(cx, cy, 76, T + 5, P, 80) + k.ring(cx, cy, 58, T + 5, P, 80), { tone: "lo" }) + k.lineSvg(k.radialTicks(cx, cy, 90, 60, 5, T + 5, [2, 4], P).minor, { tone: "faint" }));
  sc.add(cx, cy, T + 5.5, `<g class="pods-back"></g>`);
  sc.add(cx, cy, T + 6, cyl(cx, cy, 24, T + 5, 58, { tone: "hi", lit: true, bevel: 0.8, cls: "hub" }) + k.lineSvg([16, 30, 44].map((z) => k.sideArc(cx, cy, 24, T + 5 + z, P, 40)).join(""), { tone: "faint" }) + cyl(cx, cy, 12, T + 63, 7, { tone: "mid" }));
  sc.add(cx, cy, T + 7, `<g class="pods-front"></g>`);
  for (let i = 0; i < 4; i++) sc.add(cx - 150 + i * 15 + 7, cy - 128, T, rack(cx - 150 + i * 15, cy - 138, 14, 18, T, 36, { pulse: i % 2 === 1 }));
  sc.add(cx + 135, cy + 105, T, cyl(cx + 135, cy + 105, 9, T, 4, { tone: "mid" }) + cyl(cx + 135, cy + 105, 1.8, T + 4, 34, { tone: "mid", steps: 10 }) + [0, 1, 2].map((i) => cyl(cx + 135, cy + 105, 5, T + 38 + i * 7, 6.4, { tone: "hi", cls: `sig sig${i}`, steps: 20 })).join(""));
  desk(sc, cx - 125, cy + 95, T);
  sc.add(cx + 110, cy + 120, T, person(cx + 110, cy + 122, T));
};

// 07 Safety & red-teaming: a firing range. Attackers send prompts at a shielded model.
BUILD.s07 = (sc, { cx, cy }) => {
  // the model on the line, a shield panel on its far side
  sc.add(cx, cy - 40, T, box(cx - 44, cy - 44, 88, 4, T, 54, { tone: "lo", bevel: 0.4, cls: "shield" }) + dots([[cx - 22, cy - 40, T + 36], [cx + 6, cy - 40, T + 22], [cx + 24, cy - 40, T + 42], [cx - 6, cy - 40, T + 46]], { size: 1.6, tone: "hi" }));
  sc.add(cx, cy, T, box(cx - 18, cy - 18, 36, 36, T, 26, { tone: "hi", lit: true, bevel: 0.8 }) + k.lineSvg(k.planOutline({ x: cx - 12, y: cy - 12, w: 24, d: 24, r: 1 }, T + 26, P), { tone: "lo" }));
  // the red-team booth at the back, prompts flying at the shield
  sc.add(cx, cy - 128, T, box(cx - 120, cy - 136, 240, 4, T, 22, { tone: "lo" }));
  for (const dx of [-80, 0, 80]) desk(sc, cx + dx, cy - 118, T, { two: dx === 0 });
  sc.add(cx, cy - 70, T + 30, k.lineSvg([[-80, -22], [0, 6], [80, 24]].map(([dx, hx]) => pth([[cx + dx, cy - 108, T + 20], [cx + hx, cy - 44, T + 34]])).join(""), { tone: "lit", cls: "attack" }));
  // the written rules on a lectern
  const lx = cx - 90, ly = cy + 80;
  sc.add(lx, ly, T, box(lx - 10, ly - 8, 20, 16, T, 26, { tone: "mid", bevel: 0.6 }) + box(lx - 12, ly - 10, 24, 20, T + 26, 2, { tone: "mid" }) + box(lx - 9, ly - 7, 8.4, 14, T + 28, 1.2, { tone: "hi", lit: true }) + box(lx + 0.6, ly - 7, 8.4, 14, T + 28, 1.2, { tone: "hi", lit: true }) + k.lineSvg([-4, -1, 2, 5].map((dy) => k.lineOnTop([lx - 7.6, ly + dy], [lx - 2, ly + dy], T + 29.3, P) + k.lineOnTop([lx + 2, ly + dy], [lx + 7.6, ly + dy], T + 29.3, P)).join(""), { tone: "faint", free: true }));
  sc.add(lx - 4, ly + 22, T, person(lx - 4, ly + 22, T));
  // interpretability: a microscope over a block of the model
  const mx = cx + 80, my = cy + 70;
  sc.add(mx, my, T, box(mx - 26, my - 26, 52, 46, T, 4, { tone: "mid", bevel: 0.6 }) + box(mx - 12, my - 12, 24, 24, T + 4, 18, { tone: "hi", bevel: 0.5 }) + dots([[mx + 12, my - 2, T + 14], [mx + 3, my + 12, T + 10]], { size: 1.3, tone: "hi" }));
  sc.add(mx - 20, my - 20, T + 4, cyl(mx - 20, my - 20, 3.6, T + 4, 52, { tone: "mid" }) + box(mx - 22, my - 22, 24, 7, T + 50, 6, { tone: "mid" }) + cyl(mx, my - 18, 4.6, T + 32, 18, { tone: "hi" }) + k.lineSvg(k.knurl(mx, my - 18, 4.6, T + 40, T + 46, 24, P), { tone: "lo" }));
};

// 08 Internal evaluations: an inspection bench. A tall threshold gauge decides.
BUILD.s08 = (sc, { cx, cy }) => {
  // the threshold column: a scale with a red line and a level creeping towards it
  const tx = cx + 70, ty = cy - 90;
  const ticks = Array.from({ length: 22 }, (_, i) => pth([[tx, ty + 30, T + 8 + i * 4.8], [tx + (i % 5 === 0 ? 12 : 6), ty + 30, T + 8 + i * 4.8]])).join("");
  sc.add(tx + 15, ty + 15, T, box(tx, ty, 30, 30, T, 116, { tone: "mid", bevel: 0.6 }) + k.lineSvg(ticks, { tone: "lo" }) + box(tx + 16, ty + 29, 8, 1.4, T + 8, 76, { tone: "hi", lit: true, crease: "none", cls: "level" }) + line([[tx, ty + 30.5, T + 96], [tx + 30, ty + 30.5, T + 96]], { tone: "red", cls: "threshold" }) + line([[tx + 30.5, ty, T + 96], [tx + 30.5, ty + 30, T + 96]], { tone: "red", cls: "threshold" }));
  // benchmark shelf
  const sx = cx - 120, sy = cy - 124;
  const shelf = [box(sx, sy, 76, 22, T, 50, { tone: "lo", bevel: 0.4 })];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) shelf.push(box(sx + 3 + c * 9, sy + 14, 7, 8, T + 4 + r * 11.6, 9, { tone: (r * 8 + c) % 7 === 3 ? "hi" : "mid", r: 0.4 }));
  sc.add(sx + 38, sy + 11, T, shelf.join(""));
  // test bench with three dial gauges, beside the line
  const tb = cy + 50;
  sc.add(cx + 30, tb + 15, T, box(cx - 10, tb, 120, 30, T, 14, { tone: "mid", bevel: 0.6 }) + dialGauge(cx + 12, tb + 15, T + 14, 11, 0.18) + dialGauge(cx + 50, tb + 15, T + 14, 11, 0.45) + dialGauge(cx + 88, tb + 15, T + 14, 11, 0.71));
  // dangerous-capability glovebox
  const gx = cx - 120, gy = cy + 40;
  const port = (ox) => pth(Array.from({ length: 25 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [gx + ox + Math.cos(a) * 5, gy + 36, T + 18 + Math.sin(a) * 5]; }), true);
  sc.add(gx + 35, gy + 18, T, box(gx, gy, 70, 36, T, 34, { tone: "mid", bevel: 1 }) + k.lineSvg(port(22) + port(48), { tone: "hi" }));
  sc.add(cx + 118, cy + 92, T, person(cx + 118, cy + 92, T));
};

// 09 External testing: a sealed glass chamber with outside testers at the glove ports.
BUILD.s09 = (sc, { cx, cy }) => {
  const rx = cx - 62, ry = cy - 46, rw = 124, rd = 92, rh = 62;
  // far walls are solid, near walls are glass: just their frame
  sc.add(rx, ry, T, box(rx, ry, rw, 3, T, rh, { tone: "lo", bevel: 0.4 }) + box(rx - 1.5, ry - 1.5, 3, 3, T, rh, { tone: "mid", r: 0.5 }));
  sc.add(cx, cy, T, box(cx - 16, cy - 16, 32, 32, T, 24, { tone: "hi", lit: true, bevel: 0.8 }));
  const port = (ox) => pth(Array.from({ length: 25 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [rx + ox + Math.cos(a) * 6, ry + rd, T + 26 + Math.sin(a) * 6]; }), true);
  const frame = [[rx, ry + rd], [rx + rw, ry + rd], [rx + rw, ry]].map(([x, y]) => box(x - 1.5, y - 1.5, 3, 3, T, rh, { tone: "mid", r: 0.5 })).join("");
  sc.add(cx, ry + rd, T + 20, frame + `<path class="glass" d="${pth([[rx, ry + rd, T], [rx + rw, ry + rd, T], [rx + rw, ry + rd, T + rh], [rx, ry + rd, T + rh]], true)}"/>` + `<path class="glass" d="${pth([[rx + rw, ry, T], [rx + rw, ry + rd, T], [rx + rw, ry + rd, T + rh], [rx + rw, ry, T + rh]], true)}"/>` + line([[rx, ry, T + rh], [rx + rw, ry, T + rh], [rx + rw, ry + rd, T + rh], [rx, ry + rd, T + rh], [rx, ry, T + rh]], { tone: "mid" }) + k.lineSvg(port(30) + port(62) + port(94), { tone: "hi" }));
  for (const dx of [30, 62, 94]) sc.add(rx + dx, ry + rd + 16, T, person(rx + dx, ry + rd + 16, T));
  desk(sc, cx - 80, cy - 100, T, { two: true });
  for (let i = 0; i < 5; i++) sc.add(cx + 80, cy - 100, T + i, box(cx + 70, cy - 108, 20, 14, T + i * 0.8, 0.7, { tone: i === 4 ? "hi" : "lo", crease: "none" }));
};

// 10 Release decision: a barrier across the line with three sign-off lamps.
BUILD.s10 = (sc, { cx, cy }) => {
  sc.add(cx, cy - 46, T, box(cx - 8, cy - 58, 16, 12, T, 66, { tone: "mid", bevel: 0.5 }));
  sc.add(cx, cy + 50, T, box(cx - 8, cy + 44, 16, 12, T, 66, { tone: "mid", bevel: 0.5 }));
  sc.add(cx + 1, cy + 1, T + 66, box(cx - 10, cy - 60, 20, 118, T + 66, 12, { tone: "hi", bevel: 0.6 }) + [-30, 0, 30].map((dy, i) => cyl(cx, cy + dy, 5.5, T + 78, 6, { tone: "hi", cls: `lamp lamp${i}` })).join(""));
  sc.add(cx + 14, cy, T + 24, box(cx + 8, cy - 44, 5, 88, T + 26, 4, { tone: "hi", cls: "barrier" }));
  // boardroom
  const tx = cx - 60, ty = cy - 118;
  sc.add(tx + 50, ty + 14, T, k.solidSvg(k.slabOf({ x: tx, y: ty, w: 100, d: 28, r: 13 }, T + 9, 2, P, 8, 0.6), { tone: "mid", crease: "faint" }) + [[tx + 16, ty + 8], [tx + 84, ty + 8], [tx + 16, ty + 20], [tx + 84, ty + 20]].map(([x, y]) => box(x - 1, y - 1, 2, 2, T, 9, { tone: "lo", crease: "none", r: 0.4 })).join(""));
  for (const dx of [20, 50, 80]) sc.add(tx + dx, ty + 40, T, person(tx + dx, ty + 40, T, { seated: true }));
  // the system card: a thick stack of pages
  for (let i = 0; i < 10; i++) sc.add(cx + 70, cy + 80, T + i, box(cx + 58, cy + 70, 24, 18, T + i * 0.9, 0.8, { tone: i === 9 ? "hi" : "lo", crease: "none", lit: i === 9 }));
};

// 11 Deploy & serve: inference racks and a loading dock that ships to users.
BUILD.s11 = (sc, { cx, cy }) => {
  // the dock canopy where the line leaves the building
  const dx0 = cx - 176;
  sc.add(dx0 + 22, cy, T, [[0, -36], [0, 32], [40, -36], [40, 32]].map(([ox, oy]) => box(dx0 + ox, cy + oy, 4, 4, T, 52, { tone: "mid", r: 0.5 })).join(""));
  sc.add(dx0 + 22, cy, T + 54, box(dx0 - 4, cy - 42, 52, 84, T + 52, 5, { tone: "hi", bevel: 0.8 }));
  // distillation: a big block pressed into a small one
  const ddx = cx + 70, ddy = cy - 112;
  sc.add(ddx, ddy + 20, T, box(ddx - 10, ddy, 40, 40, T, 40, { tone: "hi", bevel: 0.8 }) + box(ddx + 40, ddy + 12, 16, 16, T, 16, { tone: "hi", lit: true, bevel: 0.6 }) + line([[ddx + 30, ddy + 20, T + 20], [ddx + 40, ddy + 20, T + 8]], { tone: "mid" }));
  desk(sc, cx - 80, cy - 105, T, { two: true });
  desk(sc, cx - 35, cy - 105, T);
  // inference racks: two long rows in front of the line
  for (const ry of [cy + 36, cy + 76]) for (let i = 0; i < 17; i++) {
    const x = cx - 120 + i * 15;
    sc.add(x + 7, ry + 8, T, rack(x, ry, 14, 18, T, 36, { pulse: (i + ry) % 3 === 0 }));
  }
  sc.add(cx, cy, T, cyl(cx, cy, 16, T, 16, { tone: "hi", bevel: 0.6 }) + k.lineSvg(k.ring(cx, cy, 11, T + 16, P, 32), { tone: "lo" }));
};

// ---------- islands ----------
const IBUILD = {};
IBUILD.web = (sc, { cx, cy }) => {
  // the web as a city of servers of every height
  const towers = [[-100, -100, 34, 58], [-60, -104, 26, 92], [-26, -100, 30, 40], [12, -104, 22, 70], [44, -98, 36, 50], [-104, -58, 28, 36], [-66, -62, 32, 66], [40, -54, 30, 82], [76, -60, 22, 44], [-102, 30, 30, 50], [-64, 40, 24, 30], [40, 40, 34, 60], [80, 34, 20, 38], [-100, 72, 26, 26], [44, 82, 30, 34], [82, 78, 24, 52]];
  towers.forEach(([dx, dy, s, h], i) => {
    const x = cx + dx, y = cy + dy;
    const win = [];
    for (let zz = 6; zz < h - 4; zz += 6) for (let u = 4; u < s - 3; u += 5) { win.push([x + u, y + s, zz]); win.push([x + s, y + u, zz]); }
    sc.add(x + s / 2, y + s / 2, 0, box(x, y, s, s, 0, h, { tone: i % 3 ? "mid" : "hi", bevel: 0.6 }) + dots(win, { size: 0.6, tone: "lo" }));
  });
  mast(sc, cx - 20, cy - 30, 0, 110, 12);
};
IBUILD.brokers = (sc, { cx, cy }) => {
  const wx = cx - 110, wy = cy - 110;
  const ribs = [];
  for (let i = 6; i < 160; i += 8) ribs.push(k.lineOnTop([wx + i, wy + 3], [wx + i, wy + 77], 46, P));
  const doors = [];
  for (const dx of [20, 62, 104]) { doors.push(pth([[wx + dx, wy + 80, 0], [wx + dx, wy + 80, 30], [wx + dx + 30, wy + 80, 30], [wx + dx + 30, wy + 80, 0]])); for (let z = 4; z < 30; z += 4) doors.push(pth([[wx + dx, wy + 80, z], [wx + dx + 30, wy + 80, z]])); }
  sc.add(wx + 80, wy + 40, 0, box(wx, wy, 160, 80, 0, 46, { tone: "mid", bevel: 1 }) + k.lineSvg(ribs.join(""), { tone: "faint" }) + k.lineSvg(doors.join(""), { tone: "lo" }));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let lv = 0; lv < 1 + ((r + c) % 2); lv++) sc.add(cx - 100 + c * 26 + 10, cy + 10 + r * 26 + 10, lv * 16, crate(cx - 100 + c * 26, cy + 10 + r * 26, lv * 16.4, 20, { tone: lv ? "hi" : "mid" }));
  sc.add(cx + 70, cy + 60, 0, person(cx + 70, cy + 60, 0));
};
// The chip supply chain as its most recognisable machine: a lithography scanner
// printing a wafer, finished accelerators crated beside it.
IBUILD.chips = (sc, { cx, cy }) => {
  const wx = cx - 40, wy = cy - 20; // wafer centre
  sc.add(cx - 20, cy - 20, 0, box(cx - 100, cy - 70, 160, 100, 0, 10, { tone: "mid", bevel: 0.8 }));
  // wafer stage and wafer, gridded with dies
  sc.add(wx, wy, 10, box(wx - 28, wy - 28, 56, 56, 10, 6, { tone: "lo", bevel: 0.5 }) + cyl(wx, wy, 22, 16, 1.4, { tone: "hi", lit: true, steps: 56 }) + (() => { const g = []; for (let i = -18; i <= 18; i += 4.5) { const h = Math.sqrt(484 - i * i) - 1; g.push(k.lineOnTop([wx + i, wy - h], [wx + i, wy + h], 17.5, P)); g.push(k.lineOnTop([wx - h, wy + i], [wx + h, wy + i], 17.5, P)); } return k.lineSvg(g.join(""), { tone: "faint" }); })());
  // the projection column hanging over the wafer, inside a frame
  const F = G.frameAlong([wx, wy, 32], [0, 0, 1]);
  const col = k.solidSvg(G.solidOf([[0, 5, 0], [6, 9, 1], [18, 13, 0], [40, 15, 0], [46, 19, 0], [64, 19, 0]], F, P), { tone: "mid", crease: "none" });
  const posts = [[-26, -26], [26, -26], [-26, 26], [26, 26]];
  sc.add(wx - 26, wy - 26, 10, box(wx - 28, wy - 28, 3, 3, 16, 86, { tone: "lo", crease: "none", r: 0.4 }));
  sc.add(wx, wy, 34, `<path class="iso-line beam" data-tone="lit" d="${pth([[wx, wy, 32], [wx, wy, 17.5]])}"/>` + dots([[wx, wy, 17.6]], { size: 2.2, tone: "hi", pulse: true }) + col + box(wx - 30, wy - 30, 60, 60, 102, 6, { tone: "hi", bevel: 0.6 }) + k.lineSvg(G.arcOf(F, 24, 13.5, P) + G.arcOf(F, 52, 19.5, P), { tone: "faint" }));
  sc.add(wx + 26, wy + 26, 12, posts.slice(1).map(([dx, dy]) => box(wx + dx - 1.5, wy + dy - 1.5, 3, 3, 16, 86, { tone: "lo", crease: "none", r: 0.4 })).join(""));
  // the light source, and the beam tube to the top of the column
  const lx = cx + 20, ly = cy - 60;
  sc.add(lx + 30, ly + 25, 10, box(lx, ly, 60, 50, 10, 52, { tone: "hi", bevel: 1 }) + k.lineSvg(Array.from({ length: 6 }, (_, i) => pth([[lx + 6 + i * 9, ly + 50, 16], [lx + 6 + i * 9, ly + 50, 56]])).join(""), { tone: "faint" }) + cyl(lx + 44, ly + 16, 6, 62, 18, { tone: "mid" }));
  sc.add(lx - 10, wy, 96, box(wx + 30, wy - 4, lx - wx - 30, 8, 92, 8, { tone: "mid", crease: "none", r: 1 }));
  // a stack of finished wafers and crates of accelerators
  sc.add(cx - 80, cy + 75, 0, box(cx - 104, cy + 54, 48, 44, 0, 10, { tone: "mid", bevel: 0.6 }) + Array.from({ length: 7 }, (_, i) => cyl(cx - 80, cy + 76, 18, 10 + i * 2.6, 1.2, { tone: i === 6 ? "hi" : "mid", steps: 44 })).join(""));
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x = cx + 10 + c * 30, y = cy + 50 + r * 34;
    sc.add(x + 12, y + 14, 0, box(x, y, 24, 28, 0, 14, { tone: "hi", bevel: 0.5 }) + k.lineSvg(Array.from({ length: 6 }, (_, i) => k.lineOnTop([x + 3 + i * 3.6, y + 3], [x + 3 + i * 3.6, y + 25], 14, P)).join(""), { tone: "lo" }));
  }
};
IBUILD.power = (sc, { cx, cy }) => {
  coolingTower(sc, cx - 70, cy - 60, 0, 44, 124);
  coolingTower(sc, cx + 30, cy - 70, 0, 40, 112);
  sc.add(cx - 40, cy + 60, 0, box(cx - 110, cy + 30, 120, 56, 0, 38, { tone: "mid", bevel: 1 }) + k.lineSvg(Array.from({ length: 8 }, (_, i) => k.lineOnTop([cx - 104 + i * 15, cy + 34], [cx - 104 + i * 15, cy + 82], 38, P)).join(""), { tone: "faint" }) + cyl(cx - 80, cy + 50, 8, 38, 30, { tone: "mid" }));
  transformer(sc, cx + 40, cy + 40, 0);
  transformer(sc, cx + 40, cy + 74, 0);
  mast(sc, cx + 90, cy + 10, 0, 90, 10);
};
IBUILD.annotators = (sc, { cx, cy }) => {
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) desk(sc, cx - 90 + c * 50, cy - 100 + r * 60, 0, { papers: (r + c) % 2 === 0, two: (r * 4 + c) % 5 === 2 });
  sc.add(cx - 110, cy - 120, 0, box(cx - 120, cy - 120, 240, 4, 0, 22, { tone: "lo" }) + box(cx - 120, cy - 120, 4, 160, 0, 22, { tone: "lo" }));
};
IBUILD.users = (sc, { cx, cy }) => {
  const blocks = [[-110, -110, 40, 40, 30], [-60, -110, 30, 50, 50], [-110, -60, 36, 36, 22], [40, -110, 60, 36, 70], [40, -64, 30, 30, 36], [-110, 40, 46, 30, 26], [60, 50, 40, 50, 44], [-40, 70, 36, 36, 30]];
  for (const [dx, dy, w, d, h] of blocks) {
    const x = cx + dx, y = cy + dy;
    const win = [];
    for (let zz = 6; zz < h - 4; zz += 7) { for (let u = 5; u < w - 3; u += 7) win.push([x + u, y + d, zz]); for (let u = 5; u < d - 3; u += 7) win.push([x + w, y + u, zz]); }
    sc.add(x + w / 2, y + d / 2, 0, box(x, y, w, d, 0, h, { tone: "mid", bevel: 0.8 }) + dots(win, { size: 0.7, tone: "lo" }));
  }
  const crowd = [[-20, -10], [0, 4], [16, -16], [-30, 20], [26, 14], [8, 30], [-8, -30]];
  for (const [dx, dy] of crowd) sc.add(cx + dx, cy + dy, 0, person(cx + dx, cy + dy, 0));
};
IBUILD.evaluators = (sc, { cx, cy }) => {
  sc.add(cx - 110, cy - 120, 0, box(cx - 120, cy - 120, 240, 4, 0, 30, { tone: "lo" }) + box(cx - 120, cy - 120, 4, 120, 0, 30, { tone: "lo" }));
  for (const [dx, dy] of [[-80, -80], [-30, -80], [20, -80], [-80, -20], [-30, -20]]) desk(sc, cx + dx, cy + dy, 0, { two: dx === -30 });
  for (let i = 0; i < 3; i++) sc.add(cx + 60 + i * 16 + 7, cy - 90, 0, rack(cx + 60 + i * 16, cy - 100, 14, 18, 0, 40, { pulse: i === 1 }));
  sc.add(cx + 60, cy + 50, 0, box(cx + 20, cy + 30, 90, 36, 0, 12, { tone: "mid", bevel: 0.6 }) + dialGauge(cx + 40, cy + 48, 12, 10, 0.3) + dialGauge(cx + 80, cy + 48, 12, 10, 0.55));
  sc.add(cx + 60, cy + 90, 0, person(cx + 60, cy + 92, 0));
  sc.add(cx - 50, cy + 70, 0, person(cx - 50, cy + 70, 0));
};
IBUILD.gov = (sc, { cx, cy }) => {
  const x0 = cx - 100, y0 = cy - 80;
  const st = [];
  for (let i = 0; i < 3; i++) st.push(box(x0 - 12 + i * 4, y0 - 12 + i * 4, 224 - i * 8, 144 - i * 8, i * 4, 4, { tone: "mid", bevel: 0.4 }));
  sc.add(cx, cy, -2, st.join("") + box(x0 + 10, y0 + 10, 180, 60, 12, 54, { tone: "mid", bevel: 0.6 }));
  for (let i = 0; i < 6; i++) sc.add(x0 + 18 + i * 33, y0 + 100, 12, cyl(x0 + 18 + i * 33, y0 + 100, 5, 12, 50, { tone: "hi" }));
  sc.add(cx, cy + 10, 62, box(x0, y0, 200, 112, 62, 10, { tone: "hi", bevel: 0.8 }) + box(x0 + 10, y0 + 10, 180, 92, 72, 6, { tone: "mid", bevel: 0.6 }) + line([[x0 + 200, y0 + 6, 67], [x0 + 200, y0 + 106, 67]], { tone: "faint" }));
  sc.add(cx + 110, cy + 110, 0, cyl(cx + 110, cy + 110, 1.4, 0, 110, { tone: "mid", steps: 10 }) + box(cx + 110, cy + 109.5, 30, 1, 88, 20, { tone: "hi", lit: true, crease: "none" }));
};

// ---------- assemble ----------
const ground = [];
// no floor slab: stations stand on their own plates, grouped on section pads
const SECTIONS = [
  { name: "TRAINING DATA", tag: "Sources", sub: "WEB · LICENSED", ids: ["web", "brokers"], loop: { side: "l" } },
  { name: "INFRASTRUCTURE", tag: "Inputs", sub: "CHIPS · POWER", ids: ["chips", "power"] },
  { name: "PRETRAINING", tag: "01–03", sub: "01–03 · DATA, DESIGN, THE TRAINING RUN", ids: ["s01", "s02", "s03"], loop: { end: true } },
  { name: "POST-TRAINING", tag: "04–07", sub: "04–07 · TURNING IT INTO AN ASSISTANT", ids: ["s04", "s05", "s06", "s07"] },
  { name: "EVALUATION", tag: "08–09", sub: "08–09 · INSIDE AND OUT", ids: ["s08", "s09"], loop: { end: true } },
  { name: "RELEASE & DEPLOYMENT", tag: "10–11", sub: "10–11 · THE DECISION, THEN SERVING IT", ids: ["s10", "s11"], loop: { side: "l" } },
];
const SEC_SIZE = 60, SEC_SUB = 22, PAD_M = 30;
// name baseline, caption baseline and band depth, from the band's top edge
const bandRows = (size) => { const ny = 10 + size * 0.74, cy = ny + size * 0.22 + 10 + SEC_SUB * 0.74; return { ny, cy, band: r1(cy + SEC_SUB * 0.22 + 16) }; };
// A district pad: a low slab around a section's plates, its name painted large across a front band.
const SEC_AT = { loop: {}, line: {} };
function sectionPad(sec, plans, view, o = {}) {
  const x0 = Math.min(...plans.map((p) => p.x)) - PAD_M, y0 = Math.min(...plans.map((p) => p.y)) - PAD_M;
  const x1 = Math.max(...plans.map((p) => p.x + p.w)) + PAD_M, yb = Math.max(...plans.map((p) => p.y + p.d)) + PAD_M;
  const lx = o.lx ?? x0 + PAD_M;
  const avail = o.end ? x1 - PAD_M - x0 - PAD_M : x1 - PAD_M - lx;
  const size = r1(Math.min(SEC_SIZE, Math.min(avail, o.maxW ?? Infinity) / (sec.name.length * SPACED)));
  const { ny: nyo, cy: cyo, band } = bandRows(size);
  const pad = { x: x0, y: y0, w: x1 - x0, d: yb + band - y0, r: 22 };
  // the optional floating label sits off a corner of the pad, in open ground
  const left = view === "line" || o.side === "l";
  SEC_AT[view][sec.name] = [...at(left ? [pad.x, pad.y + pad.d, 0] : [pad.x + pad.w, pad.y, 0]).map(r1), left ? "l" : "r"];
  const tx = o.end ? x1 - PAD_M : lx;
  const anchor = o.end ? "end" : "start";
  const ny = r1(yb + nyo), cy2 = r1(yb + cyo);
  AUDIT.pads.push({ view, name: sec.name, ids: sec.ids, rect: pad });
  AUDIT.texts.push({ kind: "section", view, name: sec.name, box: textBox(tx, ny, sec.name, size, anchor, SPACED), str: sec.name, pad });
  AUDIT.texts.push({ kind: "caption", view, name: sec.name, box: textBox(tx, cy2, sec.sub, SEC_SUB, anchor, SPACED), str: sec.sub, pad });
  return `<g class="district">${k.solidSvg(k.slabOf(pad, -4, 4, P, 8, 0.8), { tone: "faint", crease: "none", className: "pad" })}`
    + k.lineSvg(k.planOutline(k.insetPlan(pad, 8), 0, P) + k.lineOnTop([x0 + 18, yb], [x1 - 18, yb], 0, P), { tone: "lo" })
    + text(tx, ny, 0, sec.name, { size, tone: "hi", anchor })
    + text(tx, cy2, 0, sec.sub, { size: SEC_SUB, tone: "mid", anchor }) + `</g>`;
}
for (const sec of SECTIONS) ground.push(sectionPad(sec, sec.ids.map((id) => planOf(ZONES[id] || ISLANDS[id])), "loop", sec.loop));

// conduits: energy (red), hardware (amber), people (green); data travels on belts
const conduits = [];
// power: a spine from the utility, three feeders in the gaps between sections, a branch to each plate
conduits.push(conduit([[1850, 1100], [1700, 1100]], "energy", { heavy: true, party: "power" }));
conduits.push(conduit([[1700, 410], [1700, 1758]], "energy", { heavy: true, party: "power" }));
for (const [y, x0] of [[410, 400], [1138, 120], [1758, 120]]) conduits.push(conduit([[1700, y], [x0, y]], "energy", { party: "power" }));
for (const [x, y0, y1, heavy] of [[450, 410, 366], [830, 410, 366], [1350, 410, 336], [600, 410, 460], [480, 1138, 976, true], [420, 1138, 1190], [780, 1138, 1190], [1170, 1138, 1190], [1560, 1138, 1190], [420, 1758, 1820, true], [890, 1758, 1820], [1220, 1758, 1820], [1560, 1758, 1820]]) conduits.push(conduit([[x, y0], [x, y1]], "energy", { heavy }));
conduits.push(conduit([[1850, 436], [860, 436], [860, 460]], "hardware", { heavy: true, party: "chips" }));
conduits.push(conduit([[1300, 436], [1300, 336]], "hardware"));
conduits.push(conduit([[1850, 520], [1740, 520], [1740, 1776], [260, 1776], [260, 1820]], "hardware", { party: "chips" }));
conduits.push(conduit([[70, 1400], [130, 1400], [130, 1740], [1400, 1740], [1400, 1586]], "people", { party: "annotators" }));
for (const x of [810, 1150]) conduits.push(conduit([[x, 1740], [x, 1586]], "people"));
conduits.push(conduit([[1130, 2570], [1130, 2216]], "people", { party: "evaluators" }));
conduits.push(conduit([[935, 2570], [935, 2100], [920, 2100]], "people", { party: "gov" }));
conduits.push(conduit([[935, 2370], [1060, 2370], [1060, 2216]], "people"));

// belts between zones: none leaves a plate through its front apron
const ROUTES = {
  data: [[-40, 120], [640, 120], [1260, 120], [1420, 120], [1420, 610], [800, 610]],
  licensed: [[40, -330], [355, -330], [355, 120]],
  model: [[800, 610], [330, 610], [330, 1340], [690, 1340], [1080, 1340], [1470, 1340], [1660, 1340], [1660, 1970], [1470, 1970], [1130, 1970], [800, 1970], [330, 1970], [-110, 1970]],
  human: [[-60, 1340], [330, 1340]],
  feedback: [[330, 1970], [110, 1970], [110, 1340], [330, 1340]],
};
const belts = [];
const seen = new Set();
for (const [name, pts] of Object.entries(ROUTES)) for (let i = 0; i < pts.length - 1; i++) {
  const [a, b] = [pts[i], pts[i + 1]];
  const key = [a, b].map(String).sort().join("|");
  if (seen.has(key)) continue;
  seen.add(key);
  belts.push(beltSvg(a[0], a[1], b[0], b[1], 0, { cls: name === "feedback" ? "belt fb" : "belt" }));
}

// ---------- the straight line ----------
// The same stations laid end to end along x, belts on y = 0. Outside parties sit
// beside the stations they serve: suppliers behind the line, people in front of it.
const LINE_AT = {};
const GAP = 110;
{
  let x = 0, prevW = 0;
  for (const [id, z] of Object.entries(ZONES)) { if (prevW) x += prevW / 2 + GAP + z.w / 2; LINE_AT[id] = [x, z.cy - z.by]; prevW = z.w; }
}
const LX = (id) => LINE_AT[id][0];
const LB = (id) => [LX(id), 0];
const BACK = -700, FRONT = 700;
const INTAKE = LX("s01") - 285;
// suppliers and annotators behind the line (their belts come in from the back), testers in front
Object.assign(LINE_AT, {
  web: [LX("s01") - ZONES.s01.w / 2 - 330, 0], brokers: [LX("s01") - ZONES.s01.w / 2 - 320, BACK], chips: [LX("s03") - 150, BACK], power: [LX("s02"), BACK],
  annotators: [LX("s04") - 260, BACK], evaluators: [LX("s09"), FRONT], gov: [LX("s10"), FRONT], users: [LX("s11") + ZONES.s11.w / 2 + 250, 0],
});
const LINE_LANES = { s01: ["w", "e"], s03: [], s04: ["w", "e", "n"], s11: ["w", "e", "n"], web: ["e"], brokers: ["e"], annotators: ["e"], users: ["w"], chips: [], power: [], evaluators: [], gov: [] };
const linePlan = (id) => { const z = ZONES[id] || ISLANDS[id]; const p = planOf(z); return { ...p, x: p.x + LINE_AT[id][0] - z.cx, y: p.y + LINE_AT[id][1] - z.cy }; };
const LX0 = LX("s01") - ZONES.s01.w / 2 - 60;
const LFLOOR = { x: LX0, y: -340, w: LX("s11") + ZONES.s11.w / 2 + 60 - LX0, d: 760, r: 26 };
const lground = [];
// the same section pads, laid along the line
// names start clear of the conduits that cross their bands
const LINE_SEC = { "RELEASE & DEPLOYMENT": { lx: LX("s10") - 80 }, "INFRASTRUCTURE": { lx: LX("s03") - 550, maxW: 380 } };
for (const sec of SECTIONS) lground.push(sectionPad(sec, sec.ids.map(linePlan), "line", LINE_SEC[sec.name] ?? {}));
const LROUTES = {
  data: [LINE_AT.web, ...["s01", "s02", "s03"].map(LB)],
  licensed: [LINE_AT.brokers, [INTAKE, BACK], [INTAKE, 0]],
  model: [...["s03", "s04", "s05", "s06", "s07", "s08", "s09", "s10", "s11"].map(LB), LINE_AT.users],
  human: [LINE_AT.annotators, [LX("s04"), BACK], [LX("s04"), -260], LB("s04")],
  feedback: [LB("s11"), [LX("s11"), -260], [LX("s04"), -260], LB("s04")],
};
const lbelts = [];
{
  const seenL = new Set();
  for (const [name, pts] of Object.entries(LROUTES)) for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const key = [a, b].map(String).sort().join("|");
    if (seenL.has(key)) continue;
    seenL.add(key);
    lbelts.push(beltSvg(a[0], a[1], b[0], b[1], 0, { cls: name === "feedback" ? "belt fb" : "belt" }));
  }
}
const lconduits = [];
AUD_VIEW = "line";
{
  const xa = LX0 + 40, xb = LX("s11") + ZONES.s11.w / 2 + 20;
  const isleFront = BACK + 130 + APRON.island;
  lconduits.push(conduit([[LINE_AT.power[0], isleFront], [LINE_AT.power[0], -220]], "energy", { heavy: true, party: "power" }));
  lconduits.push(conduit([[xa, -220], [xb, -220]], "energy", { heavy: true, party: "power" }));
  for (const id of Object.keys(ZONES)) {
    if (id === "s03") for (const dx of [-200, 200]) lconduits.push(conduit([[LX(id) + dx, -220], [LX(id) + dx, -150]], "energy", { heavy: true }));
    else lconduits.push(conduit([[LX(id) + 90, -220], [LX(id) + 90, -150]], "energy", { heavy: id === "s11" }));
  }
  lconduits.push(conduit([[LINE_AT.chips[0], isleFront], [LINE_AT.chips[0], -150]], "hardware", { heavy: true, party: "chips" }));
  lconduits.push(conduit([[LX("s02") - 60, -150], [LX("s02") - 60, -300], [LX("s11") - 90, -300], [LX("s11") - 90, -150]], "hardware", { party: "chips" }));
  lconduits.push(conduit([[LX("s04") - 200, isleFront], [LX("s04") - 200, -320], [LX("s07") - 90, -320], [LX("s07") - 90, -150]], "people", { party: "annotators" }));
  for (const id of ["s05", "s06"]) lconduits.push(conduit([[LX(id) - 90, -320], [LX(id) - 90, -150]], "people"));
  const front = 150 + APRON.station;
  lconduits.push(conduit([[LX("s09") - 40, FRONT - 130], [LX("s09") - 40, front]], "people", { party: "evaluators" }));
  lconduits.push(conduit([[LX("s10") - 105, FRONT - 130], [LX("s10") - 105, front]], "people", { party: "gov" }));
}

const zoneSvg = [];
const ZONE_META = {};
const allZones = [...Object.entries(ZONES).map(([id, z]) => [id, z, "station"]), ...Object.entries(ISLANDS).map(([id, z]) => [id, z, "island"])];
for (const [id, z, kind] of allZones) {
  const sc = new Scene();
  (kind === "station" ? BUILD : IBUILD)[id](sc, z);
  const base = kind === "station" ? stationBase(id, z) : islandBase(id, z);
  const pk = `<g class="pk" data-zone="${id}"></g>`;
  const lanes = `<g class="v-loop">${lanesOf(z)}</g><g class="v-line">${lanesOf({ ...z, lanes: LINE_LANES[id] ?? ["w", "e"] })}</g>`;
  // hover outline: the plate's own silhouette, stroked under the plate so only its outer edge shows
  const hl = kind === "station" ? k.haloOf(planOf(z), 0, T, P) : k.haloOf({ ...planOf(z), r: 18 }, -14, 14, P);
  const floor = sc.floorSvg();
  const inner = `<path class="hl" d="${hl}"/>` + (z.pkLast ? `${base}${floor}${lanes}${sc}${pk}` : `${base}${floor}${lanes}${pk}${sc}`);
  const party = kind === "island" ? ` data-party="${id}"` : "";
  zoneSvg.push({ key: dep(z.cx, z.cy, 0), svg: `<g class="zone ${kind === "station" ? "st" : "isl"}" data-id="${id}"${party} tabindex="-1">${inner}</g>` });
  // camera target and label anchor
  const plan = planOf(z);
  const tall = kind === "station" ? 100 : 130;
  const pts = [...k.boxCorners(plan, z.top - 14, z.top), ...k.boxCorners(plan, z.top + tall, z.top + tall)].map(at);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [ax, ay] = at([plan.x, plan.y, z.top + (kind === "station" ? 70 : 100)]);
  const [lx, ly] = LINE_AT[id];
  ZONE_META[id] = { kind, box: [r1(Math.min(...xs)), r1(Math.min(...ys)), r1(Math.max(...xs) - Math.min(...xs)), r1(Math.max(...ys) - Math.min(...ys))], label: [r1(ax), r1(ay)], plan: [plan.x, plan.y, plan.w, plan.d], top: z.top, lift: z.lift, off: [lx - z.cx, ly - z.cy] };
}
zoneSvg.sort((a, b) => a.key - b.key);
const zoneOf = (id) => ZONES[id] || ISLANDS[id];
const depthOrder = (pos) => allZones.map(([id]) => id).sort((a, b) => dep(...pos(a), 0) - dep(...pos(b), 0));

// screen bounds of a set of plans, from slab bottom to the tallest kit
function boundsOf(plans) {
  const pts = plans.flatMap((pl) => [...k.boxCorners(pl, -14, -14), ...k.boxCorners(pl, 150, 150)]).map(at);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - 60, y0 = Math.min(...ys) - 150; // room above for labels
  return [r1(x0), r1(y0), r1(Math.max(...xs) + 60 - x0), r1(Math.max(...ys) + 60 - y0)];
}
const VIEWS = {
  loop: { bounds: boundsOf(allZones.map(([, z]) => planOf(z))), order: depthOrder((id) => [zoneOf(id).cx, zoneOf(id).cy]), routes: ROUTES },
  line: { bounds: boundsOf([LFLOOR, ...Object.keys(ISLANDS).map((id) => ({ x: LINE_AT[id][0] - 130, y: LINE_AT[id][1] - 130, w: 260, d: 260 }))]), order: depthOrder((id) => [LINE_AT[id][0], LINE_AT[id][1]]), routes: LROUTES },
};

const svg = `<svg class="iso-svg map-svg" id="map-${PROJ}" data-proj="${PROJ}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="An isometric campus where a trillion-parameter language model is made. Raw data enters a data refinery from the open internet and data brokers, passes a design office into a hall of GPU racks for pretraining, then through fine-tuning, a reward model, reinforcement learning, safety, evaluation, external testing and a release gate to deployment and users. Islands around the campus hold the outside parties: chip suppliers, utilities, annotators, users, independent evaluators and governments.">
<g class="v-loop"><g class="ground">${ground.join("")}</g>
<g class="conduits">${conduits.join("")}</g>
<g class="belts">${belts.join("")}</g></g>
<g class="v-line"><g class="ground">${lground.join("")}</g>
<g class="conduits">${lconduits.join("")}</g>
<g class="belts">${lbelts.join("")}</g></g>
<g class="pk" data-zone="ground"></g>
<g class="zones">${zoneSvg.map((z) => z.svg).join("")}</g>
</svg>`;

// the RL carousel's pods, cloned and spun by the page
const [PX, PY] = [ZONES.s06.cx, ZONES.s06.cy];
const POD = { r: 67, svg: cyl(PX, PY, 10, T + 5, 15, { tone: "hi", bevel: 0.6 }) + k.lineSvg(k.ring(PX, PY, 5.5, T + 20, P, 24), { tone: "lo" }) + dots([[PX, PY, T + 20]], { size: 1.3, tone: "hi" }) };
export { svg, W, H, T };
export const ISLAND_NAMES = Object.fromEntries(Object.entries(ISLANDS).map(([id, z]) => [id, z.name]));
export const SECTION_LIST = SECTIONS.map((sec) => ({ name: sec.name, tag: sec.tag, sub: sec.sub, ids: sec.ids }));
export const DATA_PART = { P, POD, VIEWS, ZONES: ZONE_META, SEC_AT: Object.fromEntries(SECTIONS.map((sec) => [sec.name, { loop: SEC_AT.loop[sec.name], line: SEC_AT.line[sec.name] }])) };
export const AUDIT_WORLD = { ZONES, ISLANDS, ROUTES, LROUTES, LINE_AT, LINE_LANES, planOf, P };
