# Dispute Factory v1: sim API

Owner: SIM agent. Source of truth for `data.js` and `sim.js`. The shape below is final; numeric values of constants may still be tuned (read them from `Sim.C` / `GAMEDATA`, never hard-code).

Load order: `data.js` (sets `window.GAMEDATA`), then `sim.js` (sets `window.Sim`). Under Node both use `module.exports`. The sim never touches the DOM and is deterministic for a given seed.

## Create and run

```js
const g = Sim.create({
  difficulty: 'easy' | 'medium' | 'hard',          // default 'easy'; anything else falls back to 'easy'
  policies: { queue: 'fifo' | 'edf' | 'regulated', // default 'edf'
              credit: 'always' | 'regulated',      // default 'regulated'
              risk: 'strict' | 'lenient' },        // default 'strict'
  seed,       // optional number; seeds the global RNG (same as Sim.seed(n))
  headless,   // optional; true = no events pushed to g.ev (for bots)
});
Sim.step(g, dt)   // advance dt days (fractional). No-op once g.over is set.
```

Missing or invalid policy values fall back to the defaults. `g.policies` is frozen.

The run ends when `g.over` becomes non-null: `{kind: 'end'}` at day 40, `{kind: 'cash'}` when cash < -25,000, `{kind: 'fca'}` when heat reaches 100.

## Read-only helpers

| Call | Returns |
|---|---|
| `Sim.score(g)` | `{ pts, total, max, grade, capped, slaAll, profit, backlogDays, effAvg }`. `pts` = `{money, sla, csat, flow, reg, eff, learn}` (max 20, 25, 15, 10, 10, 10, 6). `max` = 96. `grade` 'S'/'A'/'B'/'C'/'D' (thresholds in `Sim.C.GRADES`). Easy is capped at A (`capped: true` when an S was cut to A). Any early loss = 'D'. `profit` = cash - start cash + 60% of capital spend (`g.fin.capex`). |
| `Sim.forecast(g)` | Next scheduled event for this difficulty whose day is after `g.day`: `{ name, day, daysAway, tip }` (`daysAway` fractional, >= 0), or `null` when none remain. |
| `Sim.eventsFor(g)` | All scheduled events for this difficulty (array of the `Sim.EVENTS` objects: `{day, minEra, name, text, tip, dur, ...}`). |
| `Sim.stationOrder(g)` | Station ids in left-to-right flow order (see table below). |
| `Sim.can(g, action, id)` | Boolean, for greying buttons. `action`: `'hire' \| 'fire' \| 'outsource' \| 'upgrade' \| 'sponsor'` (`id` ignored for sponsor). False once `g.over`. |
| `Sim.slaRate(g)` | On-time share of the last 60 cases (0-1). |
| `Sim.costPerCase(g)` | Operating cost / cases closed over ~5 days; 0 until 10 cases closed. |
| `Sim.queuedTotal(g)` | Cases waiting in staffed queues plus the sponsor queue. |
| `Sim.week(g)` | 1..8. |
| `Sim.sponsorCap(g)` | Sponsor filings per day (easy only; 0 otherwise). |
| `Sim.capacity(s)` | Station `s` throughput in cases/day (after ramp-up, temps, upgrade). |
| `Sim.rateOf(s)` | Per-agent cases/day for station `s` (after upgrade). |
| `Sim.busyN(s)` | Agents currently working a case. |
| `Sim.teamErr(s)` | Average rework rate (0-1) for station `s`; 0 for teams that do not rework. |
| `Sim.licence(s)` | Daily licence cost of station `s` (0 or `C.UP_LIC`). |
| `Sim.riskEff(g)` | Merchant risk cover 0-1 (hard only). |
| `Sim.revScale(g)` | Current revenue multiplier from happiness (0.5-1). |
| `Sim.baseRate(g)` | Current base arrivals per day. |

## Actions

All return truthy on success, falsy if not allowed or unaffordable. Each is exactly what `Sim.can` checks.

