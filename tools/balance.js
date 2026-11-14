// Headless balance harness for v1.
//   node tools/balance.js [easy|medium|hard ...]       (default: all three)
//   SEEDS=1,2,3 BOTS=smart,idle V=1 POL=1 node tools/balance.js hard
//   POLICY=credit=always,risk=lenient  runs the bots under those policies. TRACE=1 prints each day. FIN=1 prints finance.
// V=1 prints a line per run; POL=1 also compares each policy option under the smart bot.
const Sim = require('../sim.js');
const D = require('../data.js');

const DT = 0.02;
const ENV_POL = process.env.POLICY ? Object.fromEntries(process.env.POLICY.split(',').map(kv => kv.split('='))) : undefined;
function run(diff, bot, seedN, policies) {
  const g = Sim.create({ difficulty: diff, policies: policies || ENV_POL, seed: seedN, headless: true });
  let lastDay = -1;
  while (!g.over) {
    Sim.step(g, DT);
    if (g.day !== lastDay) {
      lastDay = g.day; bot(g);
      if (process.env.TRACE) console.log(`  d${g.day} cash=${Math.round(g.cash)} csat=${g.csat | 0} heat=${g.heat | 0} sla=${(Sim.slaRate(g) * 100) | 0}% ` +
        Sim.stationOrder(g).map(id => { const s = g.st[id]; return s.def.short + ':' + s.workers.length + (s.tech ? '*' : '') + '/' + s.queue.length; }).join(' '));
    }
    if (g.clinic.cur) answer(g, bot.wrong);
  }
  const s = Sim.score(g);
  const staff = Object.values(g.st).reduce((a, x) => a + x.workers.length, 0);
  return { g, s, staff };
}
function answer(g, wrongRate) {
  const sc = D.CLINIC.find(x => x.id === g.clinic.cur.id);
  let i = sc.opts.findIndex(o => o.ok);
  if (wrongRate && ((g.day * 7 + sc.id.length) % 10) / 10 < wrongRate) i = (i + 1) % sc.opts.length;
  Sim.act.answerClinic(g, i);
}
const staffedIds = g => Sim.stationOrder(g).filter(id => g.st[id].def.kind === 'work');

// ---------- bots ----------
const idle = () => {};

// Smart: checks daily, hires to keep queues short, uses temps for surges, fires only after
// several quiet days, upgrades the biggest team, keeps Merchant risk covered, buys sponsor tiers.
const smart = g => {
  const fc = Sim.forecast(g);
  const surge = (fc && fc.daysAway <= 2.5 && /Black Friday|breach|Airline/.test(fc.name)) || g.active.some(a => a.vol);
  g._quiet = g._quiet || {};
  for (const id of staffedIds(g)) {
    const s = g.st[id], n = s.workers.length;
    if ((s.pressure > 2 || (n === 0 && s.queue.length)) && n < 12) {
      g._quiet[id] = 0;
      if (surge && s.def.outsource && Sim.act.outsource(g, id)) continue;
      const want = Math.min(2, Math.max(1, Math.ceil(s.queue.length / 3) - n));
      for (let k = 0; k < want; k++) Sim.act.hire(g, id);
    } else if (s.queue.length <= 1 && s.util < 0.55 && n > 1) {
      g._quiet[id] = (g._quiet[id] || 0) + 1;
      if (g._quiet[id] >= 3 && !surge) { Sim.act.fire(g, id); g._quiet[id] = 1; }
    } else g._quiet[id] = 0;
  }
  if (g.st.RISK) { const need = g.st.RISK.tech ? 2 : 3; if (g.st.RISK.workers.length < need && g.cash > 2000) Sim.act.hire(g, 'RISK'); }
  if (g.st.SPONSOR && g.st.SPONSOR.pressure > 1.2) Sim.act.sponsor(g);
  // Upgrade the biggest permanent team once the early surges have shown where the bottleneck is.
  if (g.cash > Sim.C.UP_COST + 15000 && g.day >= 8 && g.day < 30) {
    const perm = id => g.st[id].workers.filter(w => !w.temp).length;
    const ids = staffedIds(g).filter(id => !g.st[id].tech && perm(id) >= 4)
      .sort((a, b) => perm(b) - perm(a) || g.st[a].def.rate - g.st[b].def.rate);
    if (ids.length) Sim.act.upgrade(g, ids[0]);
  }
};

const gen = (every, thr) => g => {
  if (g.day % every !== 0) return;
  for (const id of staffedIds(g)) {
    const s = g.st[id];
    if ((s.pressure > thr || (!s.workers.length && s.queue.length > 3)) && s.workers.length < 12 && g.cash > 0) Sim.act.hire(g, id);
  }
  if (g.st.SPONSOR && g.st.SPONSOR.pressure > thr) Sim.act.sponsor(g);
};
const medium = gen(2, 2.5); medium.wrong = 0.3;
const casual = gen(5, 3.5); casual.wrong = 0.5;

