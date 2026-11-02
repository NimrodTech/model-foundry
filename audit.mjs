// Overlap audit for the Model Foundry layout, in both views (loop and line).
// Checks, on the ground plan: section pads against each other and against
// plates that aren't theirs; painted text against belts, conduits, plates and
// other text; text running past its plate or pad. Then, on screen, text that
// a taller plate in front of it would cover. Run: node audit.mjs
import * as k from "./kit/iso-kit.mjs";

const S = await import("./scene.mjs?proj=iso");
const { AUDIT } = S;
const { ZONES, ISLANDS, ROUTES, LROUTES, LINE_AT, LINE_LANES, planOf, P } = S.AUDIT_WORLD;

const all = { ...ZONES, ...ISLANDS };
const r1 = (n) => Math.round(n);
const hit = (a, b, m = 0) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.d + m && a.y + a.d + m > b.y;
const inside = (a, b, m = 0) => a.x >= b.x - m && a.y >= b.y - m && a.x + a.w <= b.x + b.w + m && a.y + a.d <= b.y + b.d + m;
const segRect = ([a, b], w) => ({ x: Math.min(a[0], b[0]) - w / 2, y: Math.min(a[1], b[1]) - w / 2, w: Math.abs(b[0] - a[0]) + w, d: Math.abs(b[1] - a[1]) + w });
const segs = (pts, w, tag) => pts.slice(1).map((b, i) => ({ r: segRect([pts[i], b], w), tag }));
const fmt = (r) => `[${r1(r.x)},${r1(r.y)} ${r1(r.w)}×${r1(r.d)}]`;

const problems = [];
for (const view of ["loop", "line"]) {
  const off = (id) => (view === "loop" ? [0, 0] : [LINE_AT[id][0] - all[id].cx, LINE_AT[id][1] - all[id].cy]);
  const move = (r, [dx, dy]) => ({ ...r, x: r.x + dx, y: r.y + dy });
  const plans = Object.fromEntries(Object.keys(all).map((id) => [id, move(planOf(all[id]), off(id))]));
  // belts: the routes on the ground, and each zone's own lanes from its centre to its edges
  const lines = [];
  for (const [name, pts] of Object.entries(view === "loop" ? ROUTES : LROUTES)) lines.push(...segs(pts, 18, `belt:${name}`));
  for (const [id, z] of Object.entries(all)) {
    const lanes = view === "loop" ? z.lanes : (LINE_LANES[id] ?? ["w", "e"]);
    const [dx, dy] = off(id);
    const c = [z.cx + dx, z.cy + dy];
    const reach = { e: [c[0] + z.w / 2, c[1]], w: [c[0] - z.w / 2, c[1]], n: [c[0], c[1] - z.d / 2], s: [c[0], c[1] + z.d / 2] };
    for (const l of lanes) lines.push({ r: segRect([c, reach[l]], 18), tag: `lane:${id}.${l}` });
  }
  for (const cd of AUDIT.conds.filter((c) => c.view === view)) lines.push(...segs(cd.points, cd.w, `conduit:${cd.kind}`));
  const texts = AUDIT.texts.filter((t) => t.view === view || (t.kind === "apron")).map((t) => ({ ...t, box: t.kind === "apron" ? move(t.box, off(t.zone)) : t.box }));
  const pads = AUDIT.pads.filter((p) => p.view === view);
  const say = (msg) => problems.push(`${view.padEnd(4)}  ${msg}`);

  // pads: apart from each other, and clear of plates that belong elsewhere
  for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) if (hit(pads[i].rect, pads[j].rect, 20)) say(`pads touch: ${pads[i].name} / ${pads[j].name}`);
  for (const p of pads) for (const [id, pl] of Object.entries(plans)) if (!p.ids.includes(id) && hit(p.rect, pl, 20)) say(`pad ${p.name} runs into plate ${id}`);
  // text: on its own ground, off belts and conduits, apart from other text
  for (const t of texts) {
    const label = t.kind === "apron" ? `${t.zone} "${t.str.trim()}"` : `${t.kind} "${t.str}"`;
    if (t.kind === "apron" && !inside(t.box, plans[t.zone], -8)) say(`${label} runs off its plate ${fmt(t.box)} vs ${fmt(plans[t.zone])}`);
    if (t.kind !== "apron" && !inside(t.box, t.pad, -12)) say(`${label} runs off its pad`);
    for (const ln of lines) if (hit(t.box, ln.r, 3)) say(`${label} is crossed by ${ln.tag}`);
    if (t.kind !== "apron") for (const [id, pl] of Object.entries(plans)) if (hit(t.box, pl, 4)) say(`${label} runs under plate ${id}`);
    for (const u of texts) if (u !== t && u.str < t.str && hit(t.box, u.box, 4)) say(`${label} overlaps text "${u.str.trim()}"`);
  }
  // on screen: a plate in front of a text, with things standing on it, must not cover the text
  const box2 = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) }; };
  // tallest thing standing on each plate, roughly
  const TALL = { s01: 92, s02: 90, s03: 100, s04: 82, s05: 96, s06: 70, s07: 60, s08: 116, s09: 62, s10: 84, s11: 57, web: 110, brokers: 46, chips: 108, power: 124, annotators: 25, users: 70, evaluators: 40, gov: 85 };
  for (const t of texts) {
    const b = t.box;
    // test the text a slice at a time, each against plates entirely in front of that slice
    for (let sx = b.x; sx < b.x + b.w; sx += 30) {
      const sl = { x: sx, y: b.y, w: Math.min(30, b.x + b.w - sx), d: b.d };
      const tb = box2(k.boxCorners(sl, 0, 0).map((p) => k.iso(p, P)));
      const tDepth = k.depthOf([sl.x + sl.w, sl.y + sl.d, 0], P);
      for (const [id, pl] of Object.entries(plans)) {
        if (id === t.zone) continue;
        const z = all[id];
        const stand = { x: pl.x, y: pl.y, w: pl.w, d: z.d }; // the part with machines on it, not the apron
        if (k.depthOf([stand.x, stand.y, 0], P) <= tDepth) continue; // not in front
        const zb = box2(k.boxCorners(stand, z.top, z.top + TALL[id]).map((p) => k.iso(p, P)));
        if (hit(tb, zb, -2)) { say(`${t.kind === "apron" ? t.zone : t.kind} "${t.str.trim()}" may be hidden behind ${id}`); sx = Infinity; break; }
      }
    }
  }
}
console.log(problems.length ? problems.join("\n") : "no overlaps");
console.log(`${problems.length} problem(s)`);