| Action | Rule |
|---|---|
| `Sim.act.hire(g, id)` | Staffed station (`kind` 'work' or 'policy'), < 12 workers, and paying would not take cash below `C.CASH_FLOOR` (hiring works in overdraft). Costs `C.HIRE`. New agent ramps for `C.HIRE_RAMP` days at 40% speed. |
| `Sim.act.fire(g, id)` | Staffed station with >= 1 worker. Fires an idle permanent agent first (fee `C.FIRE`); if only temps remain, removes a temp for free. Their case goes back to the queue. |
| `Sim.act.outsource(g, id)` | Only stations with `def.outsource`. Adds two temps (max `C.MAX_TEMPS` temps per team, 12 workers total; works in overdraft like hire), cost `2 * C.TEMP_SETUP`, wage `C.TEMP_WAGE`/day, speed `C.TEMP_SPEED`, ramp `C.TEMP_RAMP` days, leave after `C.TEMP_DAYS` days, +8 points error rate. |
| `Sim.act.upgrade(g, id)` | Staffed station with `tech === 0`, cash >= `C.UP_COST`. Sets `tech = 1`: per-agent speed x`C.UP_SPEED`, error rate -10 points, better intake completeness, triage resolution, evidence quality and representment calls. Adds `C.UP_LIC` per day. Works on Merchant risk too (cover x1.5). |
| `Sim.act.sponsor(g)` | Easy only. Next sponsor tier, costs `C.SPONSOR_COST[g.sponsorTier]` (3 tiers), each +`C.SPONSOR_STEP` filings/day. |
| `Sim.act.answerClinic(g, idx)` | Answers the current escalation `g.clinic.cur`. Returns `{ ok, why, best }` (`best` = text of the right option), or `null` if no escalation is open or `idx` is invalid. Right: +£800, +2 happiness (before the gain damping below), -6 heat. Wrong: -£600, +3 heat, -1.5 happiness. |

Removed from v0: `expand`, `canExpand`, `buy`, `policy`, `train`, `tech`, `pizza`; no `offer` events; no `g.shop`, `g.policy`, `s.train`, `GAMEDATA.SHOP`, `GAMEDATA.ERAS`, `GAMEDATA.TRAIN_NAMES`, `def.label`, `def.col`, `def.techs`.

## State `g` the UI may read

| Field | Meaning |
|---|---|
| `g.t` | Time in days (fractional). |
| `g.day` | Whole days elapsed (0..40). Day ticks happen when `g.t` crosses an integer. |
| `g.cash` | Pounds. |
| `g.startCash` | Starting cash for this difficulty (use this, not `C.START_CASH`, for profit). |
| `g.csat` | Customer happiness 0-100 (starts 75, drifts 8% a day towards 68). Positive changes are damped by `C.CSAT_UP`. Scales revenue from 50% (20 or below) to 100% (`C.CSAT_FULL` = 90 or above); `Sim.revScale(g)` gives the current multiplier. |
| `g.heat` | Regulator heat 0-100. Cools `C.HEAT_COOL` per day. Thresholds 50/75/90 emit news; 75 emits a banner. |
| `g.over` | `null` or `{kind: 'end' \| 'cash' \| 'fca'}`. |
| `g.difficulty` | 'easy' / 'medium' / 'hard'. |
| `g.era` | 1, 2 or 3 (easy, medium, hard). Fixed. |
| `g.policies` | `{queue, credit, risk}` (frozen). |
| `g.P` | This difficulty's tuning row (`Sim.C.DIFF[g.difficulty]`). |
| `g.wage` | Daily wage per permanent agent this run. |
| `g.st` | Map id -> station. **Only this difficulty's stations exist** (all have `unlocked: true`). Prefer iterating `Sim.stationOrder(g)`. |
| `g.sponsorTier` | 0..3 (easy). |
| `g.clinic` | `{ cur: null \| {id}, right, wrong, missed, next, used: Set }`. `cur.id` indexes `GAMEDATA.CLINIC`. |
| `g.fin` | Finance log by category (positive amounts): income `revenue`, `recovered`, `misc` (also used for grants, clinic rewards, complaint payouts and penalties; it is mixed, so treat it as "other"); costs `wages`, `tech` (licences), `fixed` (membership/compliance), `hiring` (hire, fire, temp set-up), `capex` (upgrades, sponsor tiers), `refunds`, `fees` (sponsor/scheme/representment filings), `arb` (lost pre-arbitration), `fos` (Ombudsman), `fines`. Categories appear only once used. |
| `g.out` | Outcome counters: `early` (resolved at triage), `merch` (merchant refunded), `won`, `lost`, `declined`, `absorbed` (we took the loss: 3-D Secure, small, out of window, or a lenient goodwill payment), `reimb` (APP/DD reimbursed), `complaint` (complaints closed), `acqWon`, `acqLost` (hard). |
| `g.cbFiled` | Chargebacks filed. |
| `g.closed` | Cases closed (all types, including complaints). |
| `g.openN` | Cases open. |
| `g.hb` | `Set` of unlocked handbook ids (keys of `GAMEDATA.HANDBOOK`). Medium starts with 'issuer', hard with 'issuer' and 'acquirer'. |
| `g.active` | Running events `[{name, until, mods, vol, spd}]`. |
| `g.merch` | Hard: merchant book `[{name, quality, share, cbWin, insolvent?}]`. |
| `g.slaOk`, `g.slaBad` | Lifetime on-time / late counts. |
| `g.eff` | `{paid, busy}` agent-days, efficiency = busy/paid. |
| `g.ev` | Event queue (see below). The UI drains it (`g.ev.length = 0` or splice). |