const overhire = g => {
  for (const id of Sim.stationOrder(g)) {
    const s = g.st[id];
    if (s.def.kind !== 'work' && s.def.kind !== 'policy') continue;
    while (s.workers.length < 7 && Sim.can(g, 'hire', id)) Sim.act.hire(g, id);
  }
};

const BOTS = { smart, idle, medium, casual, overhire };

// ---------- report ----------
const seeds = (process.env.SEEDS || '1,2,3,4,5,6,7,8').split(',').filter(x => x.trim()).map(Number);
const diffs = process.argv.slice(2).filter(a => Sim.C.DIFF[a]);
const botNames = (process.env.BOTS || Object.keys(BOTS).join(',')).split(',');
const pad = (v, n) => String(v).padStart(n);
const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

function summary(diff, name, bot, policies) {
  const rs = seeds.map(sd => run(diff, bot, sd, policies));
  const grades = rs.map(r => r.g.over.kind === 'end' ? r.s.grade : r.s.grade + '(' + r.g.over.kind + ' d' + r.g.day + ')');
  if (process.env.FIN) { const f = {}; rs.forEach(r => { for (const k in r.g.fin) f[k] = (f[k] || 0) + r.g.fin[k] / rs.length; }); console.log('   fin ' + name + ' ' + Object.entries(f).map(([k, v]) => k + ':' + Math.round(v)).join(' ')); }
  if (process.env.V) rs.forEach((r, i) => console.log(`   ${name} s${seeds[i]} ${r.g.over.kind} d${r.g.day} ${r.s.grade} ${r.s.total.toFixed(1)} cash=${Math.round(r.g.cash)} profit=${Math.round(r.s.profit)} heat=${r.g.heat | 0} csat=${r.g.csat | 0} sla=${(r.s.slaAll * 100) | 0}% staff=${r.staff} ` + Object.entries(r.s.pts).map(([k, v]) => k + ':' + v.toFixed(1)).join(' ')));
  return {
    name, grades,
    total: avg(rs.map(r => r.s.total)), profit: avg(rs.map(r => r.s.profit)), cash: avg(rs.map(r => r.g.cash)),
    minCash: Math.min(...rs.map(r => r.g.cash)),
    sla: avg(rs.map(r => r.s.slaAll)), heat: avg(rs.map(r => r.g.heat)), csat: avg(rs.map(r => r.g.csat)),
    day: avg(rs.map(r => r.g.day)), declined: avg(rs.map(r => r.g.out.declined)), lost: avg(rs.map(r => r.g.out.lost)),
    compl: avg(rs.map(r => r.g.out.complaint)), refunds: avg(rs.map(r => r.g.fin.refunds || 0)), absorbed: avg(rs.map(r => r.g.out.absorbed)),
    rs,
  };
}

for (const diff of diffs.length ? diffs : ['easy', 'medium', 'hard']) {
  console.log(`\n=== ${diff.toUpperCase()}  seeds ${seeds.join(',')}`);
  console.log('bot       avgPts  profit   endCash  sla  heat csat  grades');
  for (const b of botNames) {
    const r = summary(diff, b, BOTS[b]);
    console.log(`${b.padEnd(9)} ${pad(r.total.toFixed(1), 6)} ${pad(Math.round(r.profit), 7)} ${pad(Math.round(r.cash), 8)} ${pad((r.sla * 100).toFixed(0), 4)}% ${pad(r.heat.toFixed(0), 4)} ${pad(r.csat.toFixed(0), 4)}  ${r.grades.join(' ')}`);
  }
  if (process.env.POL) {
    console.log(' policy (' + (process.env.POLBOT || 'smart') + ' bot, others default)'.padEnd(37) + 'pts  profit  sla  heat csat  decl  lost compl refunds absorb  day');
    const opts = [['queue', 'fifo'], ['queue', 'edf'], ['queue', 'regulated'], ['credit', 'always'], ['credit', 'regulated'], ['risk', 'strict'], ['risk', 'lenient']];
    for (const [k, v] of opts) {
      const r = summary(diff, k + '=' + v, BOTS[process.env.POLBOT || 'smart'], { [k]: v });
      console.log(` ${(k + '=' + v).padEnd(36)} ${pad(r.total.toFixed(1), 5)} ${pad(Math.round(r.profit), 7)} ${pad((r.sla * 100).toFixed(0), 3)}% ${pad(r.heat.toFixed(0), 4)} ${pad(r.csat.toFixed(0), 4)} ${pad(r.declined.toFixed(0), 5)} ${pad(r.lost.toFixed(0), 5)} ${pad(r.compl.toFixed(0), 5)} ${pad(Math.round(r.refunds), 7)} ${pad(r.absorbed.toFixed(0), 6)} ${pad(r.day.toFixed(1), 4)}  ${r.grades.join(' ')}`);
    }
  }
}
