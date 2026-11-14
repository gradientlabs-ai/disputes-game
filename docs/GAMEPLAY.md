# Dispute Factory: gameplay

## The premise

You run the disputes operation of a UK fintech bank for sixteen weeks. Customers raise disputes (a payment they do not recognise, goods that never arrived, a scam), and each one has to travel through a chain of teams until it is resolved. Treat the operation as a factory: cases are the work-in-progress, teams are stations, and your job is to keep the line moving cheaply, on time and inside the rules, without going broke or being shut down by the regulator.

The game is meant to teach how UK disputes actually work, so the rules follow reality where reality matters:

- Only a minority of disputes ever become card-scheme chargebacks. Many are resolved at intake, refunded by the merchant when asked, declined, or absorbed because a chargeback is not worth filing or not possible.
- Some regulated clocks are hard: unauthorised payments must be refunded by the end of the next business day, APP scam claims decided and reimbursed within five business days, Direct Debit errors refunded at once, complaints answered within the deadline or they can be referred to the Ombudsman, who charges the firm a fee.
- Different payment rails have different remedies. Cards have chargebacks. Faster Payments and Direct Debit do not, and have their own regimes.

The game is a simulation with a player who can only pull a few levers. There is no combat and no randomness the player can ignore: the interesting decisions are about staffing, timing and investment.

## What the player is trying to do

**Win:** reach the end of week 16 (80 business days) alive, and with the best grade you can get.

**Lose, immediately, if either of these happens:**

1. **Cash falls below -£25,000.** The board pulls the plug. Cash starts at £40,000.
2. **Regulator heat reaches 100%.** The FCA shuts the operation down. Heat rises when regulated clocks are missed and cools by 0.5 points a day.

**Doing nothing loses.** There is no starting staff, cases arrive from day zero, and stuck cases hurt customers, raise heat and cut income. An idle run is shut down by the regulator around day 19.

**Overstaffing loses.** Teams that are over-staffed do not quit and their cost to the business is detrimental.

## The scoreboard

Two public meters sit alongside cash:

- **Customer happiness (0 to 100, starts at 75).** Drifts back towards 68. Falls with late cases, declines, lost chargebacks and complaints; rises with fast resolutions, refunds, and well-handled complaints. It directly scales income (see economy).
- **Regulator heat (0 to 100, starts at 0).** Rises when regulated cases are late, when claims are filed or declined out of time, and when complaints reach the Ombudsman. Thresholds at 50%, 75% and 90% raise warnings.

Two derived numbers help the player steer: **on-time rate** (share of recent cases closed within their deadline) and **cost per case** (operating cost divided by cases closed over a five-day window).

## Time

One game day equals one business day. The sim advances in small continuous steps within each day; daily checks handle overdue cases, complaints, burnout, temp contracts ending, events, escalations and expansion offers. Five days make a week. The game pauses automatically for alerts, escalations and the board offer.

## The three eras

The business has three levels of difficulty, each adding teams, case types and risk. The player can pick their initial level of difficulty at the start.

| Era | Unlocked | What changes |
|---|---|---|
| **1. Sponsored** | Start | You are a fintech issuing cards under a sponsor bank. You run the front line; the sponsor bank files chargebacks for you. |
| **2. Issuer** | Board offer from day start + 20, costs £18,000 | You become a principal scheme member: you file chargebacks yourself, run a representment desk, and take on APP scam and Direct Debit claims. Volume rises 35%, income per case rises slightly, and you pay a daily scheme membership cost. |
| **3. Issuer + acquirer** | Board offer after 20 days of being an issuer, costs £26,000 | You start acquiring merchants. Incoming chargebacks arrive from other issuers, you must chase merchant evidence, and if a merchant collapses the loss is yours. Adds a daily compliance cost and a new income stream. |

Expansion is never forced. The board calls when it becomes available; the player decides whether they can afford the extra volume and cost. Taking it earns growth points in the final score, but only a stable operation can absorb it.

## The teams

A team is a station in the factory. Staffed teams have agents; each agent works one case at a time, and a team's speed is its headcount times its per-agent rate.

