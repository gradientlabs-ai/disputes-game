// Dispute Factory v1: every screen that is not the in-run screen.
// Exposes window.Screens = { start, banner, escalate, handbook, end, isOpen }.
(function () {
  'use strict';

  // ------------------------------------------------------------ helpers
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = n => (n < 0 ? '-' : '') + '£' + Math.abs(Math.round(n || 0)).toLocaleString('en-GB');
  const signed = n => (n > 0 ? '+' : n < 0 ? '-' : '') + '£' + Math.abs(Math.round(n || 0)).toLocaleString('en-GB');
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
  const pct = (a, b) => (b > 0 ? Math.round(a / b * 100) : 0);
  const D = () => window.GAMEDATA || {};
  const S = () => window.Sim || {};

  // Data written in capitals reads as shouting; show it in sentence case and keep acronyms.
  const ACR = ['FCA', 'APP', 'UK', 'PSR', 'PSRs', 'BIN', 'RDR', 'CE', 'BPO', 'SLA', 'SLAs', 'CHAPS', 'VAMP', 'ECM', 'CB', 'DD', 'II', 'III', 'XCLDGAMES', 'PAYPAL', 'AI'];
  function sentence(s) {
    s = String(s == null ? '' : s);
    if (!s || /[a-z]/.test(s)) return s;
    let t = s.toLowerCase().replace(/^\s*(\S)/, m => m.toUpperCase());
    t = t.replace(/\b3-d\b/gi, '3-D').replace(/\bsection\b/g, 'Section').replace(/\bvisa\b/g, 'Visa').replace(/\bmastercard\b/g, 'Mastercard')
      .replace(/\bombudsman\b/g, 'Ombudsman').replace(/\bdirect debit\b/gi, 'Direct Debit').replace(/\bblack friday\b/gi, 'Black Friday').replace(/\btravelkite\b/gi, 'Travelkite');
    ACR.forEach(a => { t = t.replace(new RegExp('\\b' + a.toLowerCase() + '\\b', 'g'), a); });
    return t;
  }

  const store = {
    get(k, d) { try { const v = window.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };
  const K_BEST = 'disputeFactory.v1.best', K_LAST = 'disputeFactory.v1.last';

  // ------------------------------------------------------------ copy
  const DIFF = [
    { id: 'easy', name: 'Easy', era: 'A card start-up', adds: 'You run the front line: log claims, sort them, refund fraud, and check evidence. A partner bank files chargebacks for you.' },
    { id: 'medium', name: 'Medium', era: 'A full bank', adds: 'You file chargebacks yourself, answer shops that push back, and handle bank transfer scams and Direct Debit claims. More disputes and a daily membership fee.' },
    { id: 'hard', name: 'Hard', era: 'A bank that also serves shops', adds: 'Everything in Medium, plus disputes from other banks against the shops you take payments for, and the risk that one of those shops goes bust.' },
  ];
  const POLICIES = [
    { key: 'queue', name: 'Queue rule', ask: 'Which case does a free agent take next?', opts: [
      { id: 'fifo', name: 'Oldest first', line: 'Fair, but urgent cases can wait behind easy ones.' },
      { id: 'edf', name: 'Nearest deadline first', line: 'Works on what is due soonest, so fewer cases go late.' },
      { id: 'regulated', name: 'Legal deadlines first', line: 'Keeps the regulator calm, but everyday cases wait and complaints rise.' },
    ] },
    { key: 'credit', name: 'Credit policy', ask: 'When do customers get their money back?', opts: [
      { id: 'regulated', name: 'When the law says so', line: 'Fraud is refunded at once and the rest wait for the outcome, which costs less.' },
      { id: 'always', name: 'Straight away', line: 'Happier customers, but you lose the money on cases you cannot recover.' },
    ] },
    { key: 'risk', name: 'Risk stance', ask: 'What happens to a weak claim?', opts: [
      { id: 'strict', name: 'Strict', line: 'Turn weak claims down early: smaller losses, more complaints.' },
      { id: 'lenient', name: 'Lenient', line: 'Pay out on weak claims: fewer complaints, bigger losses, more fraud.' },
    ] },
  ];
  // Recommended options come from GAMEDATA.POLICIES (rec: true) when present.
  const DEFAULTS = (function () {
    const d = { queue: 'edf', credit: 'regulated', risk: 'strict' };
    try { const P = (window.GAMEDATA || {}).POLICIES || {}; for (const k in d) { const o = P[k] && P[k].options; if (o) for (const v in o) if (o[v] && o[v].rec) d[k] = v; } } catch (e) { /* keep defaults */ }
    return d;
  })();
  const maxGrade = id => { try { const x = ((window.GAMEDATA || {}).DIFFICULTIES || {})[id]; return x && x.maxGrade; } catch (e) { return null; } };
  const polName = (key, id) => { const p = POLICIES.find(x => x.key === key); const o = p && p.opts.find(x => x.id === id); return o ? o.name : String(id || ''); };
  const comboKey = (diff, p) => [diff, p.queue, p.credit, p.risk].join('|');

  // score components: label, default maximum, and an honest note on what automating that step changes
  const COMP = {
    sla: { label: 'On time', max: 25 },
    money: { label: 'Profit', max: 20 },
    csat: { label: 'Customer happiness', max: 15 },
    flow: { label: 'Flow', max: 10 },
    reg: { label: 'Regulator', max: 10 },
    eff: { label: 'Efficiency', max: 10 },
    learn: { label: 'Judgement calls', max: 6 },
    growth: { label: 'Growth', max: 8 },
  };
  const LABEL_ALIASES = { profit: 'money', ontime: 'sla', onTime: 'sla', happiness: 'csat', regulator: 'reg', heat: 'reg', efficiency: 'eff', learning: 'learn', backlog: 'flow' };

  const OUT = [
    ['early', 'Sorted on first contact', 'The customer recognised the payment once they saw the details.'],
    ['merch', 'Refunded by the shop', 'The shop paid the money back when asked.'],
    ['declined', 'Turned down', 'The claim was out of time, weak, or the customer had made the purchase.'],
    ['absorbed', 'Paid by the bank', 'Not worth chasing, no way to recover it, or paid as goodwill, so the bank took the loss.'],
    ['reimb', 'Repaid outside the card rules', 'Bank transfer scams and Direct Debit errors have their own refund rules.'],
    ['won', 'Chargebacks won', 'The card scheme returned the money from the shop.'],
    ['lost', 'Chargebacks lost', 'The shop proved its case, so the money stayed with the shop.'],
    ['acqWon', 'Your shops won', 'Other banks disputed a sale at one of your shops, and the shop kept the money.'],
    ['acqLost', 'Your shops lost', 'The other bank won, and the money went back to its customer.'],
    ['acqPre', 'Your shops settled early', 'The shop refunded before a full dispute started.'],
  ];

  // ------------------------------------------------------------ root, fonts, focus, keys
  let root = null, open = false, view = null, keyHandler = null, pending = [], inerted = [], lastFocus = null;
  function ensureFonts() {
    try {
      if (document.querySelector('link[data-screens-fonts]')) return;
      const have = Array.from(document.querySelectorAll('link[href*="fonts.googleapis.com"]')).map(l => l.href).join(' ');
      const fams = [];
      if (!/Press\+Start\+2P/.test(have)) fams.push('family=Press+Start+2P');
      if (!/Silkscreen/.test(have)) fams.push('family=Silkscreen:wght@400;700');
      if (!/DM\+Sans/.test(have)) fams.push('family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700');
      if (!/Inter/.test(have)) fams.push('family=Inter:wght@400;500;600');
      if (!fams.length) return;
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.setAttribute('data-screens-fonts', '1');
      l.href = 'https://fonts.googleapis.com/css2?' + fams.join('&') + '&display=swap';
      document.head.appendChild(l);
    } catch (e) { /* offline is fine: fallbacks apply */ }
  }
  function ensureRoot() {
    if (root && document.body.contains(root)) return root;
    ensureFonts();
    root = document.createElement('div');
    root.id = 'screens';
    root.setAttribute('hidden', '');
    document.body.appendChild(root);
    window.addEventListener('keydown', onKey, true);
    return root;
  }
  function setInert(on) {
    if (on) {
      inerted = [];
      Array.from(document.body.children).forEach(el => {
        if (el === root || el.tagName === 'SCRIPT' || el.tagName === 'LINK' || el.tagName === 'STYLE') return;
        if (!el.inert) { el.inert = true; inerted.push(el); }
      });
    } else { inerted.forEach(el => { el.inert = false; }); inerted = []; }
  }
  function show(name, html, onKeyFn, theme) {
    ensureRoot();
    if (!open) { lastFocus = document.activeElement; setInert(true); }
    open = true; view = name; keyHandler = onKeyFn || null;
    root.className = 'sc-' + name + (theme === 'light' ? ' sc-light' : '');
    root.removeAttribute('hidden');
    root.innerHTML = html;
    root.scrollTop = 0;
    const f = root.querySelector('[data-autofocus]') || root.querySelector('button:not([disabled]), a[href]');
    if (f) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }
  }
  function close() {
    open = false; view = null; keyHandler = null;
    if (root) { root.setAttribute('hidden', ''); root.innerHTML = ''; root.className = ''; }
    setInert(false);
    if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    lastFocus = null;
    if (pending.length) { const next = pending.shift(); next(); }
  }
  // If PLAY asks for another card while one is open, show it after the current one.
  function enqueue(fn) { if (open) pending.push(fn); else fn(); }
  function finish(cb, arg) { close(); if (typeof cb === 'function') { try { cb(arg); } catch (e) { setTimeout(() => { throw e; }); } } }

  function onKey(e) {
    if (!open) return;
    const t = e.target, onCtl = t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'INPUT');
    let handled = false;
    if (keyHandler) handled = keyHandler(e, onCtl) === true;
    if (!handled && e.key === 'Tab') {
      // keep focus inside the card
      const f = Array.from(root.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter(x => x.offsetParent !== null || x === document.activeElement);
      if (f.length) {
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && (i <= 0)) { f[f.length - 1].focus(); e.preventDefault(); }
        else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { f[0].focus(); e.preventDefault(); }
      }
      e.stopPropagation();
      return;
    }
    if (handled) e.preventDefault();
    // the in-run screen must not react to keys while a card is open
    e.stopPropagation();
  }
  const click = sel => { const b = root && root.querySelector(sel); if (b && !b.disabled) { b.click(); return true; } return false; };
  const digit = e => (/^[1-9]$/.test(e.key) ? +e.key : 0);

  const MARK = '<svg class="sc-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="miter" aria-hidden="true"><rect x="4" y="4" width="56" height="56"></rect><path d="M 4 4 L 60 4 L 32 32 L 32 60"></path></svg>';

  // ------------------------------------------------------------ start: title, difficulty, policies
  let last = null, replayPending = false;
  function loadLast() {
    if (last) return last;
    const s = store.get(K_LAST, null);
    if (s && s.policies) last = { difficulty: s.difficulty || 'easy', policies: Object.assign({}, DEFAULTS, s.policies) };
    return last;
  }
  const bestAll = () => { const b = store.get(K_BEST, {}); return b && typeof b === 'object' ? b : {}; };
  function bestForDiff(diff) {
    const b = bestAll(); let top = null;
    for (const k in b) if (k.split('|')[0] === diff && b[k] && (!top || num(b[k].total) > num(top.total))) top = b[k];
    return top;
  }

  function start(cb) {
    enqueue(() => {
      const prev = loadLast();
      const st = { difficulty: (prev && prev.difficulty) || 'easy', policies: Object.assign({}, DEFAULTS, prev && prev.policies) };
      const done = () => {
        last = { difficulty: st.difficulty, policies: Object.assign({}, st.policies) };
        store.set(K_LAST, last);
        finish(cb, { difficulty: st.difficulty, policies: Object.assign({}, st.policies) });
      };
      if (replayPending) { replayPending = false; policyScreen(st, done, () => difficultyScreen(st, done)); }
      else titleScreen(st, done);
    });
  }

  function titleScreen(st, done) {
    const blocks = [[3, 'o'], [5, 'o'], [2, 'c'], [7, 'oc'], [4, 'o'], [3, 'g']].map(([n, k]) => {
      let h = '';
      for (let i = 0; i < n; i++) h += '<i class="' + (k === 'oc' ? (i >= n - 2 ? 'c' : 'o') : k) + '"></i>';
      return '<div class="sc-well">' + h + '</div>';
    }).join('');
    show('title', '<div class="sc-frame sc-title">'
      + '<div class="sc-tl">'
      + '<p class="sc-eyebrow">A management game</p>'
      + '<h1 class="sc-h1">Dispute<br>Factory</h1>'
      + '<p class="sc-lede">You run the team at a UK bank that sorts out customers\' payment disputes. Keep it running for 8 weeks without going broke or being shut down by the regulator.</p>'
      + '<button class="sc-btn sc-primary sc-big" data-act="go" data-autofocus>Start</button>'
      + '</div>'
      + '<div class="sc-tr">'
      + '<div class="sc-wells" aria-hidden="true">' + blocks + '</div>'
      + '<h2 class="sc-h3">How to play</h2>'
      + '<ol class="sc-how">'
      + '<li><b>1</b><span>Disputes arrive and stack up in each team\'s column, moving left to right.</span></li>'
      + '<li><b>2</b><span>Tap a team and hire people before its stack crosses the dashed line.</span></li>'
      + '<li><b>3</b><span>Close cases on time and keep your costs down to earn a high grade.</span></li>'
      + '</ol>'
      + '<p class="sc-by">' + MARK + '<span>Made by Gradient Labs</span></p>'
      + '</div></div>', e => {
      if (e.key === 'Enter' || e.key === ' ') { if (e.target && e.target.tagName === 'A') return false; return click('[data-act="go"]'); }
      return false;
    });
    root.querySelector('[data-act="go"]').onclick = () => difficultyScreen(st, done);
  }

  function difficultyScreen(st, done) {
    let h = '<div class="sc-frame sc-diff"><div class="sc-head"><p class="sc-eyebrow">Step 1 of 2</p><h2 class="sc-h2">Choose your bank</h2><p class="sc-note">Harder banks run more teams and face more kinds of dispute.</p></div><div class="sc-cols3">';
    DIFF.forEach((d, i) => {
      const b = bestForDiff(d.id);
      h += '<button class="sc-choice' + (st.difficulty === d.id ? ' is-on' : '') + '" data-diff="' + d.id + '"' + (st.difficulty === d.id ? ' data-autofocus' : '') + '>'
        + '<span class="sc-key">' + (i + 1) + '</span>'
        + '<span class="sc-cname">' + d.name + '</span>'
        + '<span class="sc-csub">' + esc(d.era) + '</span>'
        + '<span class="sc-cbody">' + esc(d.adds) + '</span>'
        + '<span class="sc-best"><span>' + (b ? 'Your best <b>' + esc(b.grade) + '</b>' : 'Not played yet') + '</span>' + (maxGrade(d.id) ? '<span>Can reach <b>' + esc(maxGrade(d.id)) + '</b></span>' : '') + '</span>'
        + '</button>';
    });
    h += '</div><div class="sc-foot"><button class="sc-btn" data-act="back">Back</button><span class="sc-hint">Press 1, 2 or 3</span></div></div>';
    show('diff', h, e => {
      const n = digit(e);
      if (n >= 1 && n <= 3) return click('[data-diff="' + DIFF[n - 1].id + '"]');
      if (e.key === 'Escape') return click('[data-act="back"]');
      return false;
    });
    root.querySelectorAll('[data-diff]').forEach(b => { b.onclick = () => { st.difficulty = b.dataset.diff; policyScreen(st, done, () => difficultyScreen(st, done)); }; });
    root.querySelector('[data-act="back"]').onclick = () => titleScreen(st, done);
  }

  function policyScreen(st, done, back) {
    const d = DIFF.find(x => x.id === st.difficulty) || DIFF[0];
    let h = '<div class="sc-frame sc-pol"><div class="sc-headrow"><div class="sc-htext"><p class="sc-eyebrow">Step 2 of 2 · ' + d.name + '</p><h2 class="sc-h2">Set your rules</h2>'
      + '<p class="sc-note">Locked for the whole run. <em class="sc-rec">Recommended</em> marks the choice for first-timers.</p></div>'
      + '<div class="sc-hbtns"><button class="sc-btn" data-act="back">Back</button><button class="sc-btn" data-act="rec" aria-label="Use the recommended rules">Use recommended</button><button class="sc-btn sc-primary sc-wide" data-act="begin">Begin</button></div></div><div class="sc-cols3">';
    POLICIES.forEach((p, pi) => {
      h += '<fieldset class="sc-pcard"><legend class="sc-pname">' + p.name + '</legend><p class="sc-pask">' + esc(p.ask) + '</p><div class="sc-opts" role="radiogroup" aria-label="' + esc(p.name) + '">';
      p.opts.forEach(o => {
        const on = st.policies[p.key] === o.id, rec = DEFAULTS[p.key] === o.id;
        h += '<button class="sc-opt' + (on ? ' is-on' : '') + '" role="radio" aria-checked="' + on + '" data-p="' + p.key + '" data-v="' + o.id + '"' + (pi === 0 && on ? ' data-autofocus' : '') + '>'
          + '<span class="sc-oname"><i class="sc-dot" aria-hidden="true"></i>' + esc(o.name) + (rec ? '<em class="sc-rec" title="Recommended for first-timers">Recommended</em>' : '') + '</span>'
          + '<span class="sc-oline">' + esc(o.line) + '</span></button>';
      });
      h += '</div></fieldset>';
    });
    h += '</div></div>';
    show('policy', h, (e, onCtl) => {
      if (e.key === 'Escape') return click('[data-act="back"]');
      if (e.key === 'Enter' && !onCtl) return click('[data-act="begin"]');
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target && e.target.dataset && e.target.dataset.p) {
        const t = e.target, card = t.closest('.sc-cols3'), cards = Array.from(card.querySelectorAll('.sc-opts'));
        const grp = t.closest('.sc-opts'), opts = Array.from(grp.querySelectorAll('.sc-opt')), i = opts.indexOf(t);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const n = opts[(i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length]; n.focus(); n.click(); }
        else { const gi = cards.indexOf(grp), ng = cards[(gi + (e.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length]; (ng.querySelector('.is-on') || ng.querySelector('.sc-opt')).focus(); }
        return true;
      }
      return false;
    });
    const paint = () => root.querySelectorAll('.sc-opt').forEach(b => { const on = st.policies[b.dataset.p] === b.dataset.v; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); });
    root.querySelectorAll('.sc-opt').forEach(b => { b.onclick = () => { st.policies[b.dataset.p] = b.dataset.v; paint(); }; });
    root.querySelector('[data-act="rec"]').onclick = () => { st.policies = Object.assign({}, DEFAULTS); paint(); };
    root.querySelector('[data-act="back"]').onclick = back;
    root.querySelector('[data-act="begin"]').onclick = done;
  }

  // ------------------------------------------------------------ banner
  function banner(ev, done) {
    enqueue(() => {
      ev = ev || {};
      const good = !!ev.good;
      show('banner', '<div class="sc-frame sc-pause' + (good ? ' is-good' : ' is-warn') + '">'
        + '<p class="sc-eyebrow sc-tag">' + (good ? 'Good news' : 'Heads up') + ' · game paused</p>'
        + '<h2 class="sc-h2 sc-ptitle" tabindex="-1">' + esc(sentence(ev.text || 'Something has happened')) + '</h2>'
        + (ev.sub ? '<p class="sc-ptext">' + esc(sentence(ev.sub)) + '</p>' : '')
        + (ev.tip ? '<div class="sc-tip"><span class="sc-tiplabel">What to do</span><p>' + esc(sentence(ev.tip)) + '</p></div>' : '')
        + '<div class="sc-grow"></div>'
        + '<button class="sc-btn sc-primary sc-full" data-act="ok" data-autofocus>Continue</button></div>', (e, onCtl) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && !onCtl) || e.key === ' ' && !onCtl) return click('[data-act="ok"]');
        return false;
      });
      root.querySelector('[data-act="ok"]').onclick = () => finish(done);
    });
  }

  // ------------------------------------------------------------ escalation
  const BOSS = ['your head of complaints', 'your compliance officer', 'your chief operating officer', 'your fraud team lead', 'your lawyer'];
  function hbTitle(id) { const e = (D().HANDBOOK || {})[id]; return e ? sentence(Array.isArray(e) ? e[0] : e.title || id) : null; }

  function escalate(g, id, done) {
    enqueue(() => {
      const list = D().CLINIC || [];
      const sc = list.find(x => x.id === id) || list[0];
      if (!sc) { finish(done); return; }
      const who = BOSS[(String(sc.id).length + num(g && g.day)) % BOSS.length];
      let h = '<div class="sc-frame sc-esc"><p class="sc-eyebrow sc-tag">Escalation from ' + who + ' · game paused</p>'
        + '<h2 class="sc-h2" tabindex="-1">' + esc(sentence(sc.title)) + '</h2>'
        + '<p class="sc-ptext">' + esc(sc.text) + '</p>'
        + '<p class="sc-ask">What do you do?</p><div class="sc-answers">';
      (sc.opts || []).forEach((o, i) => {
        h += '<button class="sc-ans" data-i="' + i + '"' + (i === 0 ? ' data-autofocus' : '') + '><span class="sc-key">' + (i + 1) + '</span><span>' + esc(o.t) + '</span></button>';
      });
      h += '</div></div>';
      show('escalate', h, e => {
        const n = digit(e);
        if (n && n <= (sc.opts || []).length) return click('[data-i="' + (n - 1) + '"]');
        return false;
      });
      root.querySelectorAll('[data-i]').forEach(b => { b.onclick = () => answer(g, sc, +b.dataset.i, done); });
    });
  }

  function answer(g, sc, idx, done) {
    const c0 = num(g && g.cash), h0 = num(g && g.heat), s0 = num(g && g.csat);
    let r = null;
    try { r = S().act && S().act.answerClinic ? S().act.answerClinic(g, idx) : null; } catch (e) { r = null; }
    const opt = (sc.opts || [])[idx] || {};
    const bestOpt = (sc.opts || []).find(o => o.ok) || {};
    if (!r) r = { ok: !!opt.ok, why: opt.why, best: bestOpt.t };
    const dc = num(g && g.cash) - c0, dh = num(g && g.heat) - h0, ds = num(g && g.csat) - s0;
    const fx = [];
    if (Math.round(dc)) fx.push('<span class="' + (dc > 0 ? 'sc-up' : 'sc-down') + '">' + signed(dc) + ' cash</span>');
    if (Math.round(ds)) fx.push('<span class="' + (ds > 0 ? 'sc-up' : 'sc-down') + '">' + (ds > 0 ? '+' : '-') + Math.abs(Math.round(ds)) + ' happiness</span>');
    if (Math.round(dh)) fx.push('<span class="' + (dh < 0 ? 'sc-up' : 'sc-down') + '">' + (dh > 0 ? '+' : '-') + Math.abs(Math.round(dh)) + ' regulator heat</span>');
    const hb = (sc.hb || []).map(hbTitle).filter(Boolean);
    const h = '<div class="sc-frame sc-esc sc-result ' + (r.ok ? 'is-good' : 'is-bad') + '">'
      + '<p class="sc-eyebrow sc-tag">' + esc(sentence(sc.title)) + '</p>'
      + '<h2 class="sc-h2 sc-verdict" tabindex="-1">' + (r.ok ? 'Good call' : 'Not the best call') + '</h2>'
      + '<p class="sc-you">You chose: ' + esc(opt.t || '') + '</p>'
      + '<p class="sc-ptext">' + esc(r.why || '') + '</p>'
      + (!r.ok && r.best ? '<div class="sc-tip"><span class="sc-tiplabel">Better answer</span><p>' + esc(r.best) + '</p></div>' : '')
      + '<div class="sc-grow"></div>'
      + '<div class="sc-resfoot"><p class="sc-fx">' + (fx.length ? fx.join('<i>·</i>') : 'No change to your numbers') + (hb.length ? '<span class="sc-hbnew">Handbook: ' + esc(hb.join(' · ')) + '</span>' : '') + '</p>'
      + '<button class="sc-btn sc-primary sc-wide" data-act="ok" data-autofocus>Continue</button></div></div>';
    show('escalate', h, (e, onCtl) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && !onCtl)) return click('[data-act="ok"]');
      return false;
    });
    root.querySelector('[data-act="ok"]').onclick = () => finish(done);
  }

  // ------------------------------------------------------------ handbook
  const PER_PAGE = 10;
  function handbook(g, done) {
    enqueue(() => {
      const HB = D().HANDBOOK || {}, ids = Object.keys(HB);
      const has = id => !!(g && g.hb && (typeof g.hb.has === 'function' ? g.hb.has(id) : Array.isArray(g.hb) ? g.hb.indexOf(id) >= 0 : g.hb[id]));
      const unlocked = ids.filter(has);
      // unlocked entries first, so the first page is the useful one
      const order = unlocked.concat(ids.filter(id => !has(id)));
      const entry = id => { const e = HB[id]; return Array.isArray(e) ? { title: e[0], body: e[1] } : { title: (e && e.title) || id, body: (e && (e.body || e.text)) || '' }; };
      let sel = unlocked[0] || null, page = 0;
      const pages = Math.max(1, Math.ceil(order.length / PER_PAGE));
      function render(focusSel) {
        let list = '';
        order.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).forEach(id => {
          list += has(id)
            ? '<button class="sc-hbitem' + (id === sel ? ' is-on' : '') + '" data-id="' + esc(id) + '" aria-pressed="' + (id === sel) + '">' + esc(sentence(entry(id).title)) + '</button>'
            : '<button class="sc-hbitem is-locked" disabled><span aria-hidden="true">■</span> Locked</button>';
        });
        const e = sel ? entry(sel) : null;
        const h = '<div class="sc-frame sc-hb"><div class="sc-headrow"><div><p class="sc-eyebrow">' + unlocked.length + ' of ' + ids.length + ' unlocked</p><h2 class="sc-h2">Handbook</h2></div>'
          + '<button class="sc-btn" data-act="close">Close</button></div>'
          + '<div class="sc-hbbody"><div class="sc-hbside"><div class="sc-hblist">' + list + '</div>'
          + (pages > 1 ? '<div class="sc-hbpager"><button class="sc-btn sc-sm" data-act="prev"' + (page === 0 ? ' disabled' : '') + ' aria-label="Previous page">Prev</button><span>Page ' + (page + 1) + ' of ' + pages + '</span><button class="sc-btn sc-sm" data-act="next"' + (page >= pages - 1 ? ' disabled' : '') + ' aria-label="Next page">Next</button></div>' : '')
          + '</div><article class="sc-hbentry" aria-live="polite">'
          + (e ? '<h3 class="sc-h3">' + esc(sentence(e.title)) + '</h3><p>' + esc(e.body) + '</p>'
            : '<h3 class="sc-h3">Nothing here yet</h3><p>Entries explain how disputes really work in the UK. They unlock as events happen and as you answer escalations.</p>')
          + '</article></div></div>';
        show('handbook', h, (ev, onCtl) => {
          if (ev.key === 'Escape') return click('[data-act="close"]');
          if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            const i = unlocked.indexOf(sel); if (i < 0) return true;
            const n = unlocked[(i + (ev.key === 'ArrowDown' ? 1 : -1) + unlocked.length) % unlocked.length];
            sel = n; page = Math.floor(order.indexOf(n) / PER_PAGE); render(true); return true;
          }
          if (ev.key === 'ArrowRight' || ev.key === 'PageDown') return click('[data-act="next"]');
          if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') return click('[data-act="prev"]');
          return false;
        });
        root.querySelectorAll('.sc-hbitem[data-id]').forEach(b => { b.onclick = () => { sel = b.dataset.id; render(true); }; });
        const pv = root.querySelector('[data-act="prev"]'), nx = root.querySelector('[data-act="next"]');
        if (pv) pv.onclick = () => { page = Math.max(0, page - 1); render(); const b = root.querySelector('[data-act="prev"]'); if (b && !b.disabled) b.focus(); };
        if (nx) nx.onclick = () => { page = Math.min(pages - 1, page + 1); render(); const b = root.querySelector('[data-act="next"]'); if (b && !b.disabled) b.focus(); };
        root.querySelector('[data-act="close"]').onclick = () => finish(done);
        if (focusSel) { const b = root.querySelector('.sc-hbitem.is-on'); if (b) b.focus(); }
      }
      render(false);
    });
  }

  // ------------------------------------------------------------ end screen
  function components(score) {
    const pts = (score && score.pts) || {};
    const maxes = (score && (score.maxes || score.ptsMax || score.maxPts)) || {};
    const out = [];
    for (const raw in pts) {
      const k = LABEL_ALIASES[raw] || raw, meta = COMP[k] || { label: sentence(raw), max: 10 };
      const max = num(maxes[raw]) || num(maxes[k]) || meta.max;
      if (k === 'growth' && !num(maxes[raw]) && !num(pts[raw])) continue; // removed in v1
      out.push({ key: k, label: meta.label, pts: num(pts[raw]), max });
    }
    return out;
  }

  function insight(key, g, score) {
    const late = num(g.slaBad), closed = num(g.closed), cl = g.clinic || {};
    const fin = g.fin || {};
    const backlog = (S().queuedTotal ? (function () { try { return S().queuedTotal(g); } catch (e) { return 0; } })() : 0);
    const busy = Math.round(num(score.effAvg) * 100);
    switch (key) {
      case 'sla': return {
        title: 'Cases went late while they waited in a queue',
        body: (late ? late + ' cases closed after their deadline. ' : '') + 'Most of that time was spent waiting for a free agent, not being worked. An AI agent that answers disputes around the clock starts on each case the moment it arrives, so most of these would have closed before their deadline.' };
      case 'money': return {
        title: 'Wages for routine steps ate the margin',
        body: (num(fin.wages) ? 'You paid ' + money(fin.wages) + ' in wages, the biggest cost in your run. ' : '') + 'Much of that paid for repeat work: logging claims, asking for details, and chasing evidence. Automating those steps lets a smaller team handle the same number of disputes, and your people spend their time on the cases that need judgement.' };
      case 'csat': return {
        title: 'Customers were left waiting without answers',
        body: 'Happiness fell each time a case went late, a claim was turned down, or a complaint sat unanswered. Automating the first reply and the routine updates means customers hear back the same day, even when your team is stretched.' };
      case 'flow': return {
        title: 'The queues never cleared',
        body: (backlog ? 'You finished with ' + Math.round(backlog) + ' cases still waiting. ' : '') + 'A team of people grows only as fast as you can hire and train, so every surge turns into a backlog. Automated handling takes on extra volume straight away, and new hires are no longer the only way to catch up.' };
      case 'reg': return {
        title: 'Legal deadlines were missed',
        body: 'The regulator\'s heat came from refunds and claims that missed their legal clock, such as refunding an unauthorised payment by the next business day. Automation that spots these cases on arrival and handles the routine ones at once takes the timing risk out of how many people are on shift.' };
      case 'eff': return {
        title: 'You paid for a lot of waiting',
        body: (busy ? 'Your agents were busy ' + busy + '% of the time you paid them for. ' : '') + 'Staffing for the busiest day means paying for quiet ones. When automation handles the routine volume, a smaller team covers the cases that need a person, and quiet days cost less.' };
      case 'learn': {
        const n = num(cl.right) + num(cl.wrong) + num(cl.missed);
        return {
          title: 'The tricky calls cost you',
          body: (n ? 'You got ' + num(cl.right) + ' of ' + n + ' escalations right. ' : '') + 'These cases turn on the detail of the rules, and people answer them differently on different days. An AI agent that follows your policies and the regulations gives the same answer every time and passes the unusual ones to an expert.' };
      }
      default: return {
        title: 'Every step here was done by hand',
        body: 'Every dispute in this game passed through people: logging, sorting, checking evidence, and replying. Automating the routine steps frees your team for the cases that need judgement.' };
    }
  }

  function finRows(g) {
    const f = g.fin || {}, C = S().C || {};
    const start = num(g.startCash) || num(C.START_CASH) || num((C.START_CASH_BY || {})[g.difficulty]);
    const rows = [], seen = new Set();
    const add = (label, keys, sign) => {
      let v = 0; keys.forEach(k => { if (k in f) { v += num(f[k]); seen.add(k); } });
      if (Math.round(v)) rows.push({ label, v: sign * v });
    };
    add('Income from customers', ['revenue', 'income'], 1);
    add('Money recovered', ['recovered'], 1);
    add('Wages', ['wages'], -1);
    add('Hiring, firing and temps', ['hiring'], -1);
    add('Upgrades and faster partner bank', ['capex'], -1);
    add('Tool licences', ['tech', 'licence'], -1);
    add('Refunds to customers', ['refunds'], -1);
    add('Card scheme and partner bank fees', ['fees', 'arb'], -1);
    add('Membership and compliance', ['fixed'], -1);
    add('Ombudsman fees and fines', ['fos', 'fines'], -1);
    const net = start ? num(g.cash) - start : null;
    if (net != null) {
      const known = rows.reduce((a, r) => a + r.v, 0), other = net - known;
      if (Math.abs(other) >= 1) rows.push({ label: 'Other (escalations, events and complaints)', v: other });
    }
    return { rows, net };
  }

  function chargebackShare(g) {
    const o = g.out || {};
    // g.closed also counts answered complaints and other banks' disputes against your shops; leave those out
    const closed = Math.max(0, num(g.closed) - num(o.complaint) - num(o.acqWon) - num(o.acqLost) - num(o.acqPre)) || ['early', 'merch', 'won', 'lost', 'declined', 'absorbed', 'reimb'].reduce((a, k) => a + num(o[k]), 0);
    const filed = g.cbFiled != null ? num(g.cbFiled) : num(o.won) + num(o.lost);
    return { closed, filed, pct: pct(filed, closed) };
  }

  function saveBest(g, score) {
    const pol = Object.assign({}, DEFAULTS, g.policies || (last && last.policies) || {});
    const diff = g.difficulty || (last && last.difficulty) || 'easy';
    const key = comboKey(diff, pol), all = bestAll(), prev = all[key];
    const total = Math.round(num(score.total));
    const isNew = !prev || total > num(prev.total);
    if (isNew) { all[key] = { grade: score.grade, total, max: num(score.max) || null, at: Date.now() }; store.set(K_BEST, all); }
    return { diff, pol, key, all: isNew ? all : all, prev, isNew };
  }

  function end(g, score, cb) {
    enqueue(() => {
      g = g || {};
      if (!score) { try { score = S().score(g); } catch (e) { score = {}; } }
      score = score || {};
      const comps = components(score);
      const max = num(score.max) || comps.reduce((a, c) => a + c.max, 0) || 100;
      const total = Math.round(num(score.total));
      const kind = (g.over && g.over.kind) || 'end';
      const day = Math.max(1, Math.ceil(num(g.t)) || num(g.day));
      const endDay = num((S().C || {}).END_DAY) || 40;
      const best = saveBest(g, score);
      const diffName = (DIFF.find(d => d.id === best.diff) || DIFF[0]).name;
      const cbs = chargebackShare(g);
      // a loss has an obvious cause; otherwise the lowest share of its maximum is the weakest
      const forced = kind === 'cash' ? comps.find(c => c.key === 'money') : kind === 'fca' ? comps.find(c => c.key === 'reg') : null;
      const weakest = forced || comps.slice().filter(c => c.max > 0).sort((a, b) => a.pts / a.max - b.pts / b.max)[0];
      const ins = insight(weakest ? weakest.key : '', g, score);

      const head = kind === 'cash'
        ? { t: 'Bankrupt on day ' + day, s: 'Cash fell below the limit and the board closed the operation. Wages and refunds ran ahead of income.' }
        : kind === 'fca'
          ? { t: 'Shut down by the regulator on day ' + day, s: 'Too many legal deadlines were missed, regulator heat reached 100%, and the regulator closed you down.' }
          : num(g.t) < endDay ? { t: 'Run stopped on day ' + day, s: 'The run ended before week 8, so this is a part-way score.' }
          : { t: 'You made it to the end of week 8', s: score.grade === 'S' ? 'Fast, cheap, and inside the rules. The operation ran about as well as it can.' : score.grade === 'A' ? 'A strong operation with a few leaks left to fix.' : score.grade === 'B' ? 'A solid run with room to tighten things up.' : 'You survived, but the factory creaked all the way.' };

      // score bars
      let bars = '';
      comps.forEach(c => {
        const neg = c.pts < 0, isW = weakest && c.key === weakest.key;
        // a negative score (a loss-making run) shows as a coral bar from the left with a "below zero" note
        const w = c.max ? Math.max(0, Math.min(100, Math.abs(c.pts) / c.max * 100)) : 0;
        bars += '<div class="sc-bar' + (isW ? ' is-weak' : '') + (neg ? ' is-neg' : '') + '"><span class="sc-bl">' + esc(c.label) + (isW ? ' <em>weakest</em>' : '') + '</span>'
          + '<span class="sc-bt" role="img" aria-label="' + esc(c.label) + ' ' + Math.round(c.pts) + ' of ' + c.max + '"><i style="width:' + w.toFixed(1) + '%"></i>' + (neg ? '<b style="' + (w >= 40 ? 'left:6px;color:#000' : 'left:calc(' + w.toFixed(1) + '% + 6px)') + '">Below zero</b>' : '') + '</span>'
          + '<span class="sc-bv">' + Math.round(c.pts) + '/' + c.max + '</span></div>';
      });

      // profit and loss
      const fr = finRows(g);
      let pl = '';
      fr.rows.forEach(r => { pl += '<tr><td>' + esc(r.label) + '</td><td class="' + (r.v < 0 ? 'sc-neg' : 'sc-pos') + '">' + signed(r.v) + '</td></tr>'; });
      if (fr.net != null) pl += '<tr class="sc-total"><td>Change in cash</td><td class="' + (fr.net < 0 ? 'sc-neg' : 'sc-pos') + '">' + signed(fr.net) + '</td></tr>';

      // outcomes
      const o = g.out || {};
      const outs = OUT.filter(r => num(o[r[0]]) > 0);
      const omax = Math.max(1, ...outs.map(r => num(o[r[0]])));
      let ol = '';
      outs.forEach(r => {
        const n = num(o[r[0]]), cb = r[0] === 'won' || r[0] === 'lost';
        ol += '<li class="' + (cb ? 'is-cb' : '') + '"><span class="sc-ol"><b>' + esc(r[1]) + '</b><small>' + esc(r[2]) + '</small></span><span class="sc-ot"><i style="width:' + (n / omax * 100).toFixed(1) + '%"></i></span><span class="sc-on">' + n.toLocaleString('en-GB') + '</span></li>';
      });
      const comp = num(o.complaint);

      // best grades for this difficulty
      let bt = '';
      const mine = Object.keys(best.all).filter(k => k.split('|')[0] === best.diff).sort((a, b) => num(best.all[b].total) - num(best.all[a].total)).slice(0, 4);
      mine.forEach(k => {
        const p = k.split('|'), r = best.all[k];
        bt += '<tr' + (k === best.key ? ' class="is-this"' : '') + '><td>' + esc(polName('queue', p[1])) + ' · ' + esc(polName('credit', p[2])) + ' · ' + esc(polName('risk', p[3])) + '</td><td class="sc-g">' + esc(r.grade) + '</td><td>' + num(r.total) + '</td></tr>';
      });
      let perDiff = '';
      DIFF.forEach(d => { const b = bestForDiff(d.id); perDiff += '<span class="sc-pd' + (d.id === best.diff ? ' is-this' : '') + '"><small>' + d.name + '</small>' + (b ? '<b>' + esc(b.grade) + '</b>' : '<i>Not played</i>') + '</span>'; });

      const headline = cbs.closed ? (cbs.pct < 40 ? 'Only ' : '') + cbs.pct + '% of the disputes I closed became chargebacks.' : 'Score ' + total + ' out of ' + max + '.';
      const share = 'Dispute Factory: I got grade ' + (score.grade || 'D') + ' on ' + diffName + (kind === 'end' ? '' : kind === 'cash' ? ' (went bankrupt on day ' + day + ')' : ' (shut down by the regulator on day ' + day + ')') + '. ' + headline
        + (/^https?:/.test(location.protocol) ? ' ' + location.href.split('?')[0] : '');

      const h = '<div class="sc-end">'
        + '<header class="sc-ehero">'
        + '<div class="sc-grade" aria-label="Grade ' + esc(score.grade || 'D') + '">' + esc(score.grade || 'D') + '</div>'
        + '<div class="sc-ehtext"><p class="sc-eeb"><i aria-hidden="true">■</i> ' + diffName + ' · ' + (kind === 'end' && num(g.t) >= endDay ? endDay : Math.min(day, endDay)) + ' of ' + endDay + ' days</p>'
        + '<h1 tabindex="-1" data-autofocus>' + esc(head.t) + '</h1><p>' + esc(head.s) + '</p>'
        + '<p class="sc-score"><b>' + total + '</b> out of ' + max + (best.isNew && best.prev ? ' <em>New best for these rules</em>' : '') + (kind !== 'end' ? '<small class="sc-why">An early finish always counts as grade D.</small>' : score.capped ? '<small class="sc-why">Enough for an S, but Easy tops out at A. Try Medium.</small>' : '') + '</p></div>'
        + '<div class="sc-eact"><button class="sc-ebtn sc-eprimary" data-act="replay">Play again with different rules</button><button class="sc-ebtn" data-act="share">Share result</button><span class="sc-status" role="status" aria-live="polite"></span></div>'
        + '</header>'
        + '<section class="sc-upsell" aria-labelledby="sc-upsell-h"><div class="sc-uptext"><h2 id="sc-upsell-h">Tired of playing this game?</h2><p>Automate your disputes with Gradient Labs.</p></div>'
        + '<a class="sc-upbtn" href="https://gradient-labs.ai/demo" target="_blank" rel="noopener">' + MARK + '<span>Book a demo</span></a></section>'
        + '<section class="sc-ecard sc-insight"><p class="sc-eeb"><i aria-hidden="true">■</i> What automation would have changed: ' + esc(weakest ? weakest.label.toLowerCase() : 'your run') + '</p>'
        + '<h2>' + esc(ins.title) + '</h2><p>' + esc(ins.body) + '</p></section>'
        + '<div class="sc-egrid">'
        + '<section class="sc-ecard"><h2>How your score adds up</h2><div class="sc-bars">' + bars + '</div></section>'
        + '<section class="sc-ecard"><h2>Where the money went</h2>' + (pl ? '<table class="sc-pl">' + pl + '</table>' : '<p>No money moved.</p>') + '</section>'
        + '</div>'
        + '<section class="sc-ecard"><h2>What happened to every dispute</h2>'
        + '<p class="sc-headline">' + (cbs.closed ? (cbs.pct < 40 ? 'Only ' : '') + '<b>' + cbs.pct + '%</b> of the ' + cbs.closed.toLocaleString('en-GB') + ' disputes you closed became chargebacks.' : 'You did not close any disputes.') + '</p>'
        + '<p class="sc-small">A chargeback is when the bank claims the money back from the shop\'s bank under the card scheme\'s rules. Most disputes end sooner, and more cheaply, than that.' + (comp ? ' Your team also answered ' + comp.toLocaleString('en-GB') + ' complaints.' : '') + '</p>'
        + (ol ? '<ul class="sc-outs">' + ol + '</ul>' : '') + '</section>'
        + '<div class="sc-egrid">'
        + '<section class="sc-ecard"><h2>Your rules</h2><ul class="sc-rules">'
        + POLICIES.map(p => '<li><small>' + p.name + '</small><b>' + esc(polName(p.key, best.pol[p.key])) + '</b></li>').join('')
        + '</ul><p class="sc-small">Try a different combination to see how it changes the grade.</p></section>'
        + '<section class="sc-ecard"><h2>Your best grades</h2><div class="sc-pds">' + perDiff + '</div>'
        + (bt ? '<table class="sc-bt2"><caption>' + diffName + ', by rules</caption>' + bt + '</table>' : '') + '</section>'
        + '</div>'
        + '<footer class="sc-efoot"><button class="sc-ebtn sc-eprimary" data-act="replay2">Play again with different rules</button><a class="sc-elink" href="https://gradient-labs.ai" target="_blank" rel="noopener">' + MARK + '<span>gradient-labs.ai</span></a></footer>'
        + '</div>';

      show('end', h, (e, onCtl) => {
        if (e.key === 'Enter' && !onCtl) return click('[data-act="replay"]');
        return false;
      }, 'light');
      const replay = () => { replayPending = true; finish(cb, 'replay'); };
      root.querySelector('[data-act="replay"]').onclick = replay;
      root.querySelector('[data-act="replay2"]').onclick = replay;
      root.querySelector('[data-act="share"]').onclick = () => doShare(share);
    });
  }

  function doShare(text) {
    const st = root && root.querySelector('.sc-status');
    const say = m => { if (st) st.textContent = m; };
    const copy = () => {
      const fallback = () => {
        try {
          const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
          root.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); root.removeChild(ta);
          say(ok ? 'Copied to your clipboard' : text);
        } catch (e) { say(text); }
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => say('Copied to your clipboard'), fallback);
        else fallback();
      } catch (e) { fallback(); }
    };
    try {
      if (navigator.share) { navigator.share({ title: 'Dispute Factory', text }).then(() => say('Shared'), err => { if (!err || err.name !== 'AbortError') copy(); }); return; }
    } catch (e) { /* fall through */ }
    copy();
  }

  window.Screens = {
    start, banner, escalate, handbook, end,
    isOpen: () => open || pending.length > 0,
  };
})();