### Station `g.st[id]`

`{ id, def, unlocked: true, workers: [{ramp, c, left, temp, until}], queue: [case], list: [{c, ready}], tech: 0|1, stress 0-1, util 0-1, pressure, tokens, idleDays?, warnDay? }`

- `workers[i].ramp` > 0 while ramping up; `c` is the case in hand or null; `temp` boolean; `until` = day the temp leaves.
- `queue` is waiting cases (staffed stations and SPONSOR). External stations MERCH and ACQW hold their cases in `list` (`{c, ready}`), not `queue`; SPONSOR uses both (queue = waiting for cap, list = being filed, 1 day).
- `pressure` = queue per agent (queue x 2 if nobody is staffed). Jam line is `C.JAM` (3). For SPONSOR it is queue / (cap/2). For RISK it is 0 and `util` = cover.
- `stress` > 0.75 means 30% daily chance of a quit.

`def` (also `GAMEDATA.STATIONS[id]`): `{ name, short (<=6 chars), team, era, kind: 'work' | 'policy' | 'ext', rate, outsource?: true, blurb (one line), desc, upgrade? (name of the upgrade; staffed only) }`.

### Stations per difficulty, in `Sim.stationOrder` order

| id | name | short | kind | temps | easy | medium | hard |
|---|---|---|---|---|---|---|---|
| INTAKE | Intake | Intake | work | yes | x | x | x |
| TRIAGE | Triage | Triage | work | yes | x | x | x |
| FRAUD | Fraud ops | Fraud | work | | x | x | x |
| PAYOPS | Payments ops | Paymts | work | | | x | x |
| EVID | Review | Review | work | yes | x | x | x |
| SPONSOR | Sponsor bank | Sponsr | ext | | x | | |
| SCHEME | Scheme ops | Scheme | work | | | x | x |
| MERCH | Merchant response | Merch | ext | | x | x | x |
| REPR | Representment desk | Repres | work | | | x | x |
| COMPL | Complaints | Compl | work | yes | x | x | x |
| ACQIN | Acquiring intake | AcqIn | work | | | | x |
| MEVID | Merchant evidence | MEvid | work | | | | x |
| REPSUB | Representment filing | RepOut | work | | | | x |
| ACQW | Issuer review | Issuer | ext | | | | x |
| RISK | Merchant risk | Risk | policy | | | | x |

Counts: easy 7 wells (5 staffed), medium 9 (8 staffed), hard 14 (12 staffed: 11 'work' + RISK 'policy'). RISK is staffed (hire/fire/upgrade) but no cases flow through it; render it as a staffed column with no case stack, or a coverage bar from `util`. Externals: SPONSOR (rail action "Faster tier" via `Sim.act.sponsor`), MERCH, ACQW. No team starts with staff.

Flow: INTAKE -> TRIAGE -> (FRAUD -> EVID) | PAYOPS | EVID -> SPONSOR or SCHEME -> MERCH -> (won) or representment back to EVID (easy) or REPR. Complaints jump from anywhere to COMPL. Hard adds ACQIN -> MEVID -> REPSUB -> ACQW.

### Case

`{ id, type, amt, born, due, win, threeDS, complete, bounced, q, stage: 'new' | 'rep', credited, slaDone, lateFlag?, at, who?, shop?, m? (merchant index, ACQ), repDue? }`

- Deadline field is `due` (in days, compare with `g.t`). Late = `g.t > c.due && !c.slaDone`. For representments (`stage === 'rep'`) the working deadline is `repDue`.
- `GAMEDATA.TYPES[c.type]` = `{ name, regulated, col, sla, era, blurb }`.