| Team | Era | Role | Base cases/agent/day | Can use temps |
|---|---|---|---|---|
| **Intake** (front line) | 1 | Logs the claim. Missing details cause rework later. | 9 | Yes |
| **Triage** | 1 | Routes each claim; resolves many "don't recognise" claims; declines out-of-time claims. | 12 | Yes |
| **Fraud Ops** | 1 | Refunds unauthorised payments by the next business day. | 6 | No |
| **Review** | 1 | Checks evidence, contacts merchants, decides whether to chargeback, decline or close. Also takes representments until you own the scheme link. | 4.2 | Yes |
| **Complaints** | 1 | Answers complaints before they rot. | 4 | Yes |
| **Sponsor gateway** | 1 | External. The sponsor bank files chargebacks for a fee, with a daily throughput cap and a day of latency. Cannot be staffed; you can only buy faster tiers. | cap 8 per day, +5 per tier | n/a |
| **Merchant response** | 1 | External. Merchants accept, stay silent or fight back. Not yours to staff. | n/a | n/a |
| **Scheme ops** | 2 | Replaces the sponsor. Your own team files chargebacks. | 8 | No |
| **Representment desk** | 2 | Reviews merchant counter-evidence: accept the loss or go to pre-arbitration. | 4.5 | No |
| **Payments ops** | 2 | APP scams and Direct Debit claims. | 5 | No |
| **Acquiring intake** | 3 | Intake for chargebacks against your merchants. | 9 | No |
| **Merchant evidence desk** | 3 | Collects merchant evidence and judges its strength. | 4 | No |
| **Representment filing** | 3 | Files representments on behalf of merchants. | 6 | No |
| **Issuer review** | 3 | External. The other bank decides. | n/a | n/a |
| **Merchant risk** | 3 | Monitoring policy rather than a flow station: its coverage cuts incoming acquiring volume and softens collapse losses. | 1 | No |

Every team starts empty. A team with nobody working in it still receives cases, which then wait. The maximum is **12 agents** per team.

## The cases

Eleven case types, each with its own deadline in business days:

| Case | Deadline | Nature |
|---|---|---|
| Don't recognise | 3 | Often resolved at triage (about 60% of the time, better with tooling); otherwise it becomes a fraud claim. |
| Unauthorised | 1.6 | Regulated. Refunded by Fraud Ops by the next business day, then investigated; 8% turn out to be first-party fraud and are declined. |
| Not received | 8 | Chargeback candidate after the merchant is contacted. |
| Duplicate charge | 8 | Usually clear-cut; the best chargeback odds. |
| Cancelled subscription | 8 | Needs proof of cancellation. |
| Friendly fraud | 8 | The customer did buy; declined. |
| Out of time | 3 | Past the roughly 120-day chargeback window; declined at triage. |
| APP scam (era 2) | 4.5 | Regulated. Reimbursed within five business days; half is recovered from the receiving bank. No chargeback exists. |
| Direct Debit (era 2) | 1.6 | Regulated. Refunded at once under the Direct Debit Guarantee, with most of it recovered from the originator. |
| Acquiring chargeback (era 3) | 8 | Another bank's customer disputes a purchase at one of your merchants. |
| Complaint | 6 | Spawned by failures. Left to rot it ends at the Ombudsman. |

### How a case flows

1. A case is born at **Intake**, which sometimes logs it incompletely.
2. **Triage** routes it. Out-of-time claims are declined. Don't-recognise claims are closed early or reclassified as fraud. Fraud goes to Fraud Ops; APP and Direct Debit go to Payments Ops; everything else goes to Services.
3. **Fraud Ops** refunds the customer first (the law), then the case goes on to Review to see whether money can be recovered.
4. **Review** decides the outcome. An incomplete case from intake is bounced back for a day or two. Otherwise it can be refunded by the merchant when asked, declined for weak evidence, absorbed (3-D Secure passed, under £12, or past the window), or sent to the scheme.
5. **Chargeback filing** is done by the sponsor bank (era 1, capped and charged £11 a case) or your own Scheme ops (era 2 onwards, £3 a case).
6. **Merchant response** follows. Most merchants accept and you win, with the money recovered. Some fight back with a representment, which returns to Services (era 1) or the Representment desk (era 2 onwards).
7. **Representment decision.** Accept the loss if the merchant's evidence is stronger; go to pre-arbitration only when yours is stronger, because losing in arbitration costs £450. A trained, tooled desk makes the right call more often.
8. **Closed outcomes** feed the end-of-game story: resolved early, refunded by merchant, won, lost, declined, absorbed, reimbursed outside the schemes.

