# Dispute Factory v1: build contract

Three agents build `v1/` in parallel. This file is the interface between them. Do not change it; if it is wrong or missing something, say so in your final report and code defensively.

- Game rules: `../GAMEPLAY.md`. The "Version 1: the public release" section wins over everything above it, **except its "Design: The Night Shift" section, which is replaced by the design below.**
- Prior code to port from: `../v0/` (`sim.js`, `data.js`, `ui.js`, `tools/balance.js`). Read it; do not edit it.
- Layout reference: `design/the-stack-mockup.dc.html` (static mockup of the play screen; read the markup and inline styles, ignore the `x-dc` wrapper and `support.js`).
- The game must run by opening `v1/index.html` from `file://`. Plain script tags, no modules, no build step, no dependencies. Google Fonts via `<link>` is the only network use.

## File ownership (edit only your own files)

| Agent | Owns |
|---|---|
| SIM | `sim.js`, `data.js`, `tools/balance.js`, `API.md` |
| PLAY | `index.html`, `style.css`, `ui-play.js` |
| SCREENS | `ui-screens.js`, `screens.css`, `dev-screens.html` |

`index.html` loads, in order: `style.css`, `screens.css`, then `data.js`, `sim.js`, `ui-screens.js`, `ui-play.js`.

## Sim API (v0 API plus these changes)

Globals as in v0: `window.GAMEDATA` (data.js) and `window.Sim` (sim.js), also `module.exports` under Node.

```js
const g = Sim.create({
  difficulty: 'easy' | 'medium' | 'hard',          // default 'easy'
  policies: { queue: 'fifo' | 'edf' | 'regulated', // default 'edf'
              credit: 'always' | 'regulated',      // default 'regulated'
              risk: 'strict' | 'lenient' },        // default 'strict'
  seed, headless })
Sim.step(g, dt)            // unchanged
Sim.score(g)               // { pts, total, max, grade, slaAll, profit, backlogDays, effAvg }
Sim.forecast(g)            // next scheduled event for this difficulty that has not started:
                           // { name, day, daysAway, tip } or null
Sim.C                      // constants; END_DAY = 40, WEEKS = 8, UP_COST is ONE number, UP_LIC one number
```

State the UIs may read (names as in v0 unless noted):

