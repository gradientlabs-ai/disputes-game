// Dispute Factory v1: app shell, frame loop and the in-run screen ("The stack"). Owned by PLAY.
// Talks to window.Sim / window.GAMEDATA (sim.js, data.js) and window.Screens (ui-screens.js).
(function () {
  'use strict';
  const D = window.GAMEDATA, S = window.Sim;
  const $ = id => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  const COL = { black: '#000000', sand: '#F8F4EB', orange: '#FF8933', tint: '#FFA666', shade: '#C7BCA3', coral: '#F27C71', gold: '#FFED77', lucite: '#7ACBA7', white: '#FFFFFF' };
  const PALETTE = new Set(Object.values(COL).map(c => c.toUpperCase()));
  const PX = '"Press Start 2P", monospace', SS = 'Silkscreen, monospace';
  const DAY_SEC = 12;           // real seconds per sim day at 1x (40 days = 8 minutes of play at 1x)
  const STEP = 0.01;            // fixed sim step in days
  const SPEED = Math.max(0.1, +Q.get('speed') || 1); // test-only: ?speed=N multiplies sim speed for automated playtests (no UI)
  const STAGE_W = 844, STAGE_H = 390;
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (!D || !S) { const e = $('errs'); if (e) { e.hidden = false; e.textContent = 'data.js or sim.js failed to load.'; } return; }
  const C = S.C || {};

  // ---------------------------------------------------------------- helpers
  const fmt = n => { n = Math.round(n || 0); const a = Math.abs(n); return (n < 0 ? '-' : '') + '£' + (a >= 1e6 ? (a / 1e6).toFixed(1) + 'm' : a.toLocaleString('en-GB')); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();
  const staffed = s => s && s.def && (s.def.kind === 'work' || s.def.kind === 'policy');
  const shortOf = s => s.def.short || s.def.label || s.def.name || s.id;
  const items = s => {
    const out = s.queue ? s.queue.slice() : [];
    if (s.list && s.list.length) for (const o of s.list) out.push(o && o.c ? o.c : o);
    return out;
  };
  const typeOf = c => (D.TYPES && D.TYPES[c && c.type]) || {};
  const REG_FALLBACK = { FRAUD: 1, APP: 1, DD: 1 };
  const isComplaint = (c, sid) => (c && c.type === 'COMP') || sid === 'COMPL';
  const isReg = c => { const t = typeOf(c); return t.regulated != null ? !!t.regulated : !!REG_FALLBACK[c && c.type]; };
  const caseCol = (c, sid) => isComplaint(c, sid) ? COL.gold : isReg(c) ? COL.coral : COL.orange;
  const isLate = c => { if (!c || c.slaDone) return false; const d = c.stage === 'rep' && c.repDue != null ? c.repDue : c.due; return d != null && g.t > d; };
  const palCol = (c, dflt) => (c && PALETTE.has(String(c).toUpperCase())) ? c : dflt;
  const priceUp = s => Array.isArray(C.UP_COST) ? C.UP_COST[Math.min(s.tech || 0, C.UP_COST.length - 1)] : C.UP_COST;
  const priceTier = () => Array.isArray(C.SPONSOR_COST) ? C.SPONSOR_COST[Math.min(g.sponsorTier || 0, C.SPONSOR_COST.length - 1)] : C.SPONSOR_COST;
  const sponsorCap = () => S.sponsorCap ? S.sponsorCap(g) : 0;

  function order() {
    if (S.stationOrder) return S.stationOrder(g).filter(id => g.st[id]);
    // fallback for an older sim without stationOrder
    const pref = ['INTAKE', 'TRIAGE', 'FRAUD', 'EVID', 'PAYOPS', 'SPONSOR', 'SCHEME', 'MERCH', 'REPR', 'COMPL', 'ACQIN', 'MEVID', 'REPSUB', 'ACQW', 'RISK'];
    const ids = Object.keys(g.st).filter(id => g.st[id].unlocked);
    return pref.filter(id => ids.includes(id)).concat(ids.filter(id => !pref.includes(id)));
  }
  function can(action, id) {
    if (S.can) { try { return !!S.can(g, action, id); } catch (e) { return false; } }
    const s = g.st[id], n = s ? s.workers.length : 0;
    if (action === 'hire') return staffed(s) && n < (C.MAX_STAFF || 12) && g.cash >= (C.HIRE || 0);
    if (action === 'fire') return staffed(s) && n > 0;
    if (action === 'outsource') return staffed(s) && !!s.def.outsource && g.cash >= (C.TEMP_SETUP || 0) * 2;
    if (action === 'upgrade') return staffed(s) && !(s.tech >= 1) && g.cash >= priceUp(s);
    if (action === 'sponsor') return id === 'SPONSOR' && g.cash >= priceTier();
    return false;
  }

  // ---------------------------------------------------------------- sound: tiny WebAudio blips, muted by default
  const Snd = (() => {
    let ac = null, master = null, muted = true;
    const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
    function init() {
      if (ac) return;
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.18; master.connect(ac.destination); } catch (e) { ac = null; }
    }
    function tone(f, d, type, v, when) {
      if (!ac || muted) return;
      const t = ac.currentTime + (when || 0), o = ac.createOscillator(), gn = ac.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
      gn.gain.setValueAtTime(v == null ? 0.2 : v, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(gn); gn.connect(master); o.start(t); o.stop(t + d + 0.03);
    }
    const seq = (ns, d, type, v) => ns.forEach((n, i) => tone(mtof(n), d, type, v, i * d * 0.9));
    const SFX = {
      hire: () => seq([64, 71], 0.07), fire: () => seq([55, 48], 0.09, 'sawtooth', 0.12), up: () => seq([60, 64, 67, 72], 0.06),
      news: () => seq([72, 76], 0.07), event: () => seq([60, 58, 60, 58], 0.09, 'sawtooth', 0.12), good: () => seq([64, 68, 71, 76], 0.07),
      bad: () => seq([52, 47], 0.12, 'sawtooth', 0.15), hb: () => seq([79, 83], 0.06, 'triangle', 0.22),
      click: () => tone(880, 0.035, 'square', 0.08), start: () => seq([60, 67, 72, 76, 79], 0.08), pop: () => tone(1320, 0.03, 'triangle', 0.08),
      no: () => tone(140, 0.08, 'square', 0.1),
    };
    let lastPop = 0;
    return {
      play(n) { if (muted || !ac) return; if (n === 'pop') { const t = now(); if (t - lastPop < 90) return; lastPop = t; } (SFX[n] || SFX.click)(); },
      toggle() { init(); muted = !muted; if (ac && ac.state === 'suspended') ac.resume(); return muted; },
      get muted() { return muted; },
    };
  })();

  // ---------------------------------------------------------------- state
  let g = null, paused = false, hiddenPause = false, selected = null, endShown = false, wellsKey = '';
  let lastSetup = null, busyScreen = false;
  const screenQ = [];
  const vis = new WeakMap();     // case -> {y, vy, born}
  const pipBorn = new WeakMap(); // worker -> born time
  const fx = { moves: [], floats: [], bits: [] };
  const wellFx = {};             // id -> {unit, pulse, shakeT}
  let wells = [];                // layout: [{id, x, w, ext}]
  let LAYOUT = { W: 0, H: 0, wellTop: 0, wellH: 0, nameY: 0, pipY: 0, btnY: 0 };

  // ---------------------------------------------------------------- stage scaling and rotate prompt
  const stage = $('stage'), app = $('app'), cv = $('cv'), ctx = cv.getContext('2d');
  let scale = 1, dpr = 1, K = 1;
  function fit() {
    const cs = getComputedStyle(app);
    const aw = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    document.body.classList.toggle('portrait', ah > aw * 1.05 && Q.get('portrait') !== '0');
    scale = Math.max(0.2, Math.min(aw / STAGE_W, ah / STAGE_H));
    const ox = parseFloat(cs.paddingLeft) + (aw - STAGE_W * scale) / 2, oy = parseFloat(cs.paddingTop) + (ah - STAGE_H * scale) / 2;
    stage.style.transform = 'translate(' + Math.round(ox) + 'px,' + Math.round(oy) + 'px) scale(' + scale + ')';
    dpr = window.devicePixelRatio || 1;
    wellsKey = '';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 120));
  $('rot-go').onclick = () => { document.body.classList.add('force'); fit(); };

  // ---------------------------------------------------------------- wells layout (DOM hit areas and + buttons, canvas geometry)
  function layoutWells() {
    const ids = order();
    const key = ids.join(',') + '|' + scale + '|' + dpr + '|' + stage.className;
    if (key === wellsKey) return;
    const nStaffed = ids.filter(id => staffed(g.st[id])).length;
    const dense = ids.length > 8;
    stage.classList.toggle('dense', dense);
    stage.classList.toggle('n6', !dense);
    const host = $('wells'), W = host.clientWidth, H = host.clientHeight;
    wellsKey = ids.join(',') + '|' + scale + '|' + dpr + '|' + stage.className;
    cv.width = Math.max(1, Math.round(W * scale * dpr)); cv.height = Math.max(1, Math.round(H * scale * dpr));
    K = scale * dpr;
    const gap = ids.length <= 7 ? 8 : ids.length <= 10 ? 6 : 4;
    const extW = r => r * (nStaffed ? 0.5 : 1);
    let weight = 0; for (const id of ids) weight += staffed(g.st[id]) ? 1 : extW(1);
    let unitW = (W - gap * (ids.length - 1)) / weight;
    let x = 0;
    wells = ids.map(id => {
      const ext = !staffed(g.st[id]);
      let w = ext ? Math.max(22, unitW * extW(1)) : unitW;
      const o = { id, x: 0, w, ext };
      return o;
    });
    // re-normalise widths after the ext minimum
    const tot = wells.reduce((a, o) => a + o.w, 0) + gap * (ids.length - 1);
    const k = W / tot;
    for (const o of wells) { o.w = Math.floor(o.w * k); o.x = Math.round(x); x += o.w + gap; }
    const slack = W - (x - gap); if (wells.length && slack > 0) { const off = Math.floor(slack / 2); for (const o of wells) o.x += off; }
    const btnH = 44, pipH = 13, nameH = 11;
    LAYOUT = { W, H, wellTop: 0, btnY: H - btnH, pipY: H - btnH - 5 - pipH, nameY: H - btnH - 5 - pipH - 4 - nameH };
    LAYOUT.wellH = LAYOUT.nameY - 5;
    // DOM
    const hit = $('hit'), plus = $('plus');
    hit.innerHTML = ''; plus.innerHTML = '';
    for (const o of wells) {
      const s = g.st[o.id];
      const h = document.createElement('div');
      h.style.left = o.x + 'px'; h.style.width = o.w + 'px'; h.style.height = (o.ext ? H : LAYOUT.btnY - 2) + 'px';
      h.setAttribute('role', 'button'); h.setAttribute('aria-label', 'Select ' + s.def.name); h.dataset.id = o.id;
      h.addEventListener('pointerdown', ev => { ev.preventDefault(); select(o.id); });
      hit.appendChild(h);
      if (!o.ext) {
        const b = document.createElement('button');
        b.textContent = '+'; b.style.left = o.x + 'px'; b.style.width = o.w + 'px';
        b.setAttribute('aria-label', 'Hire one into ' + s.def.name); b.dataset.id = o.id;
        b.addEventListener('click', () => { select(o.id, true); doAct('hire'); });
        plus.appendChild(b); o.btn = b;
      }
      if (!wellFx[o.id]) wellFx[o.id] = { unit: 12, pulse: -1e9, shakeT: 0, lastFloat: 0 };
    }
    if (!selected || !g.st[selected] || !ids.includes(selected)) selected = (wells.find(o => !o.ext) || wells[0] || {}).id;
    panelKey = '';
  }
  const wellOf = id => wells.find(o => o.id === id);

  // ---------------------------------------------------------------- canvas drawing
  // all coordinates in stage CSS px; snapped to device pixels so edges stay crisp
  const sn = v => Math.round(v * K) / K;
  function R(x, y, w, h, col) { const x0 = sn(x), y0 = sn(y); ctx.fillStyle = col; ctx.fillRect(x0, y0, Math.max(1 / K, sn(x + w) - x0), Math.max(1 / K, sn(y + h) - y0)); }
  function dashH(x, y, w, col, th) { for (let i = 0; i < w; i += 6) R(x + i, y, Math.min(3, w - i), th || 2, col); }
  function dashV(x, y, h, col, th) { for (let i = 0; i < h; i += 6) R(x, y + i, th || 2, Math.min(3, h - i), col); }
  function fitText(txt, maxW, sizes, fam) {
    for (const sz of sizes) { ctx.font = sz + 'px ' + fam; if (ctx.measureText(txt).width <= maxW) return sz; }
    return sizes[sizes.length - 1];
  }
  function text(txt, x, y, col, size, fam, align) {
    ctx.font = size + 'px ' + fam; ctx.fillStyle = col; ctx.textAlign = align || 'center'; ctx.textBaseline = 'top';
    ctx.fillText(txt, sn(x), sn(y));
  }

  const noFlow = s => s.def.kind === 'policy';   // RISK: staffed, but no cases flow through it
  function jamCount(s) {
    if (noFlow(s)) return 0;
    if (staffed(s)) return (C.JAM || 3) * Math.max(1, s.workers.length);
    if (s.id === 'SPONSOR' && sponsorCap()) return Math.max(3, sponsorCap());
    return 0;
  }

  let lastFrame = 0;
  function drawWells(t, rdt) {
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.clearRect(0, 0, LAYOUT.W, LAYOUT.H);
    const flashOn = Math.floor(t / 280) % 2 === 0;
    for (const o of wells) drawWell(o, t, rdt, flashOn);
    drawMoves(t);
    drawBits(rdt);
    drawFloats(rdt);
  }

  function drawWell(o, t, rdt, flashOn) {
    const s = g.st[o.id], f = wellFx[o.id], sel = o.id === selected;
    const list = items(s), n = list.length, jc = jamCount(s);
    const over = jc > 0 && (o.ext ? (s.queue || []).length : n) > jc;
    const jammed = staffed(s) ? (s.pressure >= 3 || over) : over;
    let x = o.x, w = o.w;
    if (jammed && !reduced) x += (Math.floor(t / 70) % 4 === 0 ? 1 : Math.floor(t / 70) % 4 === 2 ? -1 : 0);
    const top = LAYOUT.wellTop, h = LAYOUT.wellH, bot = top + h;
    const border = jammed ? COL.coral : sel ? COL.orange : o.ext ? COL.shade : COL.sand;
    // walls: open top, 2px sides and floor; externals dashed
    if (o.ext) { dashV(x, top, h, border); dashV(x + w - 2, top, h, border); dashH(x, bot - 2, w, border); }
    else { R(x, top, 2, h, border); R(x + w - 2, top, 2, h, border); R(x, bot - 2, w, 2, border); }
    // hire pulse
    const pa = t - f.pulse;
    if (pa < 380 && !reduced) { const k = pa / 380; ctx.globalAlpha = 1 - k; R(x - 2, bot, w + 4, 2, COL.orange); R(x - 2, top + h * k, 2, h * (1 - k), COL.orange); R(x + w, top + h * k, 2, h * (1 - k), COL.orange); ctx.globalAlpha = 1; }
    // stack geometry: the jam line sits about 62% up; one block = jamH / jamCount, clamped
    const pad = o.w >= 40 ? 3 : 2, ix = x + 2 + pad, iw = w - 4 - pad * 2, ibot = bot - 2 - pad, ih = h - 2 - pad - 22;
    if (noFlow(s)) { // merchant risk: a cover gauge instead of a stack
      const cov = clamp(S.riskEff ? S.riskEff(g) : (s.util || 0), 0, 1);
      if (f.cov == null) f.cov = cov;
      f.cov += (cov - f.cov) * (reduced ? 1 : Math.min(1, rdt * 6));
      const fh = Math.round(ih * clamp(f.cov, 0, 1) / 4) * 4;
      for (let yy = 0; yy < fh; yy += 4) R(ix, ibot - yy - 3, iw, 3, cov < 0.4 ? COL.coral : COL.lucite);
      dashH(x + 2, ibot - ih * 0.4 - 1, w - 4, COL.shade, 1);
      text(Math.round(cov * 100) + '%', x + w / 2, top + 6, cov < 0.4 ? COL.coral : COL.lucite, o.w >= 40 ? 10 : 8, PX);
      drawLabel(o, s, x, w, sel);
      drawPips(s, x, w, t);
      return;
    }
    if (o.ext) { drawExt(o, s, x, w, t, flashOn, sel, ix, iw, ibot, ih, top); return; }
    const want = jc ? clamp(ih * 0.62 / jc, 3, 16) : clamp(ih / Math.max(12, n), 2, 12);
    f.unit += (want - f.unit) * (reduced ? 1 : Math.min(1, rdt * 8));
    let unit = f.unit;
    if (n * unit > ih) unit = ih / n;         // compress so blocks never escape the well
    const gapPx = unit >= 6 ? 2 : unit >= 3 ? 1 : 0;
    // sort for display: ordinary at the bottom, regulated above, complaints on top
    const rank = c => isComplaint(c, o.id) ? 2 : isReg(c) ? 1 : 0;
    const sorted = list.map((c, i) => [c, rank(c), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]);
    const G = 2200; // px/s^2 fall
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i][0]; if (!c || typeof c !== 'object') continue;
      let v = vis.get(c);
      const target = i * unit;
      if (!v) { v = { y: reduced ? target : Math.max(target, ih + 6 + (i - n) * 0), vy: 0 }; vis.set(c, v); }
      if (v.y > target) { v.vy += G * rdt; v.y -= v.vy * rdt; if (v.y <= target) { v.y = target; v.vy = 0; } }
      else { v.y = target; v.vy = 0; }
      if (v.y > ih + 8) v.y = ih + 8;
      const bh = Math.max(1, unit - gapPx);
      let col = caseCol(c, o.id);
      if (isLate(c)) col = flashOn || reduced ? COL.white : col;
      const yy = ibot - v.y - bh;
      if (yy < top - 4) continue;
      R(ix, yy, iw, bh, col);
      if (isLate(c) && reduced) R(ix + 1, yy + bh / 2 - 0.5, iw - 2, 1, COL.coral);
    }
    // jam line
    if (jc) {
      const ly = ibot - Math.min(ih, jc * unit) - 1;
      dashH(x + 2, ly, w - 4, over ? COL.sand : COL.coral, 2);
    }
    // count at the top
    const cnt = String(n);
    const fs = o.w >= 40 ? 10 : 8;
    ctx.font = fs + 'px ' + PX; const cw = ctx.measureText(cnt).width;
    R(x + w / 2 - cw / 2 - 3, top + 3, cw + 6, fs + 6, COL.black);
    text(cnt, x + w / 2, top + 6, over || jammed ? COL.coral : COL.sand, fs, PX);
    drawLabel(o, s, x, w, sel)
    // agents as pips, or the external's throughput
    if (staffed(s)) drawPips(s, x, w, t);
    else {
      const sub = o.id === 'SPONSOR' && sponsorCap() ? sponsorCap() + '/d' : '';
      if (sub && w >= 44) text(sub, x + w / 2, LAYOUT.pipY + 2, COL.shade, 9, SS);
    }
  }

  // External columns (sponsor bank, merchants, other banks) hold cases that are out of your hands for a
  // fixed time. A full book there is normal, so those cases are drawn small and dim, capped at about a
  // third of the column. Only the sponsor's waiting queue (cases beyond its daily filing cap) is drawn at
  // full strength with a jam line, because buying a faster tier is the one thing that fixes it.
  function drawExt(o, s, x, w, t, flashOn, sel, ix, iw, ibot, ih, top) {
    const flight = (s.list || []).map(e => e && e.c ? e.c : e).filter(c => c && typeof c === 'object');
    const wait = (s.queue || []).filter(c => c && typeof c === 'object');
    const cap = o.id === 'SPONSOR' ? sponsorCap() : 0;
    const rank = c => isComplaint(c, o.id) ? 2 : isReg(c) ? 1 : 0;
    const srt = a => a.map((c, i) => [c, rank(c), i]).sort((p, q) => p[1] - q[1] || p[2] - q[2]).map(r => r[0]);
    const fu = Math.min(4, ih * 0.3 / Math.max(1, flight.length));
    let y = 0;
    ctx.globalAlpha = 0.5;
    for (const c of srt(flight)) { const bh = Math.max(0.6, fu >= 3 ? fu - 1 : fu); R(ix, ibot - y - bh, iw, bh, COL.shade); y += fu; }
    ctx.globalAlpha = 1;
    const fh = y, room = Math.max(8, ih - fh);
    let wu = cap ? clamp(room * 0.5 / cap, 2, 8) : 6;
    if (wait.length * wu > room) wu = room / wait.length;
    const over = cap > 0 && wait.length > cap;
    srt(wait).forEach((c, i) => {
      const bh = Math.max(1, wu >= 4 ? wu - 1 : wu);
      let col = caseCol(c, o.id); if (isLate(c)) col = flashOn || reduced ? COL.white : col;
      R(ix, ibot - fh - i * wu - bh, iw, bh, col);
    });
    if (cap) dashH(x + 2, ibot - fh - Math.min(room, cap * wu) - 1, w - 4, over ? COL.sand : COL.coral, 2);
    const fs = o.w >= 40 ? 10 : 8;
    text(String(flight.length + wait.length), x + w / 2, top + 6, over ? COL.coral : COL.shade, fs, PX);
    drawLabel(o, s, x, w, sel);
    const sub = cap ? cap + '/d' : '';
    if (sub && w >= 44) text(sub, x + w / 2, LAYOUT.pipY + 2, over ? COL.coral : COL.shade, 9, SS);
  }

  function drawLabel(o, s, x, w, sel) {
    if (o.ext && w < 44) { // slim external: vertical label in the free space below (no + button there)
      const nm = shortOf(s), col = sel ? COL.orange : COL.shade;
      ctx.save(); ctx.translate(sn(x + w / 2 - 5), sn(LAYOUT.nameY)); ctx.rotate(Math.PI / 2);
      ctx.font = '9px ' + SS; ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(nm, 0, -10); ctx.restore();
      return;
    }
    const nm = o.w >= 76 ? (s.def.name.length <= 11 ? s.def.name : shortOf(s)) : shortOf(s);
    const nsz = fitText(nm, w + (o.ext ? 6 : 2), [10, 9], SS);
    text(nm, x + w / 2, LAYOUT.nameY, sel ? COL.orange : o.ext ? COL.shade : COL.sand, nsz, SS);
    if (sel) text(nm, x + w / 2 + 0.5, LAYOUT.nameY, COL.orange, nsz, SS); // faux bold
  }
  function drawPips(s, x, w, t) {
    const ws = s.workers, n = ws.length;
    const size = w >= 60 ? 5 : 4, gp = 2, per = Math.max(1, Math.floor((w - 4 + gp) / (size + gp)));
    const rows = Math.ceil(n / per);
    if (!n) { text('none', x + w / 2, LAYOUT.pipY + 2, COL.coral, 9, SS); return; }
    // if 2 rows will not fit, show a compact count
    if (rows > 2) { text(n + '', x + w / 2, LAYOUT.pipY + 2, COL.shade, 9, SS); return; }
    for (let r = 0; r < rows; r++) {
      const inRow = Math.min(per, n - r * per), rw = inRow * (size + gp) - gp, x0 = x + (w - rw) / 2;
      for (let i = 0; i < inRow; i++) {
        const wk = ws[r * per + i], px = x0 + i * (size + gp), py = LAYOUT.pipY + r * (size + 3);
        let born = pipBorn.get(wk); if (born == null) { born = t; pipBorn.set(wk, t); }
        const age = t - born;
        if (age < 260 && !reduced) { const k = age / 260; const e = size * (1.8 - 0.8 * k); ctx.globalAlpha = 0.4 + 0.6 * k; R(px + size / 2 - e / 2, py + size / 2 - e / 2, e, e, COL.orange); ctx.globalAlpha = 1; continue; }
        const col = wk.temp ? COL.tint : COL.sand;
        if (wk.ramp > 0) { // ramping up: dashed outline (corner pixels)
          const q = 1.5;
          R(px, py, q, q, col); R(px + size - q, py, q, q, col); R(px, py + size - q, q, q, col); R(px + size - q, py + size - q, q, q, col);
          if (wk.c) R(px + size / 2 - 0.75, py + size / 2 - 0.75, 1.5, 1.5, col);
        } else if (wk.c) R(px, py, size, size, col);
        else { ctx.globalAlpha = 0.3; R(px, py, size, size, col); ctx.globalAlpha = 1; }
      }
    }
  }

  // move events fly a block from the top of one well to the top of the next
  function wellTopPt(id) {
    const o = wellOf(id); if (!o) return null;
    return [o.x + o.w / 2, LAYOUT.wellTop + 30];
  }
  function drawMoves(t) {
    const dur = 420 / clamp(SPEED, 1, 2);
    fx.moves = fx.moves.filter(m => t - m.t0 < dur);
    for (const m of fx.moves) {
      const k = clamp((t - m.t0) / dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x = m.a[0] + (m.b[0] - m.a[0]) * e, arc = Math.min(28, Math.abs(m.b[0] - m.a[0]) * 0.35);
      const y = m.a[1] + (m.b[1] - m.a[1]) * e - Math.sin(Math.PI * e) * arc;
      R(x - 4, y - 3, 8, 6, m.col);
    }
  }
  function burst(x, y, col, n) {
    if (reduced) return;
    for (let i = 0; i < n && fx.bits.length < 120; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 50 + Math.random() * 70;
      fx.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.35 + Math.random() * 0.3, c: col });
    }
  }
  function drawBits(rdt) {
    for (const p of fx.bits) { p.t += rdt; p.x += p.vx * rdt; p.y += p.vy * rdt; p.vy += 260 * rdt; }
    fx.bits = fx.bits.filter(p => p.t < p.life);
    for (const p of fx.bits) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); R(p.x, p.y, 2, 2, p.c); }
    ctx.globalAlpha = 1;
  }
  function drawFloats(rdt) {
    for (const f of fx.floats) f.t += rdt;
    fx.floats = fx.floats.filter(f => f.t < 1.1);
    for (const f of fx.floats) {
      ctx.globalAlpha = Math.min(1, (1.1 - f.t) * 3);
      const y = f.y - (reduced ? 0 : f.t * 12);
      // narrow wells: drop the repeat count, then fall back to the narrower label font
      const o = wellOf(f.at), room = o ? o.w + 4 : 80;
      let fam = PX, sz = 8, txt = f.text;
      ctx.font = '8px ' + PX;
      if (ctx.measureText(txt).width > room) { txt = f.base; }
      if (ctx.measureText(txt).width > room) { fam = SS; sz = 9; ctx.font = '9px ' + SS; }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const tw = ctx.measureText(txt).width; const xx = clamp(f.x, tw / 2 + 1, LAYOUT.W - tw / 2 - 1);
      ctx.fillStyle = COL.black; ctx.fillRect(sn(xx - tw / 2 - 2), sn(y - 2), tw + 4, 12);
      text(txt, xx, y, f.col, sz, fam);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- next panel icon
  let nextKey = '';

  // ---------------------------------------------------------------- HUD and right rail
  let lastCash = null, cashFlashT = 0, heatBand = 0, panelKey = '';
  function setText(el, v) { if (el._v !== v) { el._v = v; el.textContent = v; } }
  function updateHud(t) {
    const cash = $('h-cash');
    setText(cash, fmt(g.cash));
    if (lastCash == null) lastCash = g.cash;
    if (Math.abs(g.cash - lastCash) >= 400) { cash.className = 'num ' + (g.cash > lastCash ? 'up' : 'dn'); cashFlashT = t; lastCash = g.cash; }
    else if (t - cashFlashT > 400) cash.className = 'num ' + (g.cash < 0 ? 'neg' : 'or');
    const cs = Math.round(g.csat), ht = Math.round(g.heat);
    setText($('h-csat'), String(cs)); $('h-csat').className = 'num ' + (cs <= 40 ? 'co' : cs <= 60 ? 'go' : '');
    $('h-csat-bar').style.width = cs + '%'; $('h-csat-bar').style.background = cs <= 40 ? COL.coral : cs <= 60 ? COL.gold : COL.lucite;
    setText($('h-heat'), ht + '%'); $('h-heat').className = 'num ' + (ht >= 50 ? 'co' : ht >= 30 ? 'go' : '');
    $('h-heat-bar').style.width = ht + '%'; $('h-heat-bar').style.background = ht >= 50 ? COL.coral : ht >= 30 ? COL.gold : COL.sand;
    const end = C.END_DAY || 40;
    setText($('h-day'), Math.min(end, Math.floor(g.t) + 1) + '/' + end);
    // heat edge
    const band = ht >= 90 ? 3 : ht >= 75 ? 2 : ht >= 50 ? 1 : 0, edge = $('edge');
    if (band > heatBand && !reduced) { edge.classList.remove('pulse'); void edge.offsetWidth; edge.classList.add('pulse'); }
    heatBand = band;
    edge.classList.toggle('h75', band === 2); edge.classList.toggle('h90', band === 3);
    // pause
    const pz = $('b-pause').querySelector('.pz');
    pz.classList.toggle('play', paused);
    $('b-pause').classList.toggle('on', paused);
    $('b-pause').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    // next panel
    const fc = S.forecast ? S.forecast(g) : null;
    const nk = fc ? fc.name + '|' + fc.daysAway + '|' + (fc.tip || '') : 'none';
    if (nk !== nextKey) {
      nextKey = nk;
      if (fc) {
        const d = Math.max(0, Math.ceil(fc.daysAway != null ? fc.daysAway : fc.day - g.t));
        setText($('next-name'), fc.name);
        setText($('next-when'), d <= 0 ? 'now' : d + 'd');
        setText($('next-tip'), fc.tip || '');
        $('next-when').style.color = d <= 2 ? COL.coral : COL.orange;
        $('next').setAttribute('aria-label', 'Next: ' + fc.name + (d <= 0 ? ' today' : ' in ' + d + (d === 1 ? ' day' : ' days')));
      } else {
        setText($('next-name'), S.forecast ? 'Clear to the end' : 'No forecast');
        setText($('next-when'), '');
        setText($('next-tip'), 'Keep every stack under the line.');
      }
    }
    coachTick(t);
    warnTick();
    updatePanel();
    // + buttons: grey when hire not allowed, highlight selected, pulse the one the coach points at
    for (const o of wells) if (o.btn) { const ok = can('hire', o.id); if (o.btn.disabled !== !ok) o.btn.disabled = !ok; o.btn.classList.toggle('sel', o.id === selected); o.btn.classList.toggle('coach', o.id === coach.target && ok); }
  }

  const shortMoney = n => { const a = Math.abs(n || 0); return a >= 1000 && stage.classList.contains('dense') ? '£' + (Math.round(a / 100) / 10).toString().replace(/\.0$/, '') + 'k' : fmt(n); };
  // One plain-words line on why the selected team is (or is not) a problem.
  function diagnose(s, list) {
    const d = s.def, n = s.workers.length, q = (s.queue || []).length;
    const late = list.filter(isLate).length, ramp = s.workers.filter(w => w.ramp > 0).length;
    if (s.id === 'SPONSOR') {
      const cap = sponsorCap();
      if (q > cap) return ['Files ' + cap + ' a day and ' + q + ' are waiting. Buy a faster tier.', 'co'];
      return ['Your partner bank files chargebacks for you. Normal, no action.', ''];
    }
    if (!staffed(s)) {
      if (s.id === 'MERCH') return ['Waiting for shops to reply. This takes days. Normal, no action.', ''];
      return ['With other banks for review. Normal, no action.', ''];
    }
    if (noFlow(s)) {
      const cov = clamp(S.riskEff ? S.riskEff(g) : s.util, 0, 1);
      if (cov < 0.4) return ['Cover is low, so risky shops cost you more. Hire 2 or 3.', 'co'];
      return ['Watching your shops for risk.', 'lu'];
    }
    if (!n && q) return ['Nobody works here. Tap + to hire.', 'co'];
    if (!n) return ['No staff yet. Hire before cases arrive.', 'go'];
    if (s.pressure >= (C.JAM || 3)) {
      if (ramp) return ['Over the line, but ' + ramp + ' new hire' + (ramp > 1 ? 's are' : ' is') + ' still learning.', 'go'];
      return ['Too few agents for ' + q + ' cases. ' + (d.outsource ? 'Hire or add temps.' : 'Hire more.'), 'co'];
    }
    if (s.stress > 0.75) return ['Overworked: agents may quit. Hire to share the load.', 'co'];
    if (late) return [late + ' late. Late cases cost happiness and heat.', 'co'];
    const err = S.teamErr ? S.teamErr(s) : 0;
    if (err > 0.16) return [Math.round(err * 100) + '% of work is redone. ' + (s.tech ? 'Stress and temps add errors.' : 'An upgrade cuts errors.'), 'go'];
    if (n > 2 && q === 0 && s.util < 0.35) return ['Mostly idle at ' + fmt(g.wage || C.WAGE) + ' a day each. Fire one?', 'go'];
    if (ramp) return [ramp + ' new hire' + (ramp > 1 ? 's' : '') + ' getting up to speed.', ''];
    return ['Keeping up.', 'lu'];
  }
  function updatePanel() {
    const s = g.st[selected]; if (!s) return;
    const d = s.def, n = s.workers.length, tmp = s.workers.filter(w => w.temp).length;
    const list = items(s), ext = !staffed(s);
    const late = list.filter(isLate).length;
    setText($('sel-name'), ((d.name && d.name.length <= 9 ? d.name : shortOf(s)) || '').toUpperCase());
    $('sel-name').style.color = COL.orange;
    const lbl = (id, v) => setText($(id), v);
    if (ext) {
      const q = (s.queue || []).length;
      lbl('sl-a', s.id === 'SPONSOR' ? 'Files' : 'Away'); setText($('ss-a'), s.id === 'SPONSOR' ? sponsorCap() + '/d' : String((s.list || []).length));
      lbl('sl-q', s.id === 'SPONSOR' ? 'Waiting' : 'Queue'); setText($('ss-q'), String(s.id === 'SPONSOR' ? q : 0));
      $('ss-q').className = jamCount(s) && q > jamCount(s) ? 'co' : '';
    } else {
      lbl('sl-a', 'Staff'); setText($('ss-a'), (n - tmp) + (tmp ? '+' + tmp + 't' : ''));
      lbl('sl-q', 'Queue'); setText($('ss-q'), String(noFlow(s) ? 0 : (s.queue || []).length));
      $('ss-q').className = !noFlow(s) && s.pressure >= (C.JAM || 3) ? 'co' : '';
    }
    lbl('sl-b', noFlow(s) ? 'Cover' : 'Busy');
    setText($('ss-b'), noFlow(s) ? Math.round(clamp(S.riskEff ? S.riskEff(g) : s.util, 0, 1) * 100) + '%' : Math.round((s.util || 0) * 100) + '%');
    $('ss-b').className = !noFlow(s) && n > 2 && s.util < 0.35 ? 'go' : '';
    setText($('ss-l'), String(late)); $('ss-l').className = late ? 'co' : '';
    $('sel-stats').classList.toggle('ext', ext);
    const why = diagnose(s, list), wEl = $('sel-why');
    setText(wEl, why[0]); if (wEl.className !== why[1]) wEl.className = why[1];
    const show = (id, on, label, pr, ok) => {
      const b = $(id); b.hidden = !on; if (!on) return;
      setText(b.firstElementChild, label); setText(b.lastElementChild, pr);
      if (b.disabled !== !ok) b.disabled = !ok;
    };
    const up = s.tech >= 1;
    show('b-fire', !ext, 'Fire', shortMoney(C.FIRE), can('fire', selected));
    show('b-temp', !ext && !!d.outsource, '2 temps', shortMoney((C.TEMP_SETUP || 0) * 2), can('outsource', selected));
    show('b-up', !ext, up ? 'Upgraded' : 'Upgrade', up ? '' : shortMoney(priceUp(s)), !up && can('upgrade', selected));
    const tierMax = Array.isArray(C.SPONSOR_COST) && (g.sponsorTier || 0) >= C.SPONSOR_COST.length;
    show('b-tier', selected === 'SPONSOR', tierMax ? 'Top tier' : 'Faster tier', tierMax ? '' : shortMoney(priceTier()), !tierMax && can('sponsor', selected));
  }

  // ---------------------------------------------------------------- first-minute coaching
  // One short gold hint line at a time (it takes over the ticker) plus a pulsing + on the well that needs
  // a hire. It stops after a few helpful hires, or by day 10, whichever comes first.
  const coach = { msg: '', target: null, hits: 0, done: false, once: {}, tempMsg: '', tempUntil: 0 };
  function needHire(id) {
    const s = g.st[id]; if (!s || !staffed(s) || noFlow(s)) return 0;
    const n = s.workers.length, q = (s.queue || []).length;
    if (!n && q) return 2 + q;
    if (n && s.pressure >= (C.JAM || 3) && !s.workers.some(w => w.ramp > 0)) return 1 + s.pressure / 10;
    return 0;
  }
  function coachTick(t) {
    coach.target = null; coach.msg = '';
    if (coach.done || g.over) return;
    if (coach.hits >= 4 || g.t >= 10) { coach.done = true; return; }
    if (coach.tempMsg && t < coach.tempUntil) { coach.msg = coach.tempMsg; }
    let best = null, bv = 0;
    for (const o of wells) { const v = needHire(o.id); if (v > bv) { bv = v; best = o.id; } }
    if (best) {
      coach.target = best;
      const s = g.st[best], nm = s.def.name;
      if (!coach.msg) coach.msg = !s.workers.length
        ? (coach.hits === 0 ? 'Cases are piling up in ' + nm + '. Tap + to hire someone (' + fmt(C.HIRE) + ').' : 'Cases have reached ' + nm + '. Nobody works there yet. Tap + to hire.')
        : nm + ' is over the dashed line. Tap + to hire another agent.';
    } else if (!coach.hits && g.t < 1.5) {
      // before the first case lands: point at the first team
      const first = wells.find(o => !o.ext);
      if (first) { coach.target = first.id; if (!coach.msg) coach.msg = 'Disputes arrive at ' + g.st[first.id].def.name + ' first. Tap + to hire someone (' + fmt(C.HIRE) + ').'; }
    } else if (!coach.msg && coach.hits && !coach.once.line) {
      coach.once.line = true; coach.tempMsg = 'Good. Keep every stack below its dashed line.'; coach.tempUntil = t + 4000; coach.msg = coach.tempMsg;
    }
    if (RISK_HINT() && !coach.once.risk) { coach.once.risk = true; coach.tempMsg = 'Merchant risk has no stack: hire 2 or 3 there to cover your shops.'; coach.tempUntil = t + 5000; }
  }
  const RISK_HINT = () => g.st.RISK && !g.st.RISK.workers.length && g.t > 1.5;
  function coachHire(id, t) {
    if (coach.done) return;
    if (id === coach.target) {
      coach.hits++;
      if (coach.hits === 1) { coach.tempMsg = 'Hired. New agents take about 2 days to reach full speed.'; coach.tempUntil = t + 3500; }
    }
  }
  // Loss warnings: a line under cash and heat, and one pause card at the halfway mark to each loss.
  const warned = { heat50: false, cash: false };
  function warnTick() {
    const floor = C.CASH_FLOOR || -25000, hm = C.HEAT_MAX || 100;
    const cw = $('h-cash-w'), hw = $('h-heat-w');
    setText(cw, g.cash < 0 ? 'Bankrupt at\n' + fmt(floor) : g.cash < 6000 && g.t > 2 ? 'Running low' : '');
    cw.className = 'warn' + (g.cash < 0 ? '' : ' go');
    setText(hw, g.heat >= 25 ? 'Shut down at\n' + hm + '%' : '');
    hw.className = 'warn' + (g.heat >= 50 ? '' : ' go');
    if (!warned.heat50 && g.heat >= hm / 2 && !g.over) {
      warned.heat50 = true;
      screenQ.push({ kind: 'banner', ev: { k: 'banner', text: 'The regulator is watching', sub: 'Regulator heat is at ' + Math.round(g.heat) + '%. It rises every day that cases sit past their deadline, fastest for fraud and scam refunds. At 100% you are shut down.', tip: 'Find the stacks over their dashed line and hire there. Heat cools by itself once cases are on time.' } });
    }
    if (!warned.cash && g.cash < floor * 0.6 && !g.over) {
      warned.cash = true;
      screenQ.push({ kind: 'banner', ev: { k: 'banner', text: 'Nearly bankrupt', sub: 'Cash is ' + fmt(g.cash) + '. At ' + fmt(floor) + ' the board closes the operation.', tip: 'Tap each team and check Busy: fire agents on quiet teams, hold off on upgrades, and let temps cover surges.' } });
    }
    if (g.cash > 0) warned.cash = false;
  }

  // ---------------------------------------------------------------- ticker
  const tk = { q: [], shownAt: 0, cur: null };
  function ticker(textv, kind, prio) {
    if (!textv) return;
    textv = String(textv).replace(/\s+/g, ' ').trim();
    if (!prio && tk.q.length >= 3) return;          // drop low-priority chatter when backed up
    if (tk.q.length >= 6) tk.q.shift();
    tk.q.push({ text: textv.charAt(0).toUpperCase() + textv.slice(1).toLowerCase().replace(/\bfca\b/g, 'FCA').replace(/\bapp\b/g, 'APP').replace(/\bsla\b/g, 'SLA').replace(/\buk\b/g, 'UK'), kind: kind || 'info' });
  }
  function updateTicker(t) {
    const el = $('ticker'), tx = $('tk-text');
    if (coach.msg && !paused) {
      if (tx.textContent !== coach.msg) tx.textContent = coach.msg;
      if (el.className !== 'coach') el.className = 'coach';
      return;
    }
    const minShow = tk.q.length > 1 ? 1300 : 2400;
    if (tk.q.length && (!tk.cur || t - tk.shownAt > minShow)) {
      tk.cur = tk.q.shift(); tk.shownAt = t;
      tx.textContent = tk.cur.text; el.className = (tk.cur.kind || 'info') + ' fresh';
      setTimeout(() => el.classList.remove('fresh'), 300);
      return;
    }
    if (tk.cur && t - tk.shownAt < 5000) return;
    tk.cur = null;
    // idle: show the worst well
    let worst = null, wl = 0;
    for (const o of wells) {
      const s = g.st[o.id], jc = jamCount(s), n = staffed(s) ? items(s).length : (s.queue || []).length;
      if (jc && n > jc && (!worst || n / jc > wl)) { worst = s; wl = n / jc; }
    }
    let msg, kind;
    if (worst) { const late = items(worst).filter(isLate).length; msg = worst.def.name + ' is over the line' + (late ? ' · ' + late + ' late' : ''); kind = 'bad'; }
    else if (paused) { msg = 'Paused'; kind = 'info'; }
    else { msg = 'Cases move left to right'; kind = 'info'; }
    if (tx.textContent !== msg) tx.textContent = msg;
    if (el.className !== kind) el.className = kind;
  }

  // ---------------------------------------------------------------- events
  function drain() {
    if (!g || !g.ev || !g.ev.length) return;
    const t = now(), evs = g.ev.splice(0, g.ev.length);
    let moves = 0;
    for (const e of evs) {
      switch (e.k) {
        case 'news': ticker(e.text, e.kind === 'bad' ? 'bad' : e.kind === 'good' ? 'good' : e.kind === 'event' ? 'event' : e.kind === 'hb' ? 'hb' : 'info', true); break;
        case 'story': ticker(e.text, e.tone === 'good' ? 'good' : e.tone === 'bad' ? 'bad' : 'info', false); break;
        case 'hb': {
          const h = D.HANDBOOK && D.HANDBOOK[e.id], title = h ? (Array.isArray(h) ? h[0] : h.title || h.name) : '';
          ticker('Handbook entry unlocked' + (title ? ': ' + title : ''), 'hb', true);
          const b = $('b-hb'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 1200);
          break;
        }
        case 'sfx': Snd.play(e.name); break;
        case 'move': {
          if (!e.from || e.from === e.to || moves > 12 || fx.moves.length > 40 || reduced) break;
          const a = wellTopPt(e.from), b = wellTopPt(e.to); if (!a || !b) break;
          fx.moves.push({ a, b, col: palCol(e.col, COL.orange), t0: t + moves * 30 }); moves++;
          break;
        }
        case 'float': {
          const o = wellOf(e.at); if (!o) break;
          const txt = String(e.text || ''), col = /^\+/.test(txt) ? COL.lucite : /^-/.test(txt) ? COL.coral : COL.gold;
          // one float per label per well at a time: repeats bump a counter instead of piling up
          const live = fx.floats.filter(f => f.at === o.id);
          const word = !/^[+-]/.test(txt);
          const same = live.find(f => (word ? f.base === txt : /^[+-]/.test(f.base) && f.base[0] === txt[0]) && f.t < 0.7);
          if (same) {
            if (word) { same.k++; same.text = txt + ' x' + same.k; }
            else { same.sum += parseFloat(txt.replace(/[^0-9.]/g, '')) || 0; same.text = txt[0] + fmt(same.sum).replace('-', ''); }
            same.t = Math.min(same.t, 0.25);
          } else if (live.length < 3 && fx.floats.length < 18) {
            // start below the count at the top of the well and stack downwards, so nothing covers the count
            const slot = [0, 1, 2].find(k => !live.some(f => f.slot === k));
            fx.floats.push({ at: o.id, slot, base: txt, k: 1, sum: parseFloat(txt.replace(/[^0-9.]/g, '')) || 0, x: o.x + o.w / 2, y: LAYOUT.wellTop + 36 + slot * 14, text: txt, col, t: 0 });
          }
          burst(o.x + o.w / 2, LAYOUT.wellTop + 34, col, 6);
          break;
        }
        case 'closed': {
          const o = wellOf(e.at) || wellOf(e.from) || null;
          if (o) burst(o.x + o.w / 2, LAYOUT.wellTop + 30, COL.lucite, 4);
          Snd.play('pop');
          break;
        }
        case 'banner': screenQ.push({ kind: 'banner', ev: e }); break;
        case 'escalate': screenQ.push({ kind: 'escalate', id: e.id }); break;
      }
    }
  }

  // ---------------------------------------------------------------- Screens bridge
  const hasScreens = () => Q.get('screens') !== '0' && !!(window.Screens && typeof window.Screens.isOpen === 'function');
  const screenOpen = () => busyScreen || (hasScreens() && Screens.isOpen());
  function pumpScreens() {
    if (!g || screenOpen()) return;
    if (g.over && !endShown) { showEnd(); return; }
    if (!screenQ.length) return;
    const job = screenQ.shift();
    const done = () => { busyScreen = false; drain(); lastT = now(); };
    if (!hasScreens()) { // fallback: auto-dismiss, auto-answer
      if (job.kind === 'banner') ticker(job.ev.text + (job.ev.sub ? ': ' + job.ev.sub : ''), job.ev.good ? 'good' : 'bad', true);
      else if (job.kind === 'escalate') autoAnswer();
      return;
    }
    busyScreen = true;
    try {
      if (job.kind === 'banner') Screens.banner(job.ev, done);
      else if (job.kind === 'escalate') Screens.escalate(g, job.id, done);
      else if (job.kind === 'handbook') Screens.handbook(g, done);
      else busyScreen = false;
    } catch (err) { console.error(err); busyScreen = false; }
  }
  function autoAnswer() {
    const cur = g.clinic && g.clinic.cur; if (!cur || !D.CLINIC) return;
    const sc = D.CLINIC.find(x => x.id === cur.id); if (!sc) return;
    const i = Math.max(0, sc.opts.findIndex(o => o.ok));
    try { S.act.answerClinic(g, i); } catch (e) { /* ignore */ }
  }
  function showEnd() {
    endShown = true; screenQ.length = 0;
    const sc = S.score ? S.score(g) : null;
    if (!hasScreens()) { ticker('Run over (' + g.over.kind + ')' + (sc ? ': grade ' + sc.grade : '') + '. Press R to replay.', 'event', true); return; }
    busyScreen = true;
    try {
      Screens.end(g, sc, choice => { busyScreen = false; if (choice === 'replay' || choice == null) startFlow(); });
    } catch (err) { console.error(err); busyScreen = false; }
  }
  function startFlow() {
    stage.classList.add('hide');
    if (!hasScreens()) { newGame(lastSetup || { difficulty: Q.get('difficulty') || 'easy' }); return; }
    busyScreen = true;
    try {
      Screens.start(setup => { busyScreen = false; newGame(setup || {}); });
    } catch (err) { console.error(err); busyScreen = false; newGame({}); }
  }

  // ---------------------------------------------------------------- actions and input
  function select(id, quiet) {
    if (!g || !g.st[id]) return;
    if (selected !== id) { selected = id; panelKey = ''; updatePanel(); if (!quiet) Snd.play('click'); }
  }
  function doAct(kind) {
    if (!g || g.over || screenOpen()) return false;
    const id = selected, s = g.st[id]; if (!s) return false;
    let ok = false;
    try {
      if (kind === 'hire') ok = S.act.hire(g, id);
      else if (kind === 'fire') ok = S.act.fire(g, id);
      else if (kind === 'temps') ok = S.act.outsource(g, id, 2);
      else if (kind === 'upgrade') ok = S.act.upgrade(g, id);
      else if (kind === 'sponsor') ok = S.act.sponsor(g);
    } catch (e) { console.error(e); }
    if (ok) {
      const f = wellFx[id]; if (f && (kind === 'hire' || kind === 'temps' || kind === 'upgrade')) f.pulse = now();
      if (kind === 'hire' || kind === 'temps') coachHire(id, now());
      flashBtn(kind);
      Snd.play(kind === 'fire' ? 'fire' : kind === 'upgrade' || kind === 'sponsor' ? 'up' : 'hire');
      try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* unsupported */ }
    } else Snd.play('no');
    drain(); updatePanel();
    return ok;
  }
  // immediate feedback on the rail button that was used
  function flashBtn(kind) {
    const id = { fire: 'b-fire', temps: 'b-temp', upgrade: 'b-up', sponsor: 'b-tier' }[kind]; if (!id) return;
    const b = $(id); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
  }
  $('b-fire').onclick = () => doAct('fire');
  $('b-temp').onclick = () => doAct('temps');
  $('b-up').onclick = () => doAct('upgrade');
  $('b-tier').onclick = () => doAct('sponsor');
  function togglePause() { paused = !paused; hiddenPause = false; Snd.play('click'); }
  $('b-pause').onclick = togglePause;
  $('b-snd').onclick = () => {
    const m = Snd.toggle(), b = $('b-snd');
    b.textContent = m ? 'Mute' : 'Sound'; b.classList.toggle('on', !m); b.setAttribute('aria-pressed', String(!m)); b.setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
    Snd.play('click');
  };
  $('b-hb').onclick = () => { if (!g || screenOpen()) return; if (hasScreens()) { screenQ.unshift({ kind: 'handbook' }); pumpScreens(); } else ticker('Handbook: ' + (g.hb ? g.hb.size : 0) + ' entries unlocked', 'hb', true); };
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#app button'); if (b) b.blur(); });
  window.addEventListener('keydown', e => {
    if (!g || e.metaKey || e.ctrlKey || e.altKey) return;
    if (screenOpen()) return;
    const k = e.key.toLowerCase();
    if (k === 'r' && g.over && !hasScreens()) { startFlow(); return; }
    const ids = wells.map(o => o.id), i = ids.indexOf(selected);
    if (k === 'arrowright') { select(ids[(i + 1) % ids.length]); e.preventDefault(); }
    else if (k === 'arrowleft') { select(ids[(i - 1 + ids.length) % ids.length]); e.preventDefault(); }
    else if (k === 'h') doAct('hire');
    else if (k === 'f') doAct('fire');
    else if (k === 't') doAct('temps');
    else if (k === 'u') doAct(selected === 'SPONSOR' ? 'sponsor' : 'upgrade');
    else if (k === ' ') { togglePause(); e.preventDefault(); }
    else if (k === 'm') $('b-snd').click();
    else if (k === 'b') $('b-hb').click();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !paused) { paused = true; hiddenPause = true; }
    lastT = now();
  });

  // ---------------------------------------------------------------- game lifecycle
  function newGame(setup) {
    lastSetup = setup;
    const opts = { difficulty: setup.difficulty || Q.get('difficulty') || 'easy' };
    if (setup.policies) opts.policies = setup.policies;
    if (Q.has('seed')) opts.seed = +Q.get('seed');
    g = S.create(opts);
    endShown = false; busyScreen = false; screenQ.length = 0; paused = false; selected = null; lastCash = null; heatBand = 0;
    fx.moves.length = 0; fx.floats.length = 0; fx.bits.length = 0; tk.q.length = 0; tk.cur = null; nextKey = '';
    for (const k in wellFx) delete wellFx[k];
    wellsKey = '';
    stage.classList.remove('hide');
    layoutWells();
    Snd.play('start');
    coach.hits = 0; coach.done = !!Q.get('nocoach'); coach.once = {}; coach.tempMsg = ''; coach.target = null; coach.msg = '';
    warned.heat50 = false; warned.cash = false;
    window.__game = { g, S, D };
    lastT = now();
  }

  // debug: run the sim forward with a simple bot that hires where stacks pass the line
  function skipDays(days) {
    const steps = Math.round(days / STEP);
    for (let i = 0; i < steps && !g.over; i++) {
      S.step(g, STEP);
      if (i % 25 === 0) {
        for (const id of order()) {
          const s = g.st[id];
          if (staffed(s) && (s.pressure > 2 || (!s.workers.length && s.queue.length)) && s.workers.length < (C.MAX_STAFF || 12)) { try { S.act.hire(g, id); } catch (e) { /* ignore */ } }
        }
        if (g.clinic && g.clinic.cur) autoAnswer();
        g.ev.length = 0;
      }
    }
    g.ev.length = 0;
  }

  function applyDebug() {
    const skip = +Q.get('skip') || 0;
    if (skip) skipDays(skip);
    if (Q.has('cash')) g.cash = +Q.get('cash');
    g.ev.length = 0; screenQ.length = 0;
    // seed the visual state so a skipped run does not start with every block falling
    for (const o of wells) {
      const s = g.st[o.id];
      for (const c of items(s)) if (c && typeof c === 'object') vis.set(c, { y: 0, vy: 0 });
      for (const w of s.workers || []) pipBorn.set(w, -1e9);
    }
    const m = Q.get('modal');
    if (m === 'end') { g.over = g.over || { kind: 'end' }; }
    else if (m === 'event') screenQ.push({ kind: 'banner', ev: { k: 'banner', text: 'Black Friday', sub: 'Everyone shops, everyone disputes. Volumes spike for three days.', tip: 'Hire or bring in temps before stacks pass the line.', good: false } });
    else if (m === 'clinic' && D.CLINIC && D.CLINIC.length) { if (g.clinic) g.clinic.cur = { id: D.CLINIC[0].id }; screenQ.push({ kind: 'escalate', id: D.CLINIC[0].id }); }
    else if (m === 'hb') screenQ.push({ kind: 'handbook' });
    if (Q.has('paused')) paused = true;
    if (Q.has('select') && g.st[Q.get('select')]) selected = Q.get('select');
  }

  // ---------------------------------------------------------------- frame loop
  let lastT = now(), acc = 0, hudT = -1e9, frames = 0, fpsT = 0, fpsN = 0, fps = 0;
  const dbg = Q.get('debug') === '1';
  function frame(t) {
    requestAnimationFrame(frame);
    const rdt = Math.min(0.1, Math.max(0, (t - lastT) / 1000)); lastT = t;
    if (!g) return;
    layoutWells();
    pumpScreens();
    const halted = paused || screenOpen() || !!g.over || (document.body.classList.contains('portrait') && !document.body.classList.contains('force'));
    if (!halted) {
      acc += rdt * SPEED / DAY_SEC;
      let guard = 0;
      while (acc >= STEP && guard++ < 200 && !g.over) { S.step(g, STEP); acc -= STEP; }
      if (guard >= 200) acc = 0;
    } else acc = 0;
    drain();
    drawWells(t, halted ? 0 : rdt);   // motion freezes while paused or a card is open
    if (t - hudT > 100 || halted) { updateHud(t); hudT = t; }
    updateTicker(t);
    if (g.over && !endShown) pumpScreens();
    frames++; fpsN++;
    if (t - fpsT > 1000) { fps = Math.round(fpsN * 1000 / (t - fpsT)); fpsN = 0; fpsT = t; }
    if (dbg) { const e = $('errs'); e.hidden = false; e.textContent = 'frames ' + frames + ' fps ' + fps + ' day ' + g.t.toFixed(2) + ' blocks ' + wells.reduce((a, o) => a + items(g.st[o.id]).length, 0) + (window.__errs && window.__errs.length ? '\n' + window.__errs.join('\n') : ''); }
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    fit();
    const auto = Q.get('autostart') === '1' || !hasScreens();
    if (auto) {
      newGame({ difficulty: Q.get('difficulty') || 'easy' });
      applyDebug();
    } else startFlow();
    requestAnimationFrame(t => { lastT = t; frame(t); });
  }
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.race([Promise.all([document.fonts.load('10px "Press Start 2P"'), document.fonts.load('10px Silkscreen')]), new Promise(r => setTimeout(r, 1500))])
    : Promise.resolve();
  fontsReady.then(boot, boot);
})();