In era 3, incoming acquiring chargebacks flow through Acquiring intake, Merchant evidence, Representment filing and Issuer review; a merchant that cannot produce evidence loses immediately.

### How complaints are made

Complaints are the game's way of punishing neglect and bad outcomes:

- A case that is more than half a day overdue has a 30% chance each day of generating a complaint.
- Declines (22% for substantive claims, 12% for friendly fraud and out-of-time), lost chargebacks (20% to 30% depending on credit policy) and low-probability closed outcomes (absorbed 10%, early closure 4%, and so on) can also spawn one.
- A complaint left more than a day past its deadline has a 20% chance each day of reaching the Ombudsman: **£700 fee**, +1 heat.
- Complaints answered in time are usually resolved for £60 and a 75% chance of a happiness bump.

## The economy

### Income

Revenue is continuous and tied to volume, not to individual cases: roughly £235 per unit of base arrival rate per day (£245 from era 2), where the arrival rate grows over time (9 cases a day at the start, rising 0.16 a day, and 35% higher in era 2). Era 3 adds a flat acquiring income that grows with time.

Revenue is then scaled between 50% and 100% by customer happiness: at happiness 80 and above the factory earns full price; at 20 and below it earns half. Unhappy customers cost real money.

Chargeback wins also return the disputed amount (when it was credited to the customer earlier); APP and Direct Debit recoveries give back part of the refund.

### Costs

- **Wages:** £120 per agent per day, paid whether the agent is busy or idle. Temps cost £70 a day.
- **Hiring and firing:** £500 to hire, £300 to fire.
- **Tooling licences:** £30, £70 or £130 a day per team once upgraded.
- **Refunds:** customers are refunded on regulated cases up front; other cases are refunded only if the credit policy is set to "always credit".
- **Scheme and sponsor fees:** £11 per sponsor filing, £3 per scheme filing, £450 for a lost pre-arbitration, £4 per representment filed.
- **Ombudsman fees** (£700) and **scheme fines** (£6,000 for merchant ratios in era 3; £8,000 for FCA findings).
- **Fixed costs:** scheme membership £280 a day in era 2; acquirer compliance £220 a day in era 3.

Profit is not just cash: capital spending on upgrades and programmes counts at 60% of its cost back into profit when scoring, so investing sensibly does not hurt your grade much.

## What the player controls

**Per team:**

- **Hire an agent.** New hires take three days to ramp up (working at 40% speed). Cost £500.
- **Fire an agent.** Costs £300 and saves £120 a day. Firing does not hurt the case they were working; it returns to the queue.
- **Summon temps** (Intake, Triage, Services, Complaints only). Two at a time, up to four per team. They cost £150 each to set up and £70 a day, need only one day of ramp-up, work at 65% speed, make more mistakes, and leave after ten days. They are the surge-capacity lever: cheaper per day and flexible, but slower and sloppier.
- **Upgrade.** Three levels per team, costing £4,000, £9,000 and £18,000. Each level combines training and tooling, raising every agent's speed by 18% (training) and 32% (tooling), reducing rework and error rates, and adding a daily licence cost.
- **Sponsor tier** (era 1): buy faster sponsor SLAs for £2,500, £5,000 and £9,000, each adding five cases a day to the cap.

**In escalations:** choose an answer to a scenario.

## What goes wrong, on purpose

### Queues and pressure

Each team tracks its **pressure** (queue length per agent). Pressure above 1.5 is a warning and above 3 is a jam; above 4 the player is notified in the ticker, at most once every eight days per team.

### Rework

Intake, Triage, Fraud Ops, Review, Scheme ops and Payments ops can make mistakes: the case goes back to the front of the same queue (at most twice per case). Base error rate is 12%, reduced 2.5 points per upgrade or training level, increased by stress (up to 10 points) and by temp staff (8 points). Rework silently eats capacity.

An Intake agent can also log a case incompletely (38% at the start). An incomplete case is later bounced back by Services to Intake for a day or two, then returned. Good intake reduces that cost downstream.

### Stress and burnout

A team whose load stays above three cases per agent builds stress over time. Above 0.75 stress, agents have a 30% daily chance of quitting. Stress makes agents slower and sloppier. Hiring reduces it.

### Idle staff

Teams with more than two agents and utilisation under 25% for five days are flagged as idle. This does not cost heat, but it destroys margin and efficiency points: wages never stop.

### Lateness