- `g.t` (fractional days), `g.day`, `g.cash`, `g.csat` (happiness 0-100), `g.heat` (0-100), `g.over` (`null` or `{kind: 'end' | 'cash' | 'fca'}`)
- `g.difficulty`, `g.era` (1, 2 or 3; fixed for the run: easy=1, medium=2, hard=3), `g.policies` (the three choices, locked)
- `g.st[id]`: `{ id, def, unlocked, workers: [{ramp, c, temp, until}], queue: [case], tech (0 or 1), stress, util, pressure }`. `def` has `name`, `short` (max 6 chars, new), `kind` (`'work' | 'policy' | 'ext'`, check v0 for exact values), `outsource` (can use temps), `desc`. Only stations with `unlocked` exist in the run; all stations for the chosen difficulty are unlocked from day 0.
- `Sim.stationOrder(g)`: array of unlocked station ids in left-to-right flow order (new).
- A case `c` has `type`, `due` (or v0's equivalent deadline field), and `GAMEDATA.TYPES[c.type]` has `regulated: true|false` (new) and `name`.
- `g.sponsorTier`, `Sim.sponsorCap(g)`, `g.clinic` (`cur`, `right`, `wrong`), `g.fin` (finance log by category), `g.out` (outcome counters), `g.cbFiled`, `g.closed`, `g.hb` (Set of unlocked handbook ids)
- `Sim.slaRate(g)`, `Sim.costPerCase(g)`, `Sim.queuedTotal(g)`, `Sim.week(g)`

Actions (all return truthy on success, falsy if not allowed or unaffordable):

- `Sim.act.hire(g, id)`, `Sim.act.fire(g, id)`, `Sim.act.outsource(g, id)` (two temps), `Sim.act.upgrade(g, id)` (single level), `Sim.act.sponsor(g)` (easy only), `Sim.act.answerClinic(g, idx)` -> `{ ok, why, best }`
- `Sim.can(g, action, id)` -> boolean, for greying out buttons (new). Actions: `'hire' | 'fire' | 'outsource' | 'upgrade' | 'sponsor'`.
- Removed: `expand`, `canExpand`, `buy`, `policy`, `train`, `tech`, `pizza`. No `offer` events.

Event stream: the sim pushes to `g.ev`; the UI drains it every frame. Shapes as v0:
`{k:'move', from, to, col}`, `{k:'closed', outcome}`, `{k:'float', at, text, col}`, `{k:'news', text, kind}`, `{k:'banner', text, sub, tip, good}`, `{k:'escalate', id}`, `{k:'sfx', name}`, `{k:'hb', id}`, `{k:'story', text, tone}`.
In v1 the `col` on `move` is one of the palette hexes below (ordinary = orange, regulated = coral, complaint = gold).

## UI split

`ui-play.js` owns the app: boot, the frame loop, speed and pause, draining `g.ev`, and the in-run screen. It calls into `window.Screens` (from `ui-screens.js`) for everything that is not the in-run screen. While any Screens overlay is open the loop does not step the sim.

```js
Screens.start(cb)            // title -> difficulty -> three policies. cb({ difficulty, policies })
Screens.banner(ev, done)     // ev is a {k:'banner'} event. Full-width pause card. done() on dismiss
Screens.escalate(g, id, done)// shows GAMEDATA.CLINIC scenario `id`, calls Sim.act.answerClinic itself,
                             // shows the why/feedback, then done()
Screens.handbook(g, done)    // list of unlocked entries from g.hb / GAMEDATA.HANDBOOK
Screens.end(g, score, cb)    // end screen. cb('replay') returns to Screens.start with previous choices preselected
Screens.isOpen()             // boolean
```

- Screens appends its own root `<div id="screens">` to `<body>` and styles it only via `screens.css` with selectors under `#screens`. It must not assume any markup from `index.html`.
- PLAY must not style anything under `#screens`, and prefixes nothing there. PLAY keeps all its markup under `#app`.
- PLAY handles the URL debug params: `autostart=1` (skip Screens.start, use `difficulty=` and defaults), `skip=N`, `cash=N`, `seed=N`, `modal=end|event|clinic|hb`. If `window.Screens` is missing, PLAY behaves as `autostart=1` and auto-dismisses banners, so it is testable alone.
- SCREENS tests alone through `dev-screens.html`, which loads `data.js`/`sim.js` (fall back to `../v0/` copies if v1 ones do not exist yet) and has buttons to open each screen with a simulated game.

## Design: "The stack"

Phone landscape, about 844x390 CSS px, scaling to fit any landscape viewport with safe-area insets; portrait shows a "rotate your phone" prompt. No scrolling during a run. Touch targets at least 44px. Works with mouse too.

- **Palette (Gradient Labs brand, use only these):** black `#000000` background, sand `#F8F4EB` ink and borders, orange `#FF8933` (brand, ordinary cases, primary action), orange tint `#FFA666`, sand shade `#C7BCA3` (muted labels), coral `#F27C71` (regulated cases, danger, late), gold `#FFED77` (complaints, warnings), lucite `#7ACBA7` (healthy), white `#FFFFFF`. No gradients as decoration, no emoji, no rounded "app" cards: square corners, 2px sand borders, arcade feel.
- **Type:** `Press Start 2P` for numbers and short headings, `Silkscreen` for labels and body. Minimum 9px. Sentence case, British English, no em dashes, no exclamation-mark spam.
- **Play screen:** left rail (cash, happiness, heat, day x/40, pause and speed), centre field of wells, right rail ("Next" panel fed by `Sim.forecast`, then the selected team's name, stats and actions).
- **Wells:** one per unlocked station, in `Sim.stationOrder(g)` order. Cases are blocks stacked from the bottom (coral for regulated on top of orange; gold in Complaints). A dashed coral line marks the jam level (queue per agent of 3, i.e. `pressure` 3); a stack over the line makes the well border and count turn coral. The count sits at the top of the well, the team name and agent count below it. New arrivals drop in from the top; a `move` event flies a block from one well to the next. Late cases flash.
- **Controls:** each staffed well has one `+` button under it (hire, 44px min, also selects the well). Tapping a well selects it. The right rail acts on the selected team: Fire, 2 temps (if allowed), Upgrade, each showing its price and greyed when `Sim.can` is false. Externals (`kind` not staffed: sponsor, merchant response, issuer review) render as slim dashed columns with no `+`; Sponsor's rail action is "Faster tier". With 6 wells (easy) wells are about 88px wide; with up to 12 staffed wells (hard) they shrink to about 44px and use `def.short` labels.
- **Feedback:** cash floats, a one-line ticker for `news`, heat thresholds pulse the screen edge, sound muted by default with a toggle.
- **Pause cards (Screens):** full-width, black with sand border, one big choice per row.
- **End screen (Screens):** grade, profit-and-loss, "what happened to every dispute" (how few became chargebacks), chosen policies, weakest component with an honest Gradient Labs insight line and a link to https://gradient-labs.ai, share card text, best grades per difficulty in `localStorage` (wrapped in try/catch), and "Play again with different policies". The end screen may use the Gradient Labs light look (sand background, black ink, orange accent, `DM Sans` headings, `Inter` body) to mark the move from game to insight.