| type | name | regulated | col |
|---|---|---|---|
| RECOG | Don't recognise | false | #FF8933 |
| FRAUD | Unauthorised | true | #F27C71 |
| GNR | Not received | false | #FF8933 |
| DUP | Duplicate charge | false | #FF8933 |
| SUB | Cancelled subscription | false | #FF8933 |
| FRIEND | Friendly fraud | false | #FF8933 |
| LATE | Out of time | false | #FF8933 |
| APP | APP scam | true | #F27C71 |
| DD | Direct Debit | true | #F27C71 |
| ACQ | Acquiring chargeback | false | #FF8933 |
| COMP | Complaint | false | #FFED77 |

## Events in `g.ev`

| Shape | Notes |
|---|---|
| `{k:'move', from, to, col}` | A case moves. `from` null = new arrival. `col` is one of `#FF8933` (ordinary), `#F27C71` (regulated), `#FFED77` (complaint). `from` may be a station id with no well (never happens in v1 except 'EVID' as a default complaint source). |
| `{k:'closed', outcome}` | `outcome` is a key of `g.out`. |
| `{k:'float', at, text, col}` | `at` station id. Text like `+£120`, `-£450`, `Late`, `Redo`, `Bounced`, `Quit`. `col` is lucite `#7ACBA7` (gain), coral `#F27C71` (loss, late, quit) or gold `#FFED77` (redo, bounced). |
| `{k:'news', text, kind}` | One-line ticker. `kind`: 'info' / 'good' / 'bad' / 'event' / 'hb'. Sentence case. |
| `{k:'banner', text, sub, tip?, good?}` | Pause card. Sources: scheduled events (`text` = event name), 'Regulator warning' (heat 75), 'Overdraft' (cash < 0, re-arms after cash > 5,000), 'Regulator review' (good true/false). |
| `{k:'escalate', id}` | Pause for `GAMEDATA.CLINIC` scenario `id`; `g.clinic.cur.id` is the same. |
| `{k:'sfx', name}` | 'hire', 'fire', 'up', 'good', 'bad', 'event', 'hb'. |
| `{k:'hb', id}` | Handbook entry unlocked. |
| `{k:'story', text, tone}` | Short case anecdote (first of each outcome/type, then ~7%). `tone` 'good' / 'bad' / 'info'. |

Note: `create()` already pushes `hb`/`news` events for the starting handbook entries in medium and hard.

## Scheduled events

| Day | Name | Difficulty | Effect |
|---|---|---|---|
| 5 | Retailer data breach | all | 3 days, unauthorised x4, volume x1.4 |
| 9 | Flu season | all | 2 days, all work 25% slower |
| 15 | Airline collapses | all | 3 days, not-received x5, volume x1.8 |
| 20 | Black Friday | all | 4 days, volume x2.1 |
| 27 | Scam wave | medium, hard | 3 days, APP x4, volume x1.2 |
| 31 | Travelkite collapses | hard | 3 days; merchant fails, 14 chargebacks you may have to cover |
| 35 | Regulator review | all | heat > 40: £8,000 fine, -15 heat; else £3,000 grant, -10 heat |

Escalations: first on day 4, then 4 days after each answer, none in the last 2 days (about 8 per run). Pool: scenarios with `era <= g.era`, current-era scenarios 3x as likely.

## Policies (locked)

- **queue**: `fifo` takes the oldest case; `edf` the earliest `due`; `regulated` the earliest-due regulated case (FRAUD, APP, DD), else the oldest case. Applies to every staffed queue and the sponsor queue.
- **credit**: `always` refunds every card claim when the chargeback is filed (happiness up, cash out first; lost chargebacks keep the credit with the customer, 12% clawed back), and arrivals are `C.CREDIT_VOL` (x1.05) higher because customers learn that disputing pays. `regulated` refunds only unauthorised up front (APP/DD are always refunded).
- **risk**: `strict` catches 85% of first-party fraud at Fraud ops but declines 4% of genuine unauthorised claims, declines 1.5x as many claims at Review plus weak-evidence claims instead of filing them, declines out-of-window claims, and declines 20% of APP claims. `lenient` attracts more first-party fraud (15% of unauthorised claims instead of 9%) and catches only 30% of it (the rest is refunded, then mostly lost at chargeback), pays 40% of friendly-fraud claims and all out-of-window claims as goodwill (counted as `absorbed`), declines half as many claims at Review and 6% of APP, and resolves complaints better.