Cases past their deadline become **late**. A late case costs happiness the first time, adds heat in proportion to its regulatory weight (unauthorised 1.4, APP 2.2, Direct Debit 1.4, complaints 1, everything else 0.25), and continues to add heat every day for regulated types while it remains overdue. This is why Fraud Ops and Payments Ops punish being short-staffed.

### Cash exposure

The economy is deliberately close to the edge. Overstaffing or constant hiring and firing bleeds cash faster than the factory earns; understaffing builds complaints, fines and lost income. The target is teams that are busy (roughly 60 to 85% utilisation) but not burning out.

## Events and escalations

### Scheduled events

Seven events hit on fixed days. Each pauses the game with a banner explaining the situation and a tip on what to do:

| Day | Event | Effect |
|---|---|---|
| 10 | Retailer data breach | Unauthorised-payment claims surge. |
| 18 | Flu season | Everyone works 25% slower for three days. |
| 30 | Airline collapses | Non-delivery claims flood in. Teaches chargebacks and Section 75. |
| 40 | Black Friday | Volume doubles for a week. New hires need three days, so hire before the queues build. |
| 55 | Scam wave | APP scam claims surge (and are only handled if you are in era 2). |
| 62 | Travelkite collapses | In era 3 a merchant fails: a burst of chargebacks you may have to cover. |
| 70 | Regulator review | If heat is over 40, an £8,000 fine; otherwise a £3,000 grant. Either way heat falls. |

### Escalations (the teaching moments)

Starting on day 7, and every seven days after the previous one is answered, a manager escalates a real-world scenario to the player. The game pauses and no clock runs. The player picks one of three actions and is told, in plain language, why it was right or wrong.

There are sixteen scenarios across the three eras, covering topics such as "don't recognise" cryptic merchant names, the out-of-time window, the taxi teen (consented payments are authorised), airline collapse, a ticking Ombudsman deadline, merchant representments, APP scams, Direct Debit errors, merchant chargeback ratios, small chargebacks and RDR, and Compelling Evidence 3.0.

A good call pays £800, adds happiness, and lowers heat by 6. A poor call costs £600, adds heat, and loses happiness. In both cases the relevant handbook entries unlock.

### The handbook

Nineteen handbook entries describe how disputes work in the UK (the chargeback lifecycle, representment and pre-arbitration, APP scam rules, the Direct Debit Guarantee, the Ombudsman, 3-D Secure, friendly fraud, being a sponsor, being an acquirer, outsourcing and more). Entries unlock when the matching event happens in play, so reading the handbook doubles as a log of what the player has experienced.

## The grade

At the end of week 16, the game scores out of 104:

| Component | Points | Rewards |
|---|---|---|
| Profit | 20 | Net cash change plus 60% of capital spend, relative to £90,000. Can go negative (down to -10). |
| On-time rate | 25 | Share of all cases ever closed on time, squared, so missing a few matters more than missing none. |
| Customer happiness | 15 | Happiness at the end. |
| Flow | 10 | The backlog at the end, measured in days of average arrivals. |
| Regulator | 10 | Heat at the end. |
| Efficiency | 10 | Share of paid agent time spent working, scaled from 35% (zero) to 75% (full). |
| Growth | 8 | 4 points per era unlocked after the first. |
| Learning | 6 | Share of escalations answered correctly. |

Grades: **S** 88 and above, **A** 76, **B** 62, **C** 48, **D** below that. Any early loss counts as D.

The end screen shows a profit-and-loss account, the story of what happened to every dispute (and how few became chargebacks), and tailored advice for whichever component scored worst.

## Incentives and intended dilemmas

The game pulls the player in opposing directions on purpose.

- **Hire now or hire later.** Hiring ahead of a surge costs wages but prevents queues; hiring after costs complaints, lateness and a three-day ramp. Temps are the middle path.
- **Right-sizing.** After a surge the team must shrink or the efficiency and profit scores fall. Firing costs money; temps solve this because they expire, but they are slower and sloppier.
- **Where to invest.** Upgrades speed one team permanently and cost licences every day. Programmes move volume or quality across the whole company. The bottleneck changes over the game, so a single investment is rarely right for long.
- **Regulated clocks versus profit.** Fraud Ops and Payments Ops handle the cases that carry heat. It is tempting to starve them because they make less money than the others; the heat model punishes that.
- **Generosity versus cash.** Always-credit policy makes customers happier and revenue higher, but pays out before recovery and loses some credits on failed chargebacks.
- **Growth versus stability.** Each expansion brings volume, new case types and fixed costs. A healthy era 1 operation can absorb era 2; an overstretched one is destroyed by it.
- **Fight or fold.** Pre-arbitration only pays when the evidence is on your side. Escalating by default loses money.
- **Learning has a price.** Escalations pause the clock but cost nothing, and a correct answer pays; ignoring the theory costs money later.

