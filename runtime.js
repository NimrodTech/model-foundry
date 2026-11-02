(() => {
  const { W, H, T, PROJ, SECTIONS, STATIONS, PARTIES, ISLANDS } = DATA;
  // the drawing exists twice: isometric, and flat (straight down, a floor plan)
  let proj = "iso";
  let { P, VIEWS, ZONES: BASE, POD, SEC_AT } = PROJ.iso;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $(".app");
  let svg = $("#map-iso");
  const wrap = $(".map-wrap");
  const labelsEl = $(".labels");
  const panel = $("#panel");
  const panelHost = $("#panelHost");
  const readout = $("#readout");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = matchMedia("(max-width: 860px)");
  const NS = "http://www.w3.org/2000/svg";
  const byId = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
  const partyById = Object.fromEntries(PARTIES.map((p) => [p.id, p]));
  const order = STATIONS.map((s) => s.id);
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ---------- camera (the kit's projection, inlined) ----------
  const RAD = Math.PI / 180, UNIT = Math.sqrt(1.6);
  let sA, cA, sE, cE, K;
  function setCamera() {
    sA = Math.sin(P.azimuth * RAD); cA = Math.cos(P.azimuth * RAD);
    sE = Math.sin(P.elevation * RAD); cE = Math.cos(P.elevation * RAD);
    K = P.scale * UNIT;
  }
  setCamera();
  const iso = ([x, y, z]) => [P.origin[0] + (x * sA - y * cA) * K, P.origin[1] + ((x * cA + y * sA) * sE - z * cE) * K];
  const shift = ([dx, dy, dz]) => [(dx * sA - dy * cA) * K, ((dx * cA + dy * sA) * sE - dz * cE) * K];
  const f1 = (n) => Math.round(n * 10) / 10;
  const poly = (pts, close) => "M" + pts.map((p) => { const [x, y] = iso(p); return f1(x) + " " + f1(y); }).join("L") + (close ? "Z" : "");

  // ---------- views: the loop (compact campus) and the straight line ----------
  // Both views share the same zone drawings; the line view slides each zone
  // along the floor, so its screen box and label move by the projected offset.
  let view = "loop";
  let ZONES = BASE;
  function zonesFor(v) {
    if (v === "loop") return BASE;
    return Object.fromEntries(Object.entries(BASE).map(([id, z]) => {
      const [sx, sy] = shift([z.off[0], z.off[1], 0]);
      return [id, { ...z, box: [z.box[0] + sx, z.box[1] + sy, z.box[2], z.box[3]], label: [z.label[0] + sx, z.label[1] + sy], plan: [z.plan[0] + z.off[0], z.plan[1] + z.off[1], z.plan[2], z.plan[3]], dx: z.off[0], dy: z.off[1] }];
    }));
  }

  // ---------- view box: pan, zoom, fly ----------
  let full = { x: 0, y: 0, w: W, h: H };
  let vb = { ...full };
  let flight = null;
  const size = () => wrap.getBoundingClientRect();
  function fitFull() {
    const r = size();
    if (r.width < 2 || r.height < 2) return; // hidden or not laid out yet
    const ar = r.width / r.height;
    const [bx, by, bw, bh] = VIEWS[view].bounds;
    let w = bw * 0.96, h = bh * 0.96;
    if (w / h < ar) w = h * ar; else h = w / ar;
    full = { x: bx + (bw - w) / 2, y: by + (bh - h) / 2 + bh * 0.005, w, h };
  }
  function clampVb(v) {
    const minW = full.w / 10, maxW = full.w * 1.15;
    const w = Math.min(maxW, Math.max(minW, v.w));
    const h = w * (full.h / full.w);
    const cx = Math.min(full.x + full.w, Math.max(full.x, v.x + v.w / 2));
    const cy = Math.min(full.y + full.h, Math.max(full.y, v.y + v.h / 2));
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
  function apply() {
    if (![vb.x, vb.y, vb.w, vb.h].every(Number.isFinite)) vb = { ...full };
    svg.setAttribute("viewBox", `${f1(vb.x)} ${f1(vb.y)} ${f1(vb.w)} ${f1(vb.h)}`);
    app.classList.toggle("far", vb.w > full.w * 0.7);
    // close enough to read the nameplates painted on the plates: drop the floating labels
    app.classList.toggle("near", size().width / vb.w > 0.8);
    placeLabels();
  }
  function setVb(v) { vb = clampVb(v); apply(); }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function fly(to, ms = 850) {
    to = clampVb(to);
    if (still.matches) { flight = null; setVb(to); return; }
    flight = { from: { ...vb }, to, t0: performance.now(), ms };
    kick();
  }
  function stepFlight(now) {
    if (!flight) return;
    const t = Math.min(1, (now - flight.t0) / flight.ms);
    const e = ease(t);
    const { from: a, to: b } = flight;
    vb = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
    apply();
    if (t >= 1) flight = null;
  }
  // frame a zone's box, leaving room for the panel on wide screens
  const frameZone = (id, zoomOut = 1) => frameBox(ZONES[id].box, zoomOut);
  function frameBox([bx, by, bw, bh], zoomOut = 1) {
    const r = size();
    const panelW = !narrow.matches && !panel.hidden ? Math.min(430, r.width * 0.46) + 24 : 0;
    const availW = r.width - panelW;
    const pad = 1.35 * zoomOut;
    const scale = Math.max((bw * pad) / availW, (bh * pad) / r.height);
    const w = r.width * scale, h = r.height * scale;
    const cx = bx + bw / 2, cy = by + bh / 2;
    const x = cx - (availW / 2) * scale;
    return { x, y: cy - h / 2, w, h };
  }
  function zoomAt(factor, sx, sy) {
    const r = size();
    const px = vb.x + (sx / r.width) * vb.w, py = vb.y + (sy / r.height) * vb.h;
    const w = vb.w * factor, h = vb.h * factor;
    setVb({ x: px - (sx / r.width) * w, y: py - (sy / r.height) * h, w, h });
  }

  // pointer: drag to pan, pinch to zoom, tap to pick
  const pointers = new Map();
  let drag = null;
  wrap.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".panel,.zoom,.lbl")) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    wrap.setPointerCapture(e.pointerId);
    flight = null;
    stopTour();
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, vb: { ...vb }, moved: 0, target: e.target };
    else drag = { pinch: dist(), vb: { ...vb }, mid: mid(), moved: 99 };
  });
  const dist = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
  const mid = () => { const [a, b] = [...pointers.values()]; const r = size(); return [(a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top]; };
  wrap.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) { hover(e); return; }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (!drag) return;
    const r = size();
    if (drag.pinch && pointers.size === 2) {
      const f = drag.pinch / dist();
      const [mx, my] = mid();
      const px = drag.vb.x + (drag.mid[0] / r.width) * drag.vb.w, py = drag.vb.y + (drag.mid[1] / r.height) * drag.vb.h;
      const w = drag.vb.w * f, h = drag.vb.h * f;
      setVb({ x: px - (mx / r.width) * w, y: py - (my / r.height) * h, w, h });
      return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    if (drag.moved > 4) {
      wrap.classList.add("dragging");
      setVb({ ...drag.vb, x: drag.vb.x - (dx / r.width) * drag.vb.w, y: drag.vb.y - (dy / r.height) * drag.vb.h });
    }
  });
  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    wrap.classList.remove("dragging");
    if (drag && pointers.size === 0) {
      if (drag.moved <= 4 && e.type === "pointerup") {
        const z = drag.target.closest && drag.target.closest(".zone");
        if (z) pick(z.dataset.id); else if (!panel.hidden) clearSelection(true);
      }
      drag = null;
    } else if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      drag = { x: p[0], y: p[1], vb: { ...vb }, moved: 99 };
    }
  };
  wrap.addEventListener("pointerup", release);
  wrap.addEventListener("pointercancel", release);
  wrap.addEventListener("wheel", (e) => {
    if (e.target.closest(".panel")) return;
    e.preventDefault();
    flight = null;
    const r = size();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(Math.exp(d * 0.0016), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  $("#zIn").addEventListener("click", () => { const r = size(); fly({ ...zoomBox(0.6, r) }, 400); });
  $("#zOut").addEventListener("click", () => { const r = size(); fly({ ...zoomBox(1 / 0.6, r) }, 400); });
  $("#zFit").addEventListener("click", () => { clearSelection(false); fly(full); });
  function zoomBox(f) { const w = vb.w * f, h = vb.h * f; return { x: vb.x + (vb.w - w) / 2, y: vb.y + (vb.h - h) / 2, w, h }; }
  wrap.addEventListener("keydown", (e) => {
    if (e.target.closest(".panel")) return;
    const step = vb.w * 0.08;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key] && !app.classList.contains("has-sel")) { e.preventDefault(); setVb({ ...vb, x: vb.x + moves[e.key][0], y: vb.y + moves[e.key][1] }); }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); fly(zoomBox(0.7), 300); }
    if (e.key === "-") { e.preventDefault(); fly(zoomBox(1 / 0.7), 300); }
  });

  // hover: highlight and readout
  let hovered = null;
  function hover(e) {
    const z = e.target.closest && e.target.closest(".zone");
    const id = z ? z.dataset.id : null;
    if (id === hovered) return;
    hovered = id;
    setHov(id);
    placeLabels();
    showReadout(id || selected);
  }
  function setHov(id) {
    $$(".hov").forEach((el) => el.classList.remove("hov"));
    if (!id) return;
    if (labelOf[id]) labelOf[id].classList.add("hov");
    $$(`.zone[data-id="${id}"]`).forEach((z) => z.classList.add("hov"));
  }
  function showReadout(id) {
    let t = `${STATIONS.length} stations · ${PARTIES.length} parties · 10²⁴–10²⁶ FLOP per frontier run`;
    if (id && byId[id]) t = `${byId[id].n} ${byId[id].name} · ${byId[id].readout}`;
    else if (id && partyById[id]) t = `${partyById[id].name} · ${partyById[id].kind}`;
    if (readout.textContent !== t) readout.textContent = t;
  }

  // ---------- labels ----------
  const labelOf = {};
  for (const [id, z] of Object.entries(ZONES)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lbl" + (z.kind === "island" ? " isl" : "");
    b.dataset.id = id;
    if (z.kind === "station") b.innerHTML = `<span class="n">${byId[id].n}</span>${esc(byId[id].name)}`;
    else b.textContent = ISLANDS[id];
    b.addEventListener("click", (e) => { e.stopPropagation(); stopTour(); pick(id); });
    b.addEventListener("pointerenter", () => { hovered = id; setHov(id); showReadout(id); });
    b.addEventListener("pointerleave", () => { hovered = null; setHov(null); showReadout(selected); });
    labelsEl.appendChild(b);
    labelOf[id] = b;
  }
  // section names float at the pads' front corners when zoomed out
  const secLbls = SECTIONS.map((sec) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "sec-lbl";
    el.innerHTML = `<b>${esc(sec.name)}</b><span>${esc(sec.sub)}</span>`;
    el.addEventListener("click", (e) => { e.stopPropagation(); stopTour(); selectSection(SECTIONS.indexOf(sec)); });
    labelsEl.appendChild(el);
    return { el, sec };
  });
  function placeLabels() {
    const r = size();
    const kx = r.width / vb.w, ky = r.height / vb.h;
    for (const { el, sec } of secLbls) {
      const [sx, sy, side] = SEC_AT[sec.name][view];
      el.classList.toggle("l", side === "l");
      // keep the name inside the frame
      const w = (el._w ||= el.offsetWidth || 200);
      let x = (sx - vb.x) * kx;
      if (side === "l" && x > 0) x = Math.max(x, w + 22);
      if (side !== "l" && x < r.width) x = Math.min(x, r.width - w - 22);
      el.style.transform = `translate(${f1(x)}px, ${f1((sy - vb.y) * ky)}px)`;
    }
    // place every label, then hide any that would sit on one already kept
    const kept = [];
    const ranked = Object.entries(ZONES).sort(([a], [b]) => rank(b) - rank(a));
    for (const [id, z] of ranked) {
      const [lx, ly] = z.label;
      const x = (lx - vb.x) * kx, y = (ly - vb.y) * ky;
      const el = labelOf[id];
      const w = (el._w ||= el.offsetWidth || 120), h = (el._h ||= el.offsetHeight || 22);
      const box = [x - w / 2 - 3, y - h - 3, x + w / 2 + 3, y + 3];
      // up close the plates carry their own painted names
      const plated = app.classList.contains("near") && z.kind === "station" && id !== selected && id !== hovered;
      const off = plated || x < -200 || y < -60 || x > r.width + 200 || y > r.height + 60;
      const hit = kept.some((k) => box[0] < k[2] && box[2] > k[0] && box[1] < k[3] && box[3] > k[1]);
      el.style.transform = `translate(${f1(x)}px, ${f1(y)}px) translate(-50%, -100%)`;
      const show = !off && !hit;
      el.style.visibility = show ? "" : "hidden";
      if (show) kept.push(box);
    }
  }
  function rank(id) {
    if (id === selected || id === hovered) return 3;
    const l = labelOf[id];
    if (l && l.classList.contains("pf")) return 2;
    return ZONES[id].kind === "station" ? 1 : 0;
  }

  // ---------- selection ----------
  let selected = null;
  function pick(id) {
    if (byId[id]) selectStation(id);
    else if (partyById[id]) selectParty(id);
  }
  function mark(ids, cls) {
    $$(`.${cls}`).forEach((el) => el.classList.remove(cls));
    for (const id of ids) {
      $$(`.zone[data-id="${id}"]`).forEach((z) => z.classList.add(cls));
      if (labelOf[id]) labelOf[id].classList.add(cls);
    }
  }
  function openPanel(html) {
    secLbls.forEach(({ el }) => el.classList.remove("on"));
    pinnedPart = null;
    lightPart(null);
    panel.innerHTML = html;
    panel.hidden = false;
    app.classList.add("has-panel");
    panel.scrollTop = 0;
    if (narrow.matches) panel.scrollIntoView({ block: "nearest", behavior: still.matches ? "auto" : "smooth" });
  }
  function clearSelection(refit) {
    selected = null;
    secLbls.forEach(({ el }) => el.classList.remove("on"));
    pinnedPart = null;
    lightPart(null);
    panel.hidden = true;
    app.classList.remove("has-panel", "has-sel", "party-mode");
    mark([], "sel"); mark([], "pf"); mark([], "on");
    $$(".conduit.pf").forEach((c) => c.classList.remove("pf"));
    $$(".rail button").forEach((b) => b.classList.remove("on"));
    showReadout(null);
    if (refit) fly(full);
  }
  const sectionTitles = { what: "What happens", data: "Data flow", energy: "Energy & compute", human: "Where people decide" };
  const sectionLayer = { data: "data", energy: "energy", human: "people" };
  function stationHtml(s) {
    const i = order.indexOf(s.id);
    const prev = STATIONS[i - 1], next = STATIONS[i + 1];
    const det = Object.entries(s.sections).map(([key, html]) => `<details data-layer="${sectionLayer[key] || ""}"${key === "what" ? " open" : ""}><summary>${sectionLayer[key] ? `<i class="sw sw-${sectionLayer[key]}"></i>` : ""}${sectionTitles[key]}${sectionLayer[key] ? `<span class="hint">shows on map</span>` : ""}</summary><div class="d-body">${html}</div></details>`).join("");
    return `<div class="p-head"><span class="p-num">${s.n} / ${STATIONS.length}</span><span>${esc(s.zone)}</span><button class="p-close" aria-label="Close">×</button></div>
      <h2>${esc(s.name)}</h2>
      <p class="p-short">${esc(s.short)}</p>
      <dl class="p-meta"><dt>Takes</dt><dd>${esc(s.time)}</dd><dt>Gauge</dt><dd>${esc(s.readout)}</dd></dl>
      <div class="p-human"><div><span class="tag">Human judgement</span>${esc(s.human)}</div></div>
      ${s.steps.length ? `<p class="p-sub">Inside this station · ${s.steps.length} machines</p><div class="psteps">${s.steps.map((st, i) => `<button class="pstep" data-part="${st.id}" aria-pressed="false"><span class="k">${String.fromCharCode(65 + i)}</span><span class="nm">${esc(st.name)}</span><span class="ex">${esc(st.short)}</span></button>`).join("")}</div>` : ""}
      ${det}
      <details><summary>Techniques & algorithms</summary><ul class="chips">${s.tech.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></details>
      <details open><summary>At trillion-parameter scale</summary><table class="facts"><tbody>${s.facts.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></details>
      <p class="p-sub">Who's involved</p>
      <div class="pchips">${s.parties.map((p) => `<button class="pchip" data-party="${p}"><span class="k">${esc(partyById[p].kind)}</span>${esc(partyById[p].name)}</button>`).join("")}</div>
      <div class="p-nav"><button data-go="${prev ? prev.id : ""}" ${prev ? "" : "disabled"}>← ${prev ? `${prev.n} ${esc(prev.name)}` : "Start"}</button><button data-go="${next ? next.id : ""}" ${next ? "" : "disabled"}>${next ? `${next.n} ${esc(next.name)}` : "End of line"} →</button></div>`;
  }
  function selectStation(id, opts = {}) {
    const s = byId[id];
    selected = id;
    app.classList.remove("party-mode");
    mark([], "pf");
    $$(".conduit.pf").forEach((c) => c.classList.remove("pf"));
    app.classList.add("has-sel");
    mark([id], "sel");
    mark([id], "on");
    placeLabels();
    $$(".rail button").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
    const btn = $(`.rail button[data-id="${id}"]`);
    // scroll only the rail: scrollIntoView would also move a page this is embedded in
    if (btn) { const rb = rail.getBoundingClientRect(), r = btn.getBoundingClientRect(); if (r.left < rb.left || r.right > rb.right) rail.scrollLeft += r.left - rb.left - (rb.width - r.width) / 2; }
    openPanel(stationHtml(s));
    showReadout(id);
    if (opts.fly !== false) fly(frameZone(id));
  }
  function selectParty(id) {
    const p = partyById[id];
    selected = id;
    app.classList.remove("has-sel");
    app.classList.add("party-mode");
    mark([], "sel");
    const ids = [...p.stations, ...(ZONES[id] ? [id] : [])];
    mark(ids, "pf");
    mark(ZONES[id] ? [id] : [], "on");
    $$(".conduit").forEach((c) => c.classList.toggle("pf", c.dataset.party === id));
    $$(".rail button").forEach((b) => b.classList.toggle("on", p.stations.includes(b.dataset.id)));
    const where = ZONES[id] ? "Island on the map" : id === "lab" ? "The whole campus floor" : "No single place: lit stations show where";
    openPanel(`<div class="p-head"><span class="p-num">${esc(p.kind)}</span><span>Party</span><button class="p-close" aria-label="Close">×</button></div>
      <h2>${esc(p.name)}</h2>
      <p class="p-short">${esc(p.role)}</p>
      <dl class="p-meta"><dt>Who</dt><dd>${esc(p.examples)}</dd><dt>Where</dt><dd>${where}</dd></dl>
      <p class="p-sub">Stations they touch (${p.stations.length})</p>
      <div class="pchips">${p.stations.map((s) => `<button class="pchip" data-go="${s}"><span class="k">${byId[s].n}</span>${esc(byId[s].name)}</button>`).join("")}</div>`);
    showReadout(id);
    if (ZONES[id]) fly(frameZone(id, 1.3));
    else if (id === "lab") fly(full);
    else {
      // frame every station they touch
      const bs = p.stations.map((s) => ZONES[s].box);
      const x0 = Math.min(...bs.map((b) => b[0])), y0 = Math.min(...bs.map((b) => b[1]));
      const x1 = Math.max(...bs.map((b) => b[0] + b[2])), y1 = Math.max(...bs.map((b) => b[1] + b[3]));
      fly(frameBox([x0, y0, x1 - x0, y1 - y0], 0.85));
    }
  }
  // a merged station's machines light up from its step list
  let pinnedPart = null;
  function lightPart(id) {
    $$(".part-on").forEach((g) => g.classList.remove("part-on"));
    app.classList.toggle("has-part", !!id);
    if (id) $$(`.part[data-part="${id}"]`).forEach((g) => g.classList.add("part-on"));
  }
  panel.addEventListener("pointerover", (e) => { const b = e.target.closest("[data-part]"); if (b) lightPart(b.dataset.part); });
  panel.addEventListener("pointerout", (e) => { const b = e.target.closest("[data-part]"); if (b && !b.contains(e.relatedTarget)) lightPart(pinnedPart); });
  panel.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.classList.contains("pstep")) {
      pinnedPart = pinnedPart === t.dataset.part ? null : t.dataset.part;
      $$(".pstep", panel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.part === pinnedPart)));
      lightPart(pinnedPart);
      return;
    }
    if (t.classList.contains("p-close")) { stopTour(); clearSelection(true); return; }
    if (t.dataset.go) { stopTour(); selectStation(t.dataset.go); return; }
    if (t.dataset.sec) { stopTour(); selectSection(+t.dataset.sec); return; }
    if (t.dataset.party) { stopTour(); selectParty(t.dataset.party); }
  });
  panel.addEventListener("toggle", (e) => {
    const d = e.target;
    if (d.tagName === "DETAILS" && d.open && d.dataset.layer) setLayer(d.dataset.layer, true);
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) { stopTour(); clearSelection(true); }
    if ((e.key === "]" || e.key === "[") && selected) step(e.key === "]" ? 1 : -1);
  });
  function placePanel() {
    const host = narrow.matches ? panelHost : wrap;
    if (panel.parentElement !== host) host.appendChild(panel);
  }
  narrow.addEventListener("change", placePanel);

  // ---------- sections: the staged view ----------
  // A section is selected as "sec:<index>". It frames every station in it at once.
  const secOf = (key) => (typeof key === "string" && key.startsWith("sec:") ? SECTIONS[+key.slice(4)] : null);
  const sectionOfStation = (id) => SECTIONS.findIndex((sec) => sec.ids.includes(id));
  function sectionBox(sec) {
    const bs = sec.ids.map((id) => ZONES[id].box);
    const x0 = Math.min(...bs.map((b) => b[0])), y0 = Math.min(...bs.map((b) => b[1]));
    return [x0, y0, Math.max(...bs.map((b) => b[0] + b[2])) - x0, Math.max(...bs.map((b) => b[1] + b[3])) - y0];
  }
  function sectionHtml(sec, i) {
    const prev = SECTIONS[i - 1], next = SECTIONS[i + 1];
    return `<div class="p-head"><span class="p-num">Section ${i + 1} / ${SECTIONS.length}</span><span>${esc(sec.tag)}</span><button class="p-close" aria-label="Close">×</button></div>
      <h2>${esc(sec.title)}</h2>
      <p class="p-short">${esc(sec.blurb)}</p>
      <table class="facts"><tbody>${sec.facts.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table>
      <p class="p-sub">In this section (${sec.ids.length})</p>
      <div class="psteps">${sec.ids.map((id) => byId[id]
        ? `<button class="pstep" data-go="${id}"><span class="k">${byId[id].n}</span><span class="nm">${esc(byId[id].name)}</span><span class="ex">${esc(byId[id].short)}</span></button>`
        : `<button class="pstep" data-party="${id}"><span class="k">◇</span><span class="nm">${esc(partyById[id].name)}</span><span class="ex">${esc(partyById[id].examples)}</span></button>`).join("")}</div>
      <div class="p-nav"><button data-sec="${prev ? i - 1 : ""}" ${prev ? "" : "disabled"}>← ${prev ? esc(prev.title) : "Start"}</button><button data-sec="${next ? i + 1 : ""}" ${next ? "" : "disabled"}>${next ? esc(next.title) : "End of line"} →</button></div>`;
  }
  function selectSection(i, opts = {}) {
    const sec = SECTIONS[i];
    selected = "sec:" + i;
    app.classList.remove("has-sel");
    app.classList.add("party-mode");
    mark([], "sel");
    mark(sec.ids, "pf");
    mark([], "on");
    $$(".conduit.pf").forEach((c) => c.classList.remove("pf"));
    $$(".rail button").forEach((b) => b.classList.toggle("on", sec.ids.includes(b.dataset.id)));
    openPanel(sectionHtml(sec, i));
    secLbls.forEach(({ el }, j) => el.classList.toggle("on", j === i));
    readout.textContent = `${sec.title} · ${sec.tag}`;
    if (opts.fly !== false) fly(frameBox(sectionBox(sec), 1));
  }

  // ---------- layers ----------
  function setLayer(name, on) {
    app.classList.toggle("show-" + name, on);
    const b = $(`.layer[data-layer="${name}"]`);
    if (b) b.setAttribute("aria-pressed", String(on));
  }
  $$(".layer[data-layer]").forEach((b) => b.addEventListener("click", () => setLayer(b.dataset.layer, b.getAttribute("aria-pressed") !== "true")));

  // ---------- rail, parties, table ----------
  const rail = $("#rail");
  rail.innerHTML = STATIONS.map((s) => `<button data-id="${s.id}"><span class="n">${s.n}</span>${esc(s.name)}<span class="z">${esc(s.zone)}</span></button>`).join("");
  rail.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { stopTour(); selectStation(b.dataset.id); } });
  const grid = $("#partyGrid");
  grid.innerHTML = PARTIES.map((p) => `<button class="pcard" data-party="${p.id}"><span class="k">${esc(p.kind)}</span><span class="nm">${esc(p.name)}</span><span class="ex">${esc(p.examples)}</span></button>`).join("");
  const toMap = () => { if (wrap.getBoundingClientRect().top < 0 || wrap.getBoundingClientRect().bottom > innerHeight) wrap.scrollIntoView({ block: "start", behavior: still.matches ? "auto" : "smooth" }); };
  grid.addEventListener("click", (e) => { const b = e.target.closest(".pcard"); if (b) { stopTour(); selectParty(b.dataset.party); toMap(); } });
  $("#glance tbody").innerHTML = STATIONS.map((s) => `<tr><td>${s.n}</td><td><button data-id="${s.id}">${esc(s.name)}</button></td><td>${esc(s.time.split(";")[0].split(",")[0])}</td><td>${esc(s.human)}</td></tr>`).join("");
  $("#glance").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { stopTour(); selectStation(b.dataset.id); toMap(); } });

  // ---------- tour: station by station, or staged by section ----------
  let tour = null;
  let tourMode = "stations";
  const playBtn = $("#tourPlay");
  const tourList = () => (tourMode === "sections" ? SECTIONS.map((_, i) => "sec:" + i) : order);
  const goTo = (key) => (secOf(key) ? selectSection(+key.slice(4)) : selectStation(key));
  // where the tour stands now, in its own list
  function tourIndex() {
    if (tourMode === "sections") return secOf(selected) ? +selected.slice(4) : byId[selected] ? sectionOfStation(selected) : -1;
    return byId[selected] ? order.indexOf(selected) : secOf(selected) ? order.indexOf(secOf(selected).ids[0]) : -1;
  }
  const playLabel = () => (tourMode === "sections" ? "Walk the sections" : "Walk the line");
  function startTour() {
    const list = tourList();
    const i = tourIndex();
    tour = { i: i < 0 || i >= list.length - 1 ? 0 : i + 1, timer: 0 };
    playBtn.classList.add("playing");
    playBtn.querySelector(".play-txt").textContent = "Pause tour";
    tourStep();
  }
  function tourStep() {
    if (!tour) return;
    goTo(tourList()[tour.i]);
    tour.timer = setTimeout(() => {
      if (!tour) return;
      tour.i += 1;
      if (tour.i >= tourList().length) { stopTour(); return; }
      tourStep();
    }, tourMode === "sections" ? 12000 : 7500);
  }
  function stopTour() {
    if (!tour) return;
    clearTimeout(tour.timer);
    tour = null;
    playBtn.classList.remove("playing");
    playBtn.querySelector(".play-txt").textContent = playLabel();
  }
  function step(d) {
    stopTour();
    const list = tourList();
    const i = tourIndex();
    goTo(list[Math.min(list.length - 1, Math.max(0, i < 0 ? 0 : i + d))]);
  }
  playBtn.addEventListener("click", () => (tour ? stopTour() : startTour()));
  $("#tourPrev").addEventListener("click", () => step(-1));
  $("#tourNext").addEventListener("click", () => step(1));
  // switching mode jumps to the matching stop: a station's section, or a section's first station
  $$(".tmode").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.mode === tourMode) return;
    const running = !!tour;
    stopTour();
    tourMode = b.dataset.mode;
    $$(".tmode").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    playBtn.querySelector(".play-txt").textContent = playLabel();
    $("#tourPrev").setAttribute("aria-label", tourMode === "sections" ? "Previous section" : "Previous station");
    $("#tourNext").setAttribute("aria-label", tourMode === "sections" ? "Next section" : "Next station");
    if (running) { startTour(); return; }
    if (selected) goTo(tourList()[Math.max(0, tourIndex())]);
  }));

  // ---------- live parts ----------
  let zoneRects = [];
  let groundPk = null;
  const zoneAt = (x, y) => zoneRects.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  let streams = [];
  const kinds = { data: ["pkt", 2.6, 48, 38], licensed: ["pkt", 2.6, 56, 30], model: ["pkt model", 3.4, 90, 34], human: ["pkt human", 2.4, 50, 30], feedback: ["pkt feedback", 2.2, 60, 26] };
  function buildStreams() {
    $$(".pkt", svg).forEach((c) => c.remove());
    zoneRects = Object.entries(ZONES).map(([id, z]) => ({ id, x: z.plan[0], y: z.plan[1], w: z.plan[2], h: z.plan[3], dx: z.dx || 0, dy: z.dy || 0, top: z.top, lift: z.lift, g: svg.querySelector(`.pk[data-zone="${id}"]`) }));
    streams = [];
    for (const [name, pts] of Object.entries(VIEWS[view].routes)) {
      const [cls, r, gap, speed] = kinds[name];
      const segs = [];
      let L = 0;
      for (let i = 0; i < pts.length - 1; i++) { const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push({ a: pts[i], b: pts[i + 1], s: L, len }); L += len; }
      const n = Math.max(2, Math.floor(L / gap));
      const items = [];
      for (let i = 0; i < n; i++) {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("class", cls);
        c.setAttribute("r", r);
        groundPk.appendChild(c);
        items.push({ el: c, s0: (i / n) * L, zone: null });
      }
      streams.push({ segs, L, items, speed });
    }
  }
  function placePackets(t) {
    for (const st of streams) for (const it of st.items) {
      const s = (it.s0 + t * st.speed) % st.L;
      const seg = st.segs.find((g) => s >= g.s && s <= g.s + g.len) || st.segs[st.segs.length - 1];
      const u = (s - seg.s) / (seg.len || 1);
      let x = seg.a[0] + (seg.b[0] - seg.a[0]) * u, y = seg.a[1] + (seg.b[1] - seg.a[1]) * u;
      const zr = zoneAt(x, y);
      // inside a zone, draw in the zone's own coordinates: its group carries the view offset
      if (zr) { x -= zr.dx; y -= zr.dy; }
      let z = (zr ? zr.top : 0) + 2.4 + 2;
      if (zr && zr.lift) { const [a0, a1, b0, b1, zt] = zr.lift; const u = Math.min(1, Math.max(0, Math.min((x - a0) / (a1 - a0), (b1 - x) / (b1 - b0)))); z += u * (zt - z); }
      const host = zr ? zr.g : groundPk;
      if (it.el.parentNode !== host) host.appendChild(it.el);
      const [px, py] = iso([x, y, z]);
      it.el.setAttribute("cx", f1(px));
      it.el.setAttribute("cy", f1(py));
    }
  }
  // moving parts, found again in whichever drawing is showing
  let rams = [], stretch = null, needles = [], balParts = null, podsBack = null, podsFront = null, pods = [];
  function bindLive() {
    groundPk = svg.querySelector('.pk[data-zone="ground"]');
    rams = $$(".ram", svg); // press ram
    stretch = $(".stretch", svg); // carriage on the context ruler
    needles = $$(".needle", svg).map((el, i) => ({ el, cx: +el.dataset.cx, cy: +el.dataset.cy, z: +el.dataset.z, r: +el.dataset.r, base: (i * 0.37) % 0.8, ph: i * 1.7 }));
    // balance: the reward model weighing two answers
    const bal = $(".balance", svg);
    balParts = null;
    if (bal) {
      bal.innerHTML = "";
      const mk = (cls) => { const p = document.createElementNS(NS, "path"); p.setAttribute("class", cls); bal.appendChild(p); return p; };
      balParts = { strA: mk("bal-str"), panA: mk("bal-pan a"), beam: mk("bal-beam"), strB: mk("bal-str"), panB: mk("bal-pan"), x: +bal.dataset.x, y: +bal.dataset.y, z: +bal.dataset.z, arm: +bal.dataset.arm, drop: +bal.dataset.drop };
    }
    // RL carousel pods
    podsBack = $(".pods-back", svg); podsFront = $(".pods-front", svg);
    pods = [];
    if (POD && podsBack) {
      podsBack.innerHTML = ""; podsFront.innerHTML = "";
      for (let i = 0; i < 8; i++) {
        const g = document.createElementNS(NS, "g");
        g.innerHTML = POD.svg;
        podsBack.appendChild(g);
        pods.push({ g, a0: (i / 8) * Math.PI * 2 });
      }
    }
  }
  function drawBalance(t) {
    if (!balParts) return;
    const { x, y, z, arm, drop } = balParts;
    const th = 0.16 * Math.sin(t * 0.7) + 0.05 * Math.sin(t * 1.9);
    const ea = [x - arm * Math.cos(th), y, z + arm * Math.sin(th)];
    const eb = [x + arm * Math.cos(th), y, z - arm * Math.sin(th)];
    balParts.beam.setAttribute("d", poly([ea, eb]));
    const pan = (e) => Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2; return [e[0] + Math.cos(a) * 11, e[1] + Math.sin(a) * 11, e[2] - drop]; });
    balParts.strA.setAttribute("d", poly([ea, [ea[0] - 9, ea[1], ea[2] - drop]]) + poly([ea, [ea[0] + 9, ea[1], ea[2] - drop]]));
    balParts.strB.setAttribute("d", poly([eb, [eb[0] - 9, eb[1], eb[2] - drop]]) + poly([eb, [eb[0] + 9, eb[1], eb[2] - drop]]));
    balParts.panA.setAttribute("d", poly(pan(ea), true));
    balParts.panB.setAttribute("d", poly(pan(eb), true));
  }
  function drawPods(t) {
    for (const p of pods) {
      const a = p.a0 + t * 0.32;
      const dx = Math.cos(a) * POD.r, dy = Math.sin(a) * POD.r;
      const host = dx * cA + dy * sA < 0 ? podsBack : podsFront;
      if (p.g.parentNode !== host) host.appendChild(p.g);
      const [sx, sy] = shift([dx, dy, 0]);
      p.g.setAttribute("transform", `translate(${f1(sx)} ${f1(sy)})`);
    }
    // keep pods within each half in depth order
    for (const host of [podsBack, podsFront]) {
      const kids = [...host.children].map((g) => ({ g, d: pods.find((p) => p.g === g) })).map(({ g, d }) => ({ g, k: Math.cos(d.a0 + t * 0.32) * cA + Math.sin(d.a0 + t * 0.32) * sA }));
      kids.sort((a, b) => a.k - b.k);
      kids.forEach(({ g }, i) => { if (host.children[i] !== g) host.insertBefore(g, host.children[i]); });
    }
  }

  let raf = 0, visible = true, t0 = performance.now();
  function frame(now) {
    raf = 0;
    stepFlight(now);
    const t = (now - t0) / 1000;
    if (!still.matches && visible) {
      placePackets(t);
      for (const r of rams) { const ph = (t % 1.6) / 1.6; const dz = ph < 0.15 ? -16 * Math.sin((ph / 0.15) * Math.PI / 2) : -16 * Math.max(0, 1 - (ph - 0.15) / 0.5); const [sx, sy] = shift([0, 0, dz]); r.setAttribute("transform", `translate(${f1(sx)} ${f1(sy)})`); }
      if (stretch) { const [sx, sy] = shift([-34 + 34 * Math.sin(t * 0.5), 0, 0]); stretch.setAttribute("transform", `translate(${f1(sx)} ${f1(sy)})`); }
      for (const n of needles) {
        const a = (n.base + 0.06 * Math.sin(t * 0.8 + n.ph)) * Math.PI * 2;
        n.el.setAttribute("d", poly([[n.cx - Math.sin(a) * 2.4, n.cy + Math.cos(a) * 2.4, n.z], [n.cx + Math.sin(a) * n.r, n.cy - Math.cos(a) * n.r, n.z]]));
      }
      drawBalance(t);
      drawPods(t);
    }
    if ((visible && !still.matches) || flight) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function stillFrame() { placePackets(12); drawBalance(1.2); drawPods(1); }
  new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) kick(); }, { rootMargin: "80px" }).observe(wrap);
  const syncMotion = () => { app.classList.toggle("anim", !still.matches); if (still.matches) stillFrame(); kick(); };
  still.addEventListener("change", syncMotion);

  // ---------- switching views ----------
  let zonesG = svg.querySelector(".zones");
  let swapTimer = 0;
  function layoutView(v) {
    view = v;
    ZONES = zonesFor(v);
    app.classList.toggle("view-line", v === "line");
    $$(".view-btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
    wrap.setAttribute("aria-label", v === "line" ? "The line, straightened: all eleven stations end to end. Drag to pan, scroll or pinch to zoom, click a station for details." : "Factory floor. Drag to pan, scroll or pinch to zoom, click a station for details.");
    $(".c-tl").textContent = v === "line" ? "The line, straightened · 1 m ≈ 12 units" : "Campus floor · 1 m ≈ 12 units";
    // move every zone to its place in this view, then repaint back to front
    for (const id of VIEWS[v].order) {
      const g = svg.querySelector(`.zone[data-id="${id}"]`);
      const z = ZONES[id];
      if (z.dx || z.dy) { const [sx, sy] = shift([z.dx, z.dy, 0]); g.setAttribute("transform", `translate(${f1(sx)} ${f1(sy)})`); } else g.removeAttribute("transform");
      zonesG.appendChild(g);
    }
    buildStreams();
    if (still.matches) stillFrame();
    fitFull();
  }
  function startVb() {
    if (!narrow.matches) return { ...full };
    // on a phone, start closer in: the middle of the campus, or the head of the line
    if (view === "line") return clampVb(frameBox(ZONES.s01.box, 2.2));
    return clampVb({ x: full.x + full.w * 0.19, y: full.y + full.h * 0.19, w: full.w * 0.62, h: full.h * 0.62 });
  }
  // after a relayout, frame whatever is selected again
  function refocus() {
    if (byId[selected]) vb = clampVb(frameZone(selected));
    else if (partyById[selected]) { selectParty(selected); vb = flight ? clampVb(flight.to) : vb; flight = null; }
    else if (secOf(selected)) vb = clampVb(frameBox(sectionBox(secOf(selected)), 1));
    else vb = startVb();
  }
  function setView(v) {
    if (v === view) return;
    clearTimeout(swapTimer);
    flight = null;
    const swap = () => {
      layoutView(v);
      refocus();
      apply();
      svg.classList.remove("swapping");
    };
    if (still.matches) { swap(); return; }
    svg.classList.add("swapping");
    swapTimer = setTimeout(swap, 180);
  }
  $$(".view-btn").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

  // ---------- isometric / flat ----------
  function showProjection(p) {
    proj = p;
    ({ P, VIEWS, ZONES: BASE, POD, SEC_AT } = PROJ[p]);
    setCamera();
    svg = $("#map-" + p);
    zonesG = svg.querySelector(".zones");
    app.classList.toggle("proj-flat", p === "flat");
    $$(".proj-btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.proj === p)));
    bindLive();
  }
  function setProjection(p) {
    if (p === proj) return;
    clearTimeout(swapTimer);
    flight = null;
    const swap = () => {
      svg.classList.remove("swapping");
      showProjection(p);
      layoutView(view);
      refocus();
      apply();
      if (!still.matches) { svg.classList.add("swapping"); requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove("swapping"))); }
    };
    if (still.matches) { swap(); return; }
    svg.classList.add("swapping");
    swapTimer = setTimeout(swap, 180);
  }
  $$(".proj-btn").forEach((b) => b.addEventListener("click", () => setProjection(b.dataset.proj)));

  // ---------- light / dark ----------
  // follows the system until the viewer picks; the pick is remembered on this device
  const root = document.documentElement;
  const sysLight = matchMedia("(prefers-color-scheme: light)");
  const themeBtn = $("#themeBtn");
  const isLight = () => (root.dataset.theme ? root.dataset.theme === "light" : sysLight.matches);
  function syncThemeBtn() {
    const light = isLight();
    themeBtn.querySelector(".theme-txt").textContent = light ? "Dark" : "Light";
    themeBtn.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
    themeBtn.classList.toggle("is-light", light);
  }
  try { const saved = localStorage.getItem("foundry-theme"); if (saved === "light" || saved === "dark") root.dataset.theme = saved; } catch (e) {}
  themeBtn.addEventListener("click", () => {
    root.dataset.theme = isLight() ? "dark" : "light";
    try { localStorage.setItem("foundry-theme", root.dataset.theme); } catch (e) {}
    syncThemeBtn();
  });
  sysLight.addEventListener("change", syncThemeBtn);
  syncThemeBtn();

  // ---------- start ----------
  placePanel();
  showProjection(/(^|[#&])flat\b/.test(location.hash) ? "flat" : "iso");
  layoutView(/(^|[#&])line\b/.test(location.hash) ? "line" : "loop");
  vb = startVb();
  apply();
  stillFrame();
  syncMotion();
  new ResizeObserver(() => {
    const oldFull = full;
    fitFull();
    const ratio = vb.w / oldFull.w;
    const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
    const w = full.w * ratio, h = full.h * ratio;
    vb = clampVb({ x: cx - w / 2, y: cy - h / 2, w, h });
    apply();
  }).observe(wrap);
  // open a station named in the link, e.g. #s06
  const hash = location.hash.replace("#", "").split("&").filter((h) => h !== "line" && h !== "flat").join("");
  if (byId[hash] || partyById[hash]) setTimeout(() => pick(hash), 60);
})();