Measured with the smart bot over 32 seeds (see the final report or `POL=1 node tools/balance.js`): FIFO costs on-time rate, happiness and £7-9k; regulated-first is close to EDF for a well-run floor but, under strain, survives longer with ~40% more complaints; always-credit adds happiness and doubles refunds for about -£8k; lenient halves declines, cuts complaints by a quarter, adds 30-40% more lost chargebacks and 60-80% more absorbed claims, raises happiness and costs £3-9k.

Plain-English labels for the start screen are in `GAMEDATA.POLICIES` (`{queue|credit|risk: {name, options: {value: {name, line, rec?}}}}`) and `GAMEDATA.DIFFICULTIES` (`{easy|medium|hard: {name, era, title, blurb, maxGrade}}`).

## v0 shop programmes

All dropped. 'Deadline-aware queues' became the `edf` queue rule. 'Transaction clarity' and '3DS tuning' (era 1 volume cuts) and 'RDR alerts' / 'Compelling Evidence 3.0' (era 3) are gone; their effect is absorbed into per-difficulty arrival tuning. Their handbook entries ('rdr', 'ce3') still unlock through escalations.

## `Sim.C`

| Key | Value | Meaning |
|---|---|---|
| `END_DAY`, `WEEKS`, `DPW` | 40, 8, 5 | Run length |
| `WAGE` | 120 | Default daily wage (per run: `g.wage`) |
| `HIRE`, `FIRE` | 500, 300 | One-off costs |
| `MAX_STAFF` | 12 | Per team |
| `CASH_FLOOR`, `HEAT_MAX` | -25000, 100 | Lose conditions |
| `START_CASH` | easy start cash (per run: `g.startCash`) | |
| `UP_COST`, `UP_LIC`, `UP_SPEED` | one number each | Upgrade price, daily licence, speed multiplier |
| `SPONSOR_COST` | [3 prices] | Sponsor tiers |
| `SPONSOR_BASE`, `SPONSOR_STEP` | 8, 5 | Sponsor cap = base + step x tier |
| `SPONSOR_FEE`, `SCHEME_FEE`, `PREARB_FEE`, `FOS_FEE`, `REPSUB_FEE` | 11, 3, 450, 700, 4 | Fees |
| `MEMBERSHIP`, `ACQ_COMPLIANCE` | 280, 220 | Informational; actual daily fixed cost is `g.P.fixed` |
| `TEMP_WAGE`, `TEMP_SETUP`, `TEMP_DAYS`, `TEMP_SPEED`, `MAX_TEMPS`, `TEMP_RAMP` | 70, 150, 6, 0.65, 4, 0.5 | Temps |
| `HIRE_RAMP`, `RAMP_SPEED` | 2, 0.4 | New hire ramp-up days and speed |
| `HEAT_COOL` | 1 | Heat cooling per day |
| `CSAT_START`, `CSAT_REST`, `CSAT_DRIFT`, `CSAT_UP`, `CSAT_FULL` | 75, 68, 0.08, 0.3, 90 | Happiness model |
| `CREDIT_VOL` | 1.05 | Arrival multiplier under always-credit |
| `STRESS_UP`, `STRESS_DOWN`, `BURNOUT_AT`, `BURNOUT_P` | 0.2, 0.1, 0.75, 0.3 | Stress per day above/below load 3; quit chance per day above the threshold |
| `JAM` | 3 | Pressure at the jam line |
| `CLINIC_FIRST`, `CLINIC_GAP`, `CLINIC_RIGHT`, `CLINIC_WRONG` | 4, 4, 800, 600 | Escalations |
| `GRADES` | `{S, A, B, C}` thresholds | out of `MAX_PTS` |
| `MAX_PTS` | 96 | |
| `COL` | `{ordinary, regulated, complaint, good, bad, warn}` | Palette hexes used by the sim |
| `DIFF` | `{easy, medium, hard}` -> `{era, cash, base, growth, rev, wage, fixed, acqBase, acqRev, acqGrowth, profit}` | Per-difficulty tuning |

`GAMEDATA` exports: `TYPES`, `STATIONS`, `HANDBOOK` (id -> [title, text]), `CLINIC` ([{id, era, hb, title, text, opts: [{t, ok, why}]}]), `DIFFICULTIES`, `POLICIES`, `COLORS` (`{ordinary, regulated, complaint}`).