## The engine

### Structure

- **`sim.js`** is the entire simulation, with no dependency on a display. It exports `create` (a new game), `step` (advance by a fraction of a day), `act` (every player action), `score` and a few read-only helpers. It can run headless in Node.
- **`data.js`** holds all content: teams (with rates, techs and which can use temps), case types (deadlines and descriptions), handbook entries, escalation scenarios, programmes and eras. Changing the game's content or balance is mostly editing this file and the constants at the top of `sim.js`.
- **The front end** (`index.html`, `style.css`, `ui.js`) is a thin shell. It reads the game state each frame, sends player actions through `act`, and listens to a stream of events emitted by the sim.

### State and loop

The game state `g` holds time, cash, happiness, heat, per-team state (workers, queue, in-flight list, training, tech level, stress, utilisation, pressure), the merchant book, active events, escalation progress, the finance log, outcome counters and the handbook set.

`step(g, dt)` runs, in order: the day tick when a day boundary is crossed, cost and revenue accrual, case arrivals (Poisson, scaled by time, era and events), per-agent work, external parties (sponsor, merchants, issuer, bounced cases), then pressure and stress updates, and finally the lose checks.

Within each step, every agent without a case pulls the next one from the queue (or the one with the earliest deadline if the programme is bought), and finishes it after a random time that depends on the team's rate, the agent's ramp-up, temp status, and any event modifier. Completion calls that team's routing function, which decides where the case goes next and what money, happiness and heat change.

### Events from the sim

The sim never touches the screen. It emits events: `move` (a case travelling between teams, or arriving), `float` (money or a label), `news` (ticker line), `banner` (pause for an alert), `escalate` (pause for a scenario), `offer` (board expansion), `sfx` (sound cue) and `hb` (handbook unlock). The front end queues the ones that pause the game and shows them one at a time.

### Determinism and testing

The random number generator can be seeded (`seed(n)` or `create({seed})`), so a run is reproducible. `tools/balance.js` runs scripted bots through full games headlessly:

- **idle**: hires nobody.
- **smart**: checks every day. It hires into any team whose queue per agent is above 2, and weekly fires agents from teams that are empty and idle. It buys faster sponsor tiers when the sponsor backs up, upgrades teams in a fixed priority order once cash is above £30,000, buys the early programmes when it can, expands as soon as an offer is affordable, and always answers escalations correctly.
- **medium** and **casual**: only react to queues on a schedule (every 2 or 5 days) and at a higher pressure threshold than the smart bot. They never fire, upgrade or buy programmes.
- **overhire**: staffs every team to seven agents straight away and expands as soon as it is offered.

The intended balance is that the smart bot finishes every seed with a B or better, while idle, casual and medium lose, and over-hiring goes bankrupt around day 20. Run it with `SEEDS=1,2,3 V=1 node tools/balance.js`.

### Debug parameters

The browser build accepts URL parameters for jumping to a state: `autostart=1`, `skip=N` (simulate N days with a simple auto-hirer), `cash=N`, `era2=1` or `era3=1`, and `modal=board|hb|clinic|end|event` to open a particular screen. For era 3 use `skip=46` and `cash=90000`.

## Open questions and likely next steps

- Merchant risk (era 3) and the sponsor (era 1) are the least interactive systems; they could use more decisions.
- Complaints are caused by delay and outcomes but cannot be prevented by any single action other than clearing queues.
- Difficulty is set by one balance of arrival rate, wage and revenue; a "hard mode" is a matter of tuning those constants.
- A full game by hand has not been played end to end; balance has been verified by bots only.

---

# Version 1: the public release

Version 1 turns the prototype above into a short, simple game for the general public. Everything above still describes the engine; this section lists what changes. Where the two disagree, this section wins.

## Goals

