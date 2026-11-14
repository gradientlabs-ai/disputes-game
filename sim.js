// Dispute Factory v1 simulation core. No DOM. Time unit: one game day (= one business day).
(function (root) {
  'use strict';
  const D = typeof require !== 'undefined' && typeof module !== 'undefined' ? require('./data.js') : root.GAMEDATA;

  // Per-difficulty tuning. era is fixed for the run. base/growth: arrivals per day at t=0 and growth per day.
  // rev: revenue per unit of base arrival rate per day. fixed: daily fixed cost. profit: profit target for full points.
  const DIFF = {
    easy:   { era: 1, cash: 30000, base: 9,  growth: 0.32, rev: 215, wage: 120, fixed: 0,   acqBase: 0,   acqRev: 0,    acqGrowth: 0,  profit: 30000 },
    medium: { era: 2, cash: 40000, base: 12, growth: 0.40, rev: 272, wage: 120, fixed: 280, acqBase: 0,   acqRev: 0,    acqGrowth: 0,  profit: 35000 },
    hard:   { era: 3, cash: 50000, base: 12, growth: 0.40, rev: 270, wage: 120, fixed: 500, acqBase: 7, acqRev: 1500, acqGrowth: 10, profit: 40000 },
  };

  const C = {
    WEEKS: 8, DPW: 5, END_DAY: 40,
    WAGE: 120, HIRE: 500, FIRE: 300, MAX_STAFF: 12, CASH_FLOOR: -25000, HEAT_MAX: 100,
    START_CASH: DIFF.easy.cash,
    SPONSOR_FEE: 11, SCHEME_FEE: 3, PREARB_FEE: 450, FOS_FEE: 700, REPSUB_FEE: 4,
    SPONSOR_BASE: 8, SPONSOR_STEP: 5, SPONSOR_COST: [2500, 5000, 9000],
    UP_COST: 9000, UP_LIC: 70, UP_SPEED: 2.0,
    MEMBERSHIP: 280, ACQ_COMPLIANCE: 220,
    TEMP_WAGE: 70, TEMP_SETUP: 150, TEMP_DAYS: 6, TEMP_SPEED: 0.65, MAX_TEMPS: 4, TEMP_RAMP: 0.5,
    HIRE_RAMP: 2, RAMP_SPEED: 0.4,
    HEAT_COOL: 1, CSAT_START: 75, CSAT_REST: 68, CSAT_UP: 0.3, CSAT_FULL: 90, CREDIT_VOL: 1.05, CSAT_DRIFT: 0.08,
    STRESS_UP: 0.2, STRESS_DOWN: 0.1, BURNOUT_AT: 0.75, BURNOUT_P: 0.3,
    JAM: 3, CLINIC_FIRST: 4, CLINIC_GAP: 4, CLINIC_RIGHT: 800, CLINIC_WRONG: 600,
    GRADES: { S: 81, A: 70, B: 57, C: 44 }, MAX_PTS: 96,
    COL: { ordinary: '#FF8933', regulated: '#F27C71', complaint: '#FFED77', good: '#7ACBA7', bad: '#F27C71', warn: '#FFED77' },
    DIFF,
  };
  const OPEX = { wages: 1, tech: 1, fees: 1, arb: 1, fixed: 1 };
  const REGULATED = { FRAUD: 1.4, APP: 2.2, DD: 1.4, COMP: 1 };

  // Left-to-right flow order and which stations each era runs.
  const ORDER = ['INTAKE', 'TRIAGE', 'FRAUD', 'PAYOPS', 'EVID', 'SPONSOR', 'SCHEME', 'MERCH', 'REPR', 'COMPL', 'ACQIN', 'MEVID', 'REPSUB', 'ACQW', 'RISK'];
  const ERA_STATIONS = {
    1: ['INTAKE', 'TRIAGE', 'FRAUD', 'EVID', 'SPONSOR', 'MERCH', 'COMPL'],
    2: ['INTAKE', 'TRIAGE', 'FRAUD', 'PAYOPS', 'EVID', 'SCHEME', 'MERCH', 'REPR', 'COMPL'],
    3: ['INTAKE', 'TRIAGE', 'FRAUD', 'PAYOPS', 'EVID', 'SCHEME', 'MERCH', 'REPR', 'COMPL', 'ACQIN', 'MEVID', 'REPSUB', 'ACQW', 'RISK'],
  };
  const POLICY_DEFAULT = { queue: 'edf', credit: 'regulated', risk: 'strict' };
  const POLICY_VALUES = { queue: ['fifo', 'edf', 'regulated'], credit: ['always', 'regulated'], risk: ['strict', 'lenient'] };

  let rand = Math.random;
  function seed(n) {
    let a = n >>> 0;
    rand = function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = (a, b) => a + rand() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const chance = p => rand() < p;
  function pickW(w) {
    let tot = 0; for (const k in w) tot += w[k];
    let r = rand() * tot;
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return Object.keys(w)[0];
  }
  function poisson(l) {
    const L = Math.exp(-l); let k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L && k < 50);
    return k - 1;
  }
  function gauss() { return (rand() + rand() + rand() + rand() - 2) * 1.7; }

  // Scheduled events. minEra filters them by difficulty.
  const EVENTS = [
    { day: 5, minEra: 1, name: 'Retailer data breach', tip: 'Fraud claims surge. Staff Triage and Fraud ops now: unauthorised payments must be refunded by the end of the next business day.', text: 'A big retailer leaks card data. Unauthorised-payment claims surge.', dur: 3, mods: { FRAUD: 4 }, vol: 1.4 },
    { day: 9, minEra: 1, name: 'Flu season', tip: 'Everyone works 25% slower for 2 days. Expect queues, and hire early if you can.', text: 'Half the office is coughing. Everyone works slower for 2 days.', dur: 2, spd: 0.75 },
    { day: 15, minEra: 1, name: 'Airline collapses', tip: 'Review will jam first. For debit cards the chargeback is the route; credit cards also have Section 75.', text: 'An airline goes into administration. Non-delivery claims flood in.', dur: 3, mods: { GNR: 5 }, vol: 1.8, hb: 'chargeback' },
    { day: 20, minEra: 1, name: 'Black Friday', tip: 'Volume doubles for four days. New hires take two days to get up to speed, so hire before the queues build.', text: 'Everyone shops, everyone disputes. Volumes spike.', dur: 4, mods: { DUP: 2, GNR: 1.5 }, vol: 2.1 },
    { day: 27, minEra: 2, name: 'Scam wave', tip: 'Customers are being tricked into sending money. Expect APP scam claims at Payments ops, with a 5 day deadline.', text: 'A bank-impersonation campaign hits customers. APP scam claims surge.', dur: 3, mods: { APP: 4, FRAUD: 1.5 }, vol: 1.2 },
    { day: 31, minEra: 3, name: 'Travelkite collapses', tip: 'A merchant you acquire has failed. Its chargebacks are now your loss, softened only by Merchant risk cover.', text: 'Travelkite Air fails with outstanding orders. A burst of chargebacks hits you as its acquirer.', dur: 3, mods: { GNR: 2 }, special: 'travelkite' },
    { day: 35, minEra: 1, name: 'Regulator review', tip: 'The FCA checks your heat. Above 40%: an £8,000 fine. Otherwise a £3,000 grant. Either way heat falls.', text: 'The FCA is reviewing your complaint and refund handling.', dur: 0, special: 'fca' },
  ];

  function create(opts) {
    opts = opts || {};
    if (opts.seed != null) seed(opts.seed);
    const difficulty = DIFF[opts.difficulty] ? opts.difficulty : 'easy';
    const P = DIFF[difficulty];
    const pin = opts.policies || {};
    const policies = {};
    for (const k in POLICY_DEFAULT) policies[k] = POLICY_VALUES[k].indexOf(pin[k]) >= 0 ? pin[k] : POLICY_DEFAULT[k];
    Object.freeze(policies);
    const g = {
      difficulty, era: P.era, policies, P, startCash: P.cash, wage: P.wage,
      t: 0, day: 0, cash: P.cash, csat: C.CSAT_START, heat: 0,
      nid: 0, openN: 0, closed: 0, closedDay: 0, opexDay: 0, cbFiled: 0, costLog: [],
      over: null, ev: [], headless: !!opts.headless,
      hb: new Set(), active: [], speedMod: 1,
      out: { early: 0, merch: 0, won: 0, lost: 0, declined: 0, absorbed: 0, reimb: 0, complaint: 0, acqWon: 0, acqLost: 0 },
      sla: [], slaOk: 0, slaBad: 0, fin: {}, sponsorTier: 0,
      bounce: [], st: {}, acqLog: [0],
      clinic: { next: C.CLINIC_FIRST, cur: null, used: new Set(), right: 0, wrong: 0, missed: 0 },
      merch: [
        { name: 'BigBox Retail', quality: 0.7, share: 0.35, base: 0.3, cbWin: 0 },
        { name: 'Happy Hotels', quality: 0.6, share: 0.2, base: 0.4, cbWin: 0 },
        { name: 'Travelkite Air', quality: 0.5, share: 0.15, base: 0.5, cbWin: 0, insolvent: false },
        { name: 'StreamBox TV', quality: 0.4, share: 0.2, base: 1.1, cbWin: 0 },
        { name: 'Gadget Giant', quality: 0.55, share: 0.1, base: 0.5, cbWin: 0 },
      ],
      fineGiven: -99, eff: { paid: 0, busy: 0 }, tips: new Set(), storySeen: new Set(),
    };
    for (const id of ERA_STATIONS[g.era]) {
      const def = D.STATIONS[id];
      g.st[id] = { id, def, unlocked: true, workers: [], queue: [], list: [], tech: 0, stress: 0, util: 0, pressure: 0, tokens: 0 };
    }
    if (g.era >= 2) unlock(g, 'issuer');
    if (g.era >= 3) unlock(g, 'acquirer');
    return g;
  }
  function mkWorker(ramp) { return { ramp, c: null, left: 0, temp: false, until: 0 }; }

  // ---------- helpers ----------
  function emit(g, e) { if (!g.headless) g.ev.push(e); }
  function news(g, text, kind) { emit(g, { k: 'news', text, kind: kind || 'info' }); }
  function sfx(g, name) { emit(g, { k: 'sfx', name }); }
  function flo(g, at, text, col) { emit(g, { k: 'float', at, text, col }); }
  const fmt = n => '£' + Math.round(n).toLocaleString('en-GB');
  function pay(g, amt, cat, at) {
    g.cash -= amt; g.fin[cat] = (g.fin[cat] || 0) + amt;
    if (OPEX[cat]) g.opexDay += amt;
    if (at && amt >= 20) flo(g, at, '-' + fmt(amt), C.COL.bad);
  }
  function earn(g, amt, cat, at) {
    g.cash += amt; g.fin[cat] = (g.fin[cat] || 0) + amt;
    if (at && amt >= 20) flo(g, at, '+' + fmt(amt), C.COL.good);
  }
  function addCsat(g, d) { g.csat = clamp(g.csat + (d > 0 ? d * C.CSAT_UP : d), 0, 100); }
  function addHeat(g, d) {
    const before = g.heat; g.heat = clamp(g.heat + d, 0, 100);
    for (const th of [50, 75, 90]) if (before < th && g.heat >= th) {
      news(g, 'Regulator heat at ' + th + '%: the FCA is watching', 'bad'); sfx(g, 'bad');
      if (th === 75) emit(g, { k: 'banner', text: 'Regulator warning', sub: 'Heat is at 75%. At 100% the FCA shuts you down.', tip: 'Clear late refunds, scam claims and complaints first. Regulated clocks matter most. Heat also cools by 1% a day.' });
    }
  }
  function tip(g, id, text) { if (!g.tips.has(id)) { g.tips.add(id); news(g, 'Tip: ' + text, 'good'); } }
  const NAMES = ['Priya', 'Tom', 'Aisha', 'Dave', 'Mei', 'Callum', 'Sofia', 'Kwame', 'Hannah', 'Liam', 'Zoe', 'Omar', 'Beth', 'Ravi'];
  const SHOPS = {
    RECOG: ['PAYPAL *XCLDGAMES', 'AMZNMKTP UK', 'APPLE.COM/BILL', 'TFL TRAVEL'], FRAUD: ['a gift card site', 'a ticket reseller', 'an electronics shop'],
    GNR: ['BrightSofa', 'Skyway Air', 'Urban Kicks'], DUP: ['Coffee Hub', 'ParkRight', 'Happy Hotels'], SUB: ['StreamBox TV', 'FitLife Gym', 'CloudStore+'],
    FRIEND: ['Gadget Giant', 'BigBox Retail'], LATE: ['Urban Kicks', 'BigBox Retail'], APP: ['a fake bank caller', 'a fake investment site', 'a scam text'],
    DD: ['Energy Co', 'Water Board', 'Broadband plc'],
  };
  function storyText(g, c, outcome) {
    const w = c.who || 'A customer', s = c.shop || 'a merchant', a = '£' + c.amt, T = c.type;
    switch (outcome) {
      case 'early': return w + " didn't know " + s + ' (' + a + '). It was them. Closed at triage.';
      case 'merch': return s + ' refunded ' + w + ' (' + a + ') once we asked. No chargeback.';
      case 'won': return T === 'GNR' ? 'Won: ' + s + ' never delivered to ' + w + '. Chargeback 13.1 got ' + a + ' back.'
        : T === 'DUP' ? 'Won: ' + s + ' charged ' + w + ' twice. Duplicate processing, ' + a + ' back.'
        : T === 'SUB' ? 'Won: ' + w + ' cancelled ' + s + '. Proof (13.2) got ' + a + ' back.'
        : T === 'FRAUD' ? 'Won: fraud on ' + w + "'s card. Recovered " + a + ' from the merchant.' : 'Won: ' + a + ' recovered for ' + w + '.';
      case 'lost': return T === 'FRAUD' ? 'Lost: the merchant proved it was ' + w + '. We absorb ' + a + '.' : 'Lost: ' + s + ' showed proof. ' + w + "'s " + a + ' stays lost.';
      case 'declined': return T === 'FRIEND' ? 'Declined: ' + w + ' did buy from ' + s + '. Friendly fraud, ' + a + '.'
        : T === 'LATE' ? 'Declined: ' + w + "'s " + a + ' claim is past the 120 day window.' : 'Declined: not enough evidence for ' + w + "'s " + a + ' at ' + s + '.';
      case 'absorbed': return c.goodwill ? 'Goodwill: we paid ' + w + "'s " + a + ' claim at ' + s + ' without a fight.'
        : c.threeDS ? w + "'s " + a + ' passed 3-D Secure. Liability is ours: no chargeback.' : c.amt < 12 ? a + ' is too small to chargeback. Absorbed.' : 'Too late to chargeback ' + w + "'s " + a + '. Absorbed.';
      case 'reimb': return T === 'APP' ? w + ' was scammed (' + a + '). Reimbursed fast; half back from the other bank.' : s + ' overbilled ' + w + '. The Direct Debit Guarantee refunds ' + a + ' at once.';
      case 'acqWon': return 'Merchant ' + g.merch[c.m].name + ' won: evidence beat the chargeback (' + a + ').';
      case 'acqLost': return 'Merchant ' + g.merch[c.m].name + ' lost ' + a + ': no proof. Debited.';
    }
    return null;
  }
  const GOOD_OUT = { early: 1, merch: 1, won: 1, reimb: 1, acqWon: 1 };
  function story(g, c, outcome) {
    const key = outcome + ':' + c.type;
    if (!g.storySeen.has(key)) g.storySeen.add(key); else if (rand() > 0.07) return;
    const t = storyText(g, c, outcome); if (!t) return;
    emit(g, { k: 'story', text: t.slice(0, 90), tone: GOOD_OUT[outcome] ? 'good' : outcome === 'declined' ? 'info' : 'bad' });
  }
  function unlock(g, id) {
    if (g.hb.has(id) || !D.HANDBOOK[id]) return;
    g.hb.add(id);
    news(g, 'New handbook entry: ' + D.HANDBOOK[id][0], 'hb');
    sfx(g, 'hb');
    emit(g, { k: 'hb', id });
  }
  // Upgrade level in v0 terms: one v1 upgrade = v0 levels 1 and 2 (training 2, tooling 2).
  const lv = s => (s.tech ? 2 : 0);
  const rateOf = s => s.def.rate * (s.tech ? C.UP_SPEED : 1);
  const licence = s => (s.tech ? C.UP_LIC : 0);
  const staffed = s => !!s && (s.def.kind === 'work' || s.def.kind === 'policy');
  function capacity(s) {
    let n = 0; for (const w of s.workers) n += (w.ramp > 0 ? C.RAMP_SPEED : 1) * (w.temp ? C.TEMP_SPEED : 1);
    return n * rateOf(s);
  }
  function busyN(s) { let n = 0; for (const w of s.workers) if (w.c) n++; return n; }
  function sponsorCap(g) { return g.st.SPONSOR ? C.SPONSOR_BASE + C.SPONSOR_STEP * g.sponsorTier : 0; }
  function riskEff(g) {
    const s = g.st.RISK; if (!s) return 0;
    let n = 0; for (const w of s.workers) n += w.ramp > 0 ? C.RAMP_SPEED : 1;
    return Math.min(1, n * (s.tech ? 1.5 : 1) / 3);
  }
  // Revenue multiplier from happiness: 50% at 20 or below, 100% at C.CSAT_FULL or above.
  function revScale(g) { return 0.5 + 0.5 * clamp((g.csat - 20) / (C.CSAT_FULL - 20), 0, 1); }
  function baseRate(g) { return g.P.base + g.P.growth * g.t; }
  function actMult(g, key) { let m = 1; for (const a of g.active) if (a[key]) m *= a[key]; return m; }
  function submitTarget(g) { return g.st.SCHEME ? 'SCHEME' : 'SPONSOR'; }
  const week = g => Math.min(C.WEEKS, Math.floor(g.t / C.DPW) + 1);
  function queuedTotal(g) {
    let n = 0;
    for (const id in g.st) { const s = g.st[id]; if (s.def.kind === 'work' || id === 'SPONSOR') n += s.queue.length; }
    return n;
  }
  function stationOrder(g) { return ORDER.filter(id => g.st[id] && g.st[id].unlocked); }
  const isReg = c => !!(D.TYPES[c.type] && D.TYPES[c.type].regulated);

  // ---------- case creation ----------
  function typeWeights(g) {
    const w = g.era >= 2
      ? { RECOG: .16, FRAUD: .20, GNR: .18, DUP: .09, SUB: .10, FRIEND: .08, LATE: .05, APP: .08, DD: .06 }
      : { RECOG: .18, FRAUD: .22, GNR: .22, DUP: .10, SUB: .12, FRIEND: .10, LATE: .06 };
    for (const a of g.active) if (a.mods) for (const k in a.mods) if (w[k] != null) w[k] *= a.mods[k];
    return w;
  }
  function newCase(g, type, amt) {
    const c = {
      id: ++g.nid, type, amt: Math.round(amt), born: g.t, due: g.t + D.TYPES[type].sla,
      win: type === 'LATE' ? rnd(-30, -1) : rnd(6, 60), threeDS: false, complete: true, bounced: false,
      q: 0, stage: 'new', credited: false, slaDone: false, at: null,
    };
    g.openN++;
    return c;
  }
  function spawn(g) {
    const type = pickW(typeWeights(g));
    let amt;
    if (type === 'APP') amt = clamp(Math.exp(gauss() * 0.8 + 6.0), 100, 8000);
    else amt = clamp(Math.exp(gauss() * 0.9 + 4.2), 5, 3000);
    const c = newCase(g, type, amt);
    c.who = NAMES[(rand() * NAMES.length) | 0]; c.shop = (SHOPS[type] || ['a merchant'])[(rand() * (SHOPS[type] || [1]).length) | 0];
    if (type === 'FRAUD') c.threeDS = chance(0.3);
    emit(g, { k: 'move', from: null, to: 'INTAKE', col: D.TYPES[type].col });
    c.at = 'INTAKE'; g.st.INTAKE.queue.push(c);
  }
  function pickMerchant(g) {
    return pickW(g.merch.reduce((o, m, i) => (o[i] = m.share, o), {})) | 0;
  }
  function spawnAcq(g, mi, amt) {
    mi = mi == null ? pickMerchant(g) : mi;
    const m = g.merch[mi];
    m.cbWin += 1;
    g.acqLog[g.acqLog.length - 1] = (g.acqLog[g.acqLog.length - 1] || 0) + 1;
    const c = newCase(g, 'ACQ', amt || clamp(Math.exp(gauss() * 0.8 + 4.5), 8, 1500));
    c.m = mi;
    emit(g, { k: 'move', from: null, to: 'ACQIN', col: D.TYPES.ACQ.col });
    c.at = 'ACQIN'; g.st.ACQIN.queue.push(c);
  }
  function spawnComplaint(g, from) {
    const c = newCase(g, 'COMP', 0);
    emit(g, { k: 'move', from: from || 'EVID', to: 'COMPL', col: D.TYPES.COMP.col });
    c.at = 'COMPL'; g.st.COMPL.queue.push(c);
  }

  // ---------- routing ----------
  function send(g, c, to, from) {
    const s = g.st[to];
    emit(g, { k: 'move', from, to, col: D.TYPES[c.type].col });
    c.at = to;
    if (to === 'MERCH') s.list.push({ c, ready: g.t + rnd(3, 5) });
    else if (to === 'ACQW') s.list.push({ c, ready: g.t + rnd(2.5, 4) });
    else s.queue.push(c);
  }
  function stopSLA(g, c) {
    if (c.slaDone) return;
    c.slaDone = true;
    if (c.lateFlag) return;
    const ok = g.t <= c.due;
    g.sla.push(ok ? 1 : 0); if (g.sla.length > 60) g.sla.shift();
    if (ok) { g.slaOk++; addCsat(g, 0.05); }
    else {
      g.slaBad++; addCsat(g, -1.2);
      addHeat(g, REGULATED[c.type] || 0.25);
      if (REGULATED[c.type]) { flo(g, c.at || 'INTAKE', 'Late', C.COL.bad); if (c.type === 'FRAUD') unlock(g, 'psr_unauth'); }
    }
  }
  const CPL = { early: 0.04, merch: 0.02, won: 0.02, absorbed: 0.1, reimb: 0.03, acqWon: 0.03, acqLost: 0.08 };
  function close(g, c, outcome) {
    g.out[outcome]++; g.closed++; g.closedDay++; g.openN--;
    emit(g, { k: 'closed', outcome });
    story(g, c, outcome);
    if (CPL[outcome] && !c.goodwill && chance(CPL[outcome])) spawnComplaint(g, c.at);
    if (g.out.early + g.out.merch + g.out.declined + g.out.absorbed >= 6) unlock(g, 'notall');
  }
  function decline(g, c) {
    stopSLA(g, c);
    const soft = c.type === 'FRIEND' || c.type === 'LATE';
    addCsat(g, soft ? -0.2 : -0.6);
    if (chance(soft ? 0.12 : 0.22)) spawnComplaint(g, c.at);
    close(g, c, 'declined');
  }
  // Lenient stance: pay the claim as goodwill instead of declining or fighting it.
  function goodwill(g, c) {
    stopSLA(g, c);
    if (!c.credited) pay(g, c.amt, 'refunds', c.at);
    c.goodwill = true; addCsat(g, 0.6);
    close(g, c, 'absorbed');
  }

  // ---------- chargeback outcomes ----------
  function chargebackWon(g, c) {
    if (c.credited) earn(g, c.amt, 'recovered', 'MERCH');
    addCsat(g, c.credited ? 0 : 2);
    close(g, c, 'won');
  }
  function chargebackLost(g, c) {
    if (c.type === 'FRAUD') { /* the refund stays with us */ }
    else if (c.credited) {
      // Some credits are clawed back from the customer; most are not.
      if (chance(0.12)) earn(g, c.amt, 'recovered');
      addCsat(g, -0.3);
    } else {
      addCsat(g, -1.2);
      if (chance(0.2)) spawnComplaint(g, 'MERCH');
    }
    close(g, c, 'lost');
  }
  function submit(g, c, fee, from) {
    pay(g, fee, 'fees'); stopSLA(g, c);
    if (g.t - c.born > c.win) { addHeat(g, 0.5); chargebackLost(g, c); return; }
    g.cbFiled++;
    if (c.type !== 'FRAUD' && g.policies.credit === 'always' && !c.credited) {
      pay(g, c.amt, 'refunds', from); c.credited = true; addCsat(g, 1.5);
    }
    send(g, c, 'MERCH', from);
  }
  function merchantResponse(g, c) {
    // First-party fraud that slipped through: the merchant almost always proves it.
    const pr = c.fp ? 0.9 : 0.55 - 0.25 * c.q;
    if (rand() < pr) {
      c.stage = 'rep'; c.rep = c.fp ? rnd(0.7, 1) : rand(); c.repDue = g.t + 3;
      unlock(g, 'lifecycle');
      send(g, c, g.st.REPR ? 'REPR' : 'EVID', 'MERCH');
    } else chargebackWon(g, c);
  }
  function repDecision(g, c, s) {
    if (g.t > c.repDue) { chargebackLost(g, c); return; }
    const smart = chance(clamp(0.55 + 0.18 * s.tech, 0, 0.95));
    const best = c.q > c.rep;
    const go = smart ? best : chance(0.5);
    if (!go) { chargebackLost(g, c); return; }
    unlock(g, 'prearb');
    if (c.q + rnd(-0.15, 0.15) > c.rep) chargebackWon(g, c);
    else { pay(g, C.PREARB_FEE, 'arb', s.id); chargebackLost(g, c); }
  }

  // ---------- acquiring ----------
  function acqResolve(g, c, won) {
    stopSLA(g, c);
    const m = g.merch[c.m];
    if (won) { earn(g, 25, 'revenue'); close(g, c, 'acqWon'); return; }
    if (m.insolvent) {
      const cover = Math.min(0.9, riskEff(g) * 0.8);
      pay(g, c.amt * (1 - cover), 'refunds', 'ACQW');
      unlock(g, 'acquirer');
    }
    close(g, c, 'acqLost');
  }

  // ---------- station completion logic ----------
  const FLOW = {
    INTAKE(g, c, s) {
      c.complete = chance(clamp(0.62 + 0.17 * lv(s), 0, 0.97));
      send(g, c, 'TRIAGE', 'INTAKE');
    },
    TRIAGE(g, c, s) {
      if (c.type === 'LATE') { decline(g, c); unlock(g, 'chargeback'); return; }
      if (c.type === 'RECOG') {
        if (chance(clamp(0.6 + 0.08 * lv(s), 0, 0.9))) { stopSLA(g, c); addCsat(g, 0.3); close(g, c, 'early'); return; }
        c.type = 'FRAUD'; c.threeDS = chance(0.2); send(g, c, 'FRAUD', 'TRIAGE'); return;
      }
      if (c.type === 'FRAUD') return send(g, c, 'FRAUD', 'TRIAGE');
      if ((c.type === 'APP' || c.type === 'DD') && g.st.PAYOPS) return send(g, c, 'PAYOPS', 'TRIAGE');
      send(g, c, 'EVID', 'TRIAGE');
    },
    FRAUD(g, c, s) {
      stopSLA(g, c);
      const strict = g.policies.risk === 'strict';
      // 9% of unauthorised claims are first-party fraud (15% under lenient: word gets around). Strict catches most of them
      // but also declines some genuine claims; lenient refunds most of them and loses the chargeback later.
      const fp = chance(strict ? 0.09 : 0.15);
      if (fp ? chance(strict ? 0.85 : 0.3) : chance(strict ? 0.04 : 0)) { unlock(g, 'friendly'); decline(g, c); return; }
      pay(g, c.amt, 'refunds', 'FRAUD'); c.credited = true; addCsat(g, 0.3); c.fp = fp;
      send(g, c, 'EVID', 'FRAUD');
    },
    EVID(g, c, s) {
      if (c.stage === 'rep') return repDecision(g, c, s);
      if (!c.complete && !c.bounced) {
        c.bounced = true; c.complete = true;
        flo(g, 'INTAKE', 'Bounced', C.COL.warn);
        g.bounce.push({ c, ready: g.t + rnd(0.6, 1.2) });
        return;
      }
      const strict = g.policies.risk === 'strict';
      const bonus = { DUP: 0.15, FRAUD: -0.1 }[c.type] || 0;
      c.q = clamp(0.38 + 0.18 * lv(s) + (c.bounced ? 0 : 0.08) + bonus + rnd(-0.15, 0.15), 0.05, 0.95);
      if (c.type === 'FRAUD') {
        if (c.threeDS || c.amt < 12 || g.t - c.born > c.win) {
          unlock(g, c.threeDS ? 'threeds' : 'notall'); close(g, c, 'absorbed'); return;
        }
        return send(g, c, submitTarget(g), 'EVID');
      }
      if (c.type === 'FRIEND') {
        unlock(g, 'friendly');
        if (!strict && chance(0.4)) return goodwill(g, c);
        decline(g, c); return;
      }
      if (c.type === 'APP' || c.type === 'DD') return FLOW.PAYOPS(g, c, s); // no Payments ops in this run
      const pm = { GNR: 0.18, DUP: 0.3, SUB: 0.22 }[c.type];
      const inv = ({ GNR: 0.12, DUP: 0.08, SUB: 0.2 }[c.type]) * (strict ? 1.5 : 0.5);
      const r = rand();
      if (r < pm) { stopSLA(g, c); addCsat(g, 0.8); close(g, c, 'merch'); unlock(g, 'notall'); return; }
      if (r < pm + inv) { decline(g, c); unlock(g, 'reasoncode'); return; }
      if (g.t - c.born > c.win) { addHeat(g, 0.5); if (strict) decline(g, c); else goodwill(g, c); unlock(g, 'chargeback'); return; }
      // Strict declines weak claims instead of filing chargebacks it will probably lose.
      if (strict && c.q < 0.32) { decline(g, c); unlock(g, 'reasoncode'); return; }
      send(g, c, submitTarget(g), 'EVID');
    },
    SCHEME(g, c) { submit(g, c, C.SCHEME_FEE, 'SCHEME'); },
    REPR(g, c, s) { repDecision(g, c, s); },
    PAYOPS(g, c) {
      stopSLA(g, c);
      const strict = g.policies.risk === 'strict';
      if (c.type === 'APP') {
        unlock(g, 'app');
        if (chance(strict ? 0.2 : 0.06)) { decline(g, c); return; }
        pay(g, c.amt, 'refunds', c.at); earn(g, c.amt * 0.5, 'recovered');
        addCsat(g, 1.5); close(g, c, 'reimb');
      } else {
        unlock(g, 'dd');
        pay(g, c.amt, 'refunds'); earn(g, c.amt * 0.85, 'recovered');
        addCsat(g, 1); close(g, c, 'reimb');
      }
    },
    COMPL(g, c, s) {
      stopSLA(g, c);
      if (chance(0.4 + 0.1 * lv(s) + (g.policies.risk === 'lenient' ? 0.15 : 0))) { pay(g, 60, 'misc'); addCsat(g, 1.5); }
      else {
        addCsat(g, -0.3);
        if (chance(0.12)) { pay(g, C.FOS_FEE, 'fos', 'COMPL'); addHeat(g, 1); unlock(g, 'fos'); news(g, 'Ombudsman case lost: ' + fmt(C.FOS_FEE) + ' fee', 'bad'); }
      }
      close(g, c, 'complaint');
    },
    ACQIN(g, c) { send(g, c, 'MEVID', 'ACQIN'); },
    MEVID(g, c, s) {
      const m = g.merch[c.m];
      c.q = clamp(m.quality * (0.65 + 0.1 * lv(s)) + rnd(-0.15, 0.15), 0.05, 0.95);
      if (c.q < 0.25) return acqResolve(g, c, false);
      send(g, c, 'REPSUB', 'MEVID');
    },
    REPSUB(g, c) { pay(g, C.REPSUB_FEE, 'fees'); stopSLA(g, c); send(g, c, 'ACQW', 'REPSUB'); },
  };

  function pickNext(g, s) {
    const rule = g.policies.queue;
    while (s.queue.length) {
      let i = 0;
      const Q = s.queue;
      if (rule === 'edf') { for (let j = 1; j < Q.length; j++) if (Q[j].due < Q[i].due) i = j; }
      else if (rule === 'regulated') {
        let r = -1;
        for (let j = 0; j < Q.length; j++) if (isReg(Q[j]) && (r < 0 || Q[j].due < Q[r].due)) r = j;
        if (r >= 0) i = r;
      }
      const c = Q.splice(i, 1)[0];
      if (c.type === 'ACQ' && g.t > c.due) { acqResolve(g, c, false); continue; }
      if (c.stage === 'rep' && g.t > c.repDue) { chargebackLost(g, c); continue; }
      return c;
    }
    return null;
  }

  // ---------- main step ----------
  function step(g, dt) {
    if (g.over) return;
    g.t += dt;
    while (g.day < Math.floor(g.t)) { g.day++; dayTick(g); if (g.over) return; }
    accrue(g, dt);
    arrivals(g, dt);
    work(g, dt);
    externals(g, dt);
    pressure(g, dt);
    if (g.cash < 0 && !g.warnCash) { g.warnCash = true; emit(g, { k: 'banner', text: 'Overdraft', sub: 'Cash is below zero. At -£25,000 the board pulls the plug.', tip: 'Fire idle agents, hold off on upgrades, and check which team is burning money.' }); }
    if (g.cash > 5000) g.warnCash = false;
    if (g.heat >= C.HEAT_MAX) g.over = { kind: 'fca' };
    else if (g.cash < C.CASH_FLOOR) g.over = { kind: 'cash' };
  }

  function accrue(g, dt) {
    let wages = 0, lic = 0;
    for (const id in g.st) { const s = g.st[id]; if (staffed(s)) { for (const w of s.workers) wages += w.temp ? C.TEMP_WAGE : g.wage; lic += licence(s); } }
    pay(g, wages * dt, 'wages'); pay(g, lic * dt, 'tech');
    if (g.P.fixed) pay(g, g.P.fixed * dt, 'fixed');
    let rev = baseRate(g) * g.P.rev;
    if (g.P.acqRev) rev += g.P.acqRev + g.P.acqGrowth * g.t;
    rev *= revScale(g);
    earn(g, rev * dt, 'revenue');
  }

  function arrivals(g, dt) {
    const open = clamp(0.35 + g.t / 3 * 0.65, 0.35, 1);
    // Always-credit: customers learn that disputing pays, so a few more claims arrive.
    const n = poisson(baseRate(g) * actMult(g, 'vol') * open * (g.policies.credit === 'always' ? C.CREDIT_VOL : 1) * dt);
    for (let i = 0; i < n; i++) spawn(g);
    if (g.st.ACQIN) {
      const r = g.P.acqBase * (1 - 0.35 * riskEff(g)) * open;
      const n2 = poisson(r * dt);
      for (let i = 0; i < n2; i++) spawnAcq(g);
    }
  }

  const REWORK = { INTAKE: 1, TRIAGE: 1, FRAUD: 1, EVID: 1, SCHEME: 1, PAYOPS: 1 };
  const errRate = (s, w) => clamp(0.12 - 0.05 * lv(s) + 0.1 * s.stress + (w.temp ? 0.08 : 0), 0.02, 0.45);
  function teamErr(s) {
    if (!REWORK[s.id] || !s.workers.length) return 0;
    let t = 0; for (const w of s.workers) t += errRate(s, w);
    return t / s.workers.length;
  }
  function work(g, dt) {
    const spd = g.speedMod * actMult(g, 'spd');
    for (const id in g.st) {
      const s = g.st[id];
      if (s.def.kind !== 'work') { if (s.def.kind === 'policy') { g.eff.paid += s.workers.length * dt; g.eff.busy += s.workers.length * dt * 0.8; } continue; }
      const rate = rateOf(s);
      let busy = 0;
      for (const w of s.workers) {
        if (!w.c) {
          const c = pickNext(g, s);
          if (c) { w.c = c; w.left = rnd(0.75, 1.3) / rate; }
        }
        if (w.c) {
          busy++;
          w.left -= dt * (w.ramp > 0 ? C.RAMP_SPEED : 1) * (w.temp ? C.TEMP_SPEED : 1) * spd;
          if (w.left <= 0) {
            const c = w.c; w.c = null;
            if (REWORK[id] && (c.rw || 0) < 2 && chance(errRate(s, w))) {
              c.rw = (c.rw || 0) + 1; s.queue.unshift(c);
              if (chance(0.5)) flo(g, id, 'Redo', C.COL.warn);
              tip(g, 'rework', 'mistakes cause rework. Upgrades cut errors; burnt-out and temp staff make more.');
            } else FLOW[id](g, c, s);
          }
        }
        if (w.ramp > 0) w.ramp -= dt;
      }
      g.eff.paid += s.workers.length * dt; g.eff.busy += busy * dt;
    }
  }

  function externals(g, dt) {
    const sp = g.st.SPONSOR;
    if (sp && (sp.queue.length || sp.list.length || sp.tokens < sponsorCap(g))) {
      sp.tokens = Math.min(sponsorCap(g), sp.tokens + sponsorCap(g) * dt);
      while (sp.queue.length && sp.tokens >= 1) {
        sp.tokens -= 1;
        const c = pickNext(g, sp);
        if (!c) break;
        sp.list.push({ c, ready: g.t + 1 });
      }
      for (let i = sp.list.length - 1; i >= 0; i--) {
        if (g.t >= sp.list[i].ready) { const c = sp.list[i].c; sp.list.splice(i, 1); unlock(g, 'sponsor'); submit(g, c, C.SPONSOR_FEE, 'SPONSOR'); }
      }
    }
    const mer = g.st.MERCH.list;
    for (let i = mer.length - 1; i >= 0; i--) if (g.t >= mer[i].ready) { const c = mer[i].c; mer.splice(i, 1); merchantResponse(g, c); }
    if (g.st.ACQW) {
      const aw = g.st.ACQW.list;
      for (let i = aw.length - 1; i >= 0; i--) if (g.t >= aw[i].ready) { const c = aw[i].c; aw.splice(i, 1); acqResolve(g, c, c.q + rnd(-0.2, 0.2) > 0.4); }
    }
    for (let i = g.bounce.length - 1; i >= 0; i--) {
      if (g.t >= g.bounce[i].ready) {
        const c = g.bounce[i].c; g.bounce.splice(i, 1);
        emit(g, { k: 'move', from: 'INTAKE', to: 'EVID', col: D.TYPES[c.type].col });
        c.at = 'EVID'; g.st.EVID.queue.unshift(c);
      }
    }
  }

  function pressure(g, dt) {
    for (const id in g.st) {
      const s = g.st[id];
      if (s.def.kind !== 'work') continue;
      const n = s.workers.length, b = busyN(s);
      const load = n ? (s.queue.length + b) / n : (s.queue.length ? 9 : 0);
      s.stress = clamp(s.stress + dt * (load > 3 ? C.STRESS_UP : -C.STRESS_DOWN), 0, 1);
      s.pressure = n ? s.queue.length / n : s.queue.length * 2;
      s.util += ((n ? b / n : 0) - s.util) * Math.min(1, dt * 3);
    }
    const sp = g.st.SPONSOR;
    if (sp) sp.pressure = sp.queue.length / (sponsorCap(g) / 2);
    if (g.st.RISK) { const r = g.st.RISK; r.util = riskEff(g); r.pressure = 0; }
  }

  function dayTick(g) {
    g.costLog.push({ o: g.opexDay, c: g.closedDay });
    if (g.costLog.length > 5) g.costLog.shift();
    g.opexDay = 0; g.closedDay = 0;
    g.acqLog.push(0); if (g.acqLog.length > 5) g.acqLog.shift();
    addHeat(g, -C.HEAT_COOL);
    g.csat += (C.CSAT_REST - g.csat) * C.CSAT_DRIFT;
    for (const m of g.merch) m.cbWin *= 0.85;

    dayChecks(g);
    g.active = g.active.filter(a => g.t < a.until);
    for (const ev of EVENTS) if (ev.day === g.day && ev.minEra <= g.era) startEvent(g, ev);

    // escalations
    const cl = g.clinic;
    if (!cl.cur && g.day >= cl.next && g.day < C.END_DAY - 2) {
      const pool = D.CLINIC.filter(x => x.era <= g.era && !cl.used.has(x.id));
      if (pool.length) {
        const w = {}; pool.forEach((x, i) => { w[i] = x.era === g.era ? 3 : 1; });
        const sc = pool[pickW(w) | 0];
        cl.cur = { id: sc.id };
        news(g, 'Escalation: ' + sc.title, 'event'); emit(g, { k: 'escalate', id: sc.id }); sfx(g, 'event');
      } else cl.next = g.day + C.CLINIC_GAP;
    }
    // burnout
    for (const id in g.st) {
      const s = g.st[id];
      if (s.def.kind === 'work' && s.stress > C.BURNOUT_AT && s.workers.length > 1 && chance(C.BURNOUT_P)) {
        let i = s.workers.findIndex(w => !w.c); if (i < 0) i = s.workers.length - 1;
        const w = s.workers.splice(i, 1)[0];
        if (w.c) s.queue.unshift(w.c);
        news(g, 'Burnout: an agent quit ' + s.def.name, 'bad'); sfx(g, 'bad'); flo(g, id, 'Quit', C.COL.bad);
      }
    }
    // jam warnings
    for (const id in g.st) {
      const s = g.st[id];
      if (s.def.kind !== 'work' && id !== 'SPONSOR') continue;
      if (s.pressure > 4 && g.day - (s.warnDay || -99) >= 5) {
        s.warnDay = g.day;
        news(g, 'Jam at ' + s.def.name + ': ' + s.queue.length + ' waiting' + (id === 'SPONSOR' ? ' (sponsor cap)' : ''), 'bad');
      }
    }
    // weekly
    if (g.day % C.DPW === 0) {
      news(g, 'Week ' + (g.day / C.DPW) + ' complete', 'info');
      if (g.st.ACQIN) {
        const sum = g.acqLog.reduce((a, b) => a + b, 0) / Math.max(1, g.acqLog.length);
        if (sum > 5 && riskEff(g) < 0.4 && g.day - g.fineGiven >= 10) {
          g.fineGiven = g.day; pay(g, 6000, 'fines'); addHeat(g, 4); unlock(g, 'ratio');
          news(g, 'Scheme fine £6,000: merchant chargeback ratios too high', 'bad'); sfx(g, 'bad');
        }
      }
    }
    if (g.day >= C.END_DAY) g.over = { kind: 'end' };
  }

  function dayChecks(g) {
    let overdue = 0;
    const scan = c => {
      if (c.type === 'ACQ') {
        if (g.t > c.due + 0.5 && !c.complained && chance(0.3)) { c.complained = true; spawnComplaint(g, c.at); addCsat(g, -0.3); }
        return;
      }
      if (g.t > c.due && !c.slaDone) {
        overdue++;
        if (!c.lateFlag) { c.lateFlag = true; g.sla.push(0); if (g.sla.length > 60) g.sla.shift(); g.slaBad++; addCsat(g, -1.2); addHeat(g, (REGULATED[c.type] || 0.25) * 0.6); }
        if (REGULATED[c.type]) addHeat(g, REGULATED[c.type] * 0.035);
        if (c.type !== 'COMP' && !c.complained && g.t > c.due + 0.5 && chance(0.3)) {
          c.complained = true; spawnComplaint(g, c.at); addCsat(g, -0.6);
          tip(g, 'delay', 'late cases turn into complaints. Clear the queue.');
        }
        if (c.type === 'COMP' && g.t > c.due + 0.5 && !c.fosDone && chance(0.25)) {
          c.fosDone = true; pay(g, C.FOS_FEE, 'fos', 'COMPL'); addHeat(g, 1); unlock(g, 'fos');
          news(g, 'Ombudsman case: a rotting complaint costs ' + fmt(C.FOS_FEE), 'bad'); sfx(g, 'bad');
        }
      }
    };
    for (const id in g.st) { const s = g.st[id]; s.queue.forEach(scan); s.workers.forEach(w => { if (w.c) scan(w.c); }); }
    g.bounce.forEach(b => scan(b.c));
    if (overdue) { addCsat(g, -Math.min(3, overdue * 0.04)); }
    // temp contracts end; idle teams get flagged
    for (const id in g.st) {
      const s = g.st[id]; if (!staffed(s)) continue;
      let left = 0;
      for (let i = s.workers.length - 1; i >= 0; i--) {
        const w = s.workers[i];
        if (w.temp && g.t >= w.until) { s.workers.splice(i, 1); if (w.c) s.queue.unshift(w.c); left++; }
      }
      if (left) news(g, s.def.name + ': ' + left + ' temp contract' + (left > 1 ? 's' : '') + ' ended', 'info');
      if (s.def.kind !== 'work') continue;
      const n = s.workers.length;
      s.idleDays = n > 2 && s.util < 0.25 ? (s.idleDays || 0) + 1 : 0;
      if (s.idleDays === 3) news(g, s.def.name + ' is mostly idle. Each agent costs ' + fmt(g.wage) + ' a day', 'bad');
    }
  }

  function startEvent(g, ev) {
    if (ev.special === 'fca') {
      const bad = g.heat > 40;
      if (bad) { pay(g, 8000, 'fines'); addHeat(g, -15); news(g, 'FCA review: findings against you. £8,000 fine', 'bad'); sfx(g, 'bad'); }
      else { earn(g, 3000, 'misc'); addHeat(g, -10); news(g, 'FCA review: clean bill of health. £3,000 grant', 'good'); sfx(g, 'good'); }
      emit(g, { k: 'banner', text: ev.name, sub: bad ? 'Findings against you: £8,000 fine. Heat reduced.' : 'Clean bill of health: £3,000 grant. Heat reduced.', tip: ev.tip, good: !bad });
      return;
    }
    const a = { name: ev.name, until: g.t + ev.dur, mods: ev.mods, vol: ev.vol, spd: ev.spd };
    g.active.push(a);
    news(g, ev.name + ': ' + ev.text, 'event'); sfx(g, 'event');
    emit(g, { k: 'banner', text: ev.name, sub: ev.text, tip: ev.tip });
    if (ev.hb) unlock(g, ev.hb);
    if (ev.special === 'travelkite') {
      g.merch[2].insolvent = true;
      for (let i = 0; i < 14; i++) spawnAcq(g, 2, rnd(200, 900));
      unlock(g, 'acquirer');
    }
  }

  // ---------- player actions ----------
  function can(g, action, id) {
    if (!g || g.over) return false;
    const s = id != null ? g.st[id] : null;
    switch (action) {
      case 'hire': return staffed(s) && s.workers.length < C.MAX_STAFF && g.cash - C.HIRE >= C.CASH_FLOOR;
      case 'fire': return staffed(s) && s.workers.length > 0;
      case 'outsource': {
        if (!staffed(s) || !s.def.outsource) return false;
        const temps = s.workers.filter(w => w.temp).length;
        return temps + 2 <= C.MAX_TEMPS && s.workers.length + 2 <= C.MAX_STAFF && g.cash - C.TEMP_SETUP * 2 >= C.CASH_FLOOR;
      }
      case 'upgrade': return staffed(s) && !s.tech && g.cash >= C.UP_COST;
      case 'sponsor': return !!g.st.SPONSOR && g.sponsorTier < C.SPONSOR_COST.length && g.cash >= C.SPONSOR_COST[g.sponsorTier];
    }
    return false;
  }
  const act = {
    hire(g, id) {
      if (!can(g, 'hire', id)) return false;
      const s = g.st[id];
      pay(g, C.HIRE, 'hiring'); s.workers.push(mkWorker(C.HIRE_RAMP)); sfx(g, 'hire'); return true;
    },
    fire(g, id) {
      if (!can(g, 'fire', id)) return false;
      const s = g.st[id];
      const perm = s.workers.map((w, i) => i).filter(i => !s.workers[i].temp);
      let i, fee = C.FIRE;
      if (!perm.length) { i = s.workers.length - 1; fee = 0; }
      else { i = perm.find(j => !s.workers[j].c); if (i == null) i = perm[perm.length - 1]; }
      const w = s.workers.splice(i, 1)[0];
      if (w.c) s.queue.unshift(w.c);
      if (fee) pay(g, fee, 'hiring'); sfx(g, 'fire'); return true;
    },
    outsource(g, id) {
      if (!can(g, 'outsource', id)) return false;
      const s = g.st[id];
      pay(g, C.TEMP_SETUP * 2, 'hiring');
      for (let i = 0; i < 2; i++) { const w = mkWorker(C.TEMP_RAMP); w.temp = true; w.until = g.t + C.TEMP_DAYS; s.workers.push(w); }
      sfx(g, 'hire'); unlock(g, 'bpo'); return true;
    },
    upgrade(g, id) {
      if (!can(g, 'upgrade', id)) return false;
      pay(g, C.UP_COST, 'capex'); g.st[id].tech = 1; sfx(g, 'up'); return true;
    },
    sponsor(g) {
      if (!can(g, 'sponsor')) return false;
      pay(g, C.SPONSOR_COST[g.sponsorTier], 'capex'); g.sponsorTier++; sfx(g, 'up'); return true;
    },
    answerClinic(g, idx) {
      const cl = g.clinic; if (!cl.cur) return null;
      const sc = D.CLINIC.find(x => x.id === cl.cur.id);
      const o = sc.opts[idx];
      if (!o) return null;
      cl.used.add(sc.id); cl.cur = null; cl.next = g.day + C.CLINIC_GAP;
      if (o.ok) { cl.right++; earn(g, C.CLINIC_RIGHT, 'misc'); addCsat(g, 2); addHeat(g, -6); sfx(g, 'good'); }
      else { cl.wrong++; pay(g, C.CLINIC_WRONG, 'misc'); addHeat(g, 3); addCsat(g, -1.5); sfx(g, 'bad'); }
      (sc.hb || []).forEach(id => unlock(g, id));
      return { ok: o.ok, why: o.why, best: sc.opts.find(x => x.ok).t };
    },
  };

  // ---------- read-only helpers ----------
  function forecast(g) {
    for (const ev of EVENTS) {
      if (ev.minEra > g.era || ev.day <= g.day) continue;
      return { name: ev.name, day: ev.day, daysAway: Math.max(0, ev.day - g.t), tip: ev.tip };
    }
    return null;
  }
  function eventsFor(g) { return EVENTS.filter(ev => ev.minEra <= g.era); }
  function costPerCase(g) {
    let o = g.opexDay, cl = g.closedDay;
    for (const d of g.costLog) { o += d.o; cl += d.c; }
    return cl >= 10 ? o / cl : 0;
  }
  function slaRate(g) {
    const n = g.sla.length; if (!n) return 1;
    return g.sla.reduce((a, b) => a + b, 0) / n;
  }
  function score(g) {
    const tot = g.slaOk + g.slaBad;
    const slaAll = tot ? g.slaOk / tot : 1;
    const profit = g.cash - g.startCash + 0.6 * (g.fin.capex || 0);
    const backlogDays = queuedTotal(g) / Math.max(1, baseRate(g));
    const cl = g.clinic, n = cl.right + cl.wrong + cl.missed;
    const effAvg = g.eff.paid > 0 ? g.eff.busy / g.eff.paid : 0;
    const pts = {
      money: clamp(profit / g.P.profit, -0.5, 1) * 20,
      sla: slaAll * slaAll * 25,
      csat: g.csat / 100 * 15,
      flow: (1 - clamp(backlogDays / 4, 0, 1)) * 10,
      reg: (1 - g.heat / 100) * 10,
      eff: clamp((effAvg - 0.35) / 0.4, 0, 1) * 10,
      learn: n ? cl.right / n * 6 : 0,
    };
    let total = 0; for (const k in pts) total += pts[k];
    const G = C.GRADES;
    let grade = total >= G.S ? 'S' : total >= G.A ? 'A' : total >= G.B ? 'B' : total >= G.C ? 'C' : 'D';
    let capped = false;
    if (g.difficulty === 'easy' && grade === 'S') { grade = 'A'; capped = true; }
    if (g.over && g.over.kind !== 'end') grade = 'D';
    return { pts, total, max: C.MAX_PTS, grade, capped, slaAll, profit, backlogDays, effAvg };
  }

  const api = {
    C, EVENTS, create, step, act, can, score, forecast, eventsFor, stationOrder, seed,
    teamErr, revScale, rateOf, capacity, busyN, sponsorCap, riskEff, baseRate, queuedTotal, costPerCase, slaRate, week, licence,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