- **Enjoyable without being unnecessarily complex.** Fewer levers on screen at once, and every lever must visibly change the run.
- **For the general public.** A session takes about 10 to 15 minutes, needs no disputes knowledge, and ends with something worth sharing.
- **A route to Gradient Labs.** The end screen shows how automation would have changed the player's weakest area, with a link.

## One era per run, chosen as difficulty

The mid-game expansion offers are removed. The three eras become the three difficulty levels, and the player picks one before the run starts and plays it for the whole game.

| Difficulty | Era | What the player runs |
|---|---|---|
| **Easy** | 1. Sponsored | Front line only. The sponsor bank files chargebacks. |
| **Medium** | 2. Issuer | Adds Scheme ops, the Representment desk and Payments ops (APP scams, Direct Debit). Higher volume and a daily membership cost. |
| **Hard** | 3. Issuer + acquirer | Adds merchant acquiring, incoming chargebacks and merchant collapse risk. |

- The growth component of the grade (8 points) goes. Difficulty is rewarded through a multiplier or a badge on the final grade instead (for example Easy capped at A, Medium and Hard able to reach S).
- Starting cash, arrival rate and wage constants are tuned per difficulty.
- The upgrade cost to move from one era to the next no longer exists, so the starting cash and the early difficulty curve need rebalancing.

## Eight-week runs

A run is 8 weeks (40 business days) instead of 16.

- **Events are compressed.** Day numbers roughly halve: data breach about day 5, flu about 9, airline collapse about 15, Black Friday about 20, scam wave about 27, Travelkite about 31, regulator review about 35. Events only appear in the difficulties where they matter (the scam wave needs Medium or Hard, Travelkite needs Hard).
- **Escalations** start on day 4 and come every four days after the previous one is answered, so a run has about eight. Scenarios are filtered to those relevant to the chosen difficulty.
- **Clocks and constants** that assume 80 days are rescaled: arrival-rate growth, ramp-up, temp contract length, burnout, the regulator's cooling rate, and the Ombudsman and complaint timers.
- **Grade thresholds and the profit target** (currently £90,000 over 80 days) are rescaled for 40 days. Early-loss rules (cash below -£25,000, heat at 100%) are unchanged.

## Start-of-run policy screen

Before day 1, after choosing a difficulty, the player sets three policies. They are **locked for the whole run**, which makes the choice a strategy rather than something to fiddle with.

| Policy | Options | Trade-off |
|---|---|---|
| **Queue rule** | First in, first out; earliest deadline first; regulated cases first | FIFO is fair but lets deadlines slip. Earliest deadline first protects on-time rate. Regulated first protects heat but starves ordinary cases and raises complaints. |
| **Credit policy** | Always credit; credit regulated cases only | Always credit lifts happiness and revenue but pays out before recovery and loses money on failed chargebacks. |
| **Risk stance** | Strict; lenient | Strict declines weak claims sooner, with fewer losses but more declines and complaints. Lenient pays more claims and accepts more losses and fraud. |

- Each option has a one-line plain-English explanation on the screen, and a "recommended for first-timers" default.
- The earliest-deadline programme is no longer bought in play; it is a queue rule option.
- The end screen shows which policies the player chose and what they cost or earned, so players can see their effect.

## Trimmed levers

To keep the in-run screen simple:

- Upgrades go from three levels per team to **one** (training and tooling combined), at a single price. Licence cost scales to match.
- Programmes are reduced to those that are not now covered by the start-of-run policies.
- Merchant risk (era 3) stays a single "coverage" choice rather than a station to manage.
- Hire, fire and temps stay, as they are the core lever.

## End screen and replay

- The profit-and-loss account and the story of what happened to every dispute stay.
- **Gradient Labs insight.** The weakest grade component is matched to a short, honest note on what automating that step would have changed (for example, a late-cases problem becomes "an AI agent that answers disputes around the clock would have closed most of these before their deadline"), with a link. It reads as insight, not an advert.
- **Play again with different policies.** One button returns to the policy screen with the previous choices shown. The end screen compares the player's best grade for each difficulty and policy combination.
- A shareable result card: grade, difficulty, one headline stat (for example "only 14% of disputes became chargebacks").

## Design: "The Night Shift"

The player is the operations lead on the night shift, watching a live factory floor. The look is a dark control room with warm, friendly accents. The game is designed for **landscape on a phone** (about 800×360 points), with thumbs at the left and right edges.

### The visual metaphor: a night-time parcel depot

Every idea in the game is something the player can see:

| Game idea | What it looks like |
|---|---|
| A dispute | A parcel on a conveyor belt. Teal is ordinary, coral is regulated, amber is a complaint. |
| A team | A striped-awning machine with a glowing pictogram, and small workers standing in front of it. |
| The queue | Parcels piling up in front of the machine, getting taller as the jam grows. |
| Pressure | The roof lamp turns green, amber, then red and flashes. A jammed machine smokes and throws sparks. |
| A deadline | A countdown ring around the parcel. Late parcels glow red and shake. |
| Complaints | A pneumatic tube from Review up to a rooftop Complaints booth. |
| Resolved cases | Parcels slide into a vault and coins pop out. |
| New hires and temps | Dashed rings while ramping up. Temps wear a hard hat. Idle agents fall asleep. |
| The regulator | An inspector drone that sleeps at low heat, sweeps a red beam over the line above 50%, and flashes a siren above 75%. |
| Time | The moon and a row of eight pips, one for each week of the shift. |

The reference implementation is `game/mockup/index.html` (canvas scene, DOM controls). The earlier flat layout is kept as `game/mockup/flat.html`.

### Layout

```
┌──────────┬───────────────────────────────────┬──────────┐
│ STATUS   │            THE LINE               │ ACTIONS  │
│ Cash     │  Intake → Triage → Fraud → Review │ Hire  +  │
│ Happy    │      cases glide along as dots    │ Fire  -  │
│ Heat     │  queues pile up in front of teams │ Temp  ⚡ │
│ Day 12/40│                                   │ Upgrade  │
│ ⏸ ▶ ⏩   │   [selected team: stats strip]    │          │
└──────────┴───────────────────────────────────┴──────────┘
```

- **Left rail (about 20%):** Three vertical meters (cash, happiness, regulator heat) that change colour as they near danger, plus the day counter. Pause and speed buttons sit at the bottom, within reach of the left thumb.
- **Centre (about 60%):** The factory line, drawn left to right. Each team is a station. Cases are small dots travelling between stations, and queues stack up as visible piles whose colour shows pressure (green, amber, red), so the bottleneck is visible without reading numbers.
- **Right rail (about 20%):** Four large action buttons for the selected team: hire, fire, temp and upgrade, each showing its price. Nothing else on screen needs a precise tap.
- **Selecting a team:** Tapping a station selects it. A thin strip under the line shows that team's staff, queue and utilisation, and only that team's.

### Visual theme

- **Palette:** Deep navy background. Case dots are colour-coded by type: regulated cases (unauthorised, APP, Direct Debit) are hot coral, ordinary cases are cool teal, complaints are amber, and wins flash green. Red and green are reserved for the happiness and heat meters, so colour keeps its meaning.
- **Shapes:** Flat and rounded. Agents are tiny round avatars at their station, and idle ones fade so wasted wages are visible.
- **Station icons:** Simple custom pictograms, one per team, drawn as inline SVG in a single stroke weight and corner style so they stay consistent. No third-party icon set.
- **Typography:** One rounded sans for labels and one tabular face for numbers, so figures don't jitter as they change.
- **Motion and sound:** Dots glide. Cash floats up from a closing case (green for gains, red for losses). The screen edge pulses gently when heat passes 50%, 75% and 90%. Sound is short and soft, and muted on first load.
- **Gradient Labs touches:** The end screen takes on the Gradient Labs palette and type, so the shift from game to insight feels deliberate (see the `design:gl-design-system` skill).

### Phone-landscape rules

- Touch targets are at least 44pt, and all controls sit in the outer 20% columns, where thumbs rest.
- A run needs no scrolling. Pauses (escalations, events and the end screen) are full-width cards with one big choice per row.
- The policy screen is three side-by-side cards (queue, credit, risk), each with one line of explanation and a highlighted recommended option.
- Portrait shows a "rotate your phone" prompt. Layout respects safe-area insets for notches.

### Next step

Build a single clickable mockup of the landscape layout and check it on a phone before changing `ui.js` and `style.css`.

## Open items for Version 1

- Rescale and re-verify balance with `tools/balance.js` for each difficulty. The intended target stays: the smart bot reaches B or better on every seed, and idle, casual, medium and overhire bots lose.
- Play at least one full run by hand at each difficulty before release.
- Build and test the landscape mockup of the Night Shift design on a real phone.
