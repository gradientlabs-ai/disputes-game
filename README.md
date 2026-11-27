# Dispute Factory

A short management game about how UK card and bank-transfer disputes really work. You run a bank's disputes operation for eight weeks (40 business days): hire, fire and upgrade teams so cases flow through on time, inside the rules, without going broke or being shut down by the regulator.

Made by [Gradient Labs](https://gradient-labs.ai). Built for phones in landscape, and it also plays fine on a desktop.

## Play

No install and no build step.

```sh
git clone https://github.com/gradientlabs-ai/disputes-game.git
cd disputes-game
open index.html        # macOS; or just double-click index.html
```

Any modern browser works. On a phone, serve the folder (for example `python3 -m http.server`) and open the page in landscape. Fonts load from Google Fonts, so the first load needs a network connection.

## How it plays

- Every team is a well. Cases drop in from the top and stack up; a stack over the dashed coral line is a jam.
- Tap **+** under a well to hire. Tap a well to select it, then use Fire, 2 temps or Upgrade on the right.
- Upgrade gives a team new tooling: its agents work twice as fast and make fewer mistakes, for a daily licence.
- Pick a difficulty (Easy, Medium or Hard) and three locked policies before you start: queue rule, credit policy and risk stance.
- Lose if cash falls below -£25,000 or regulator heat reaches 100%. Reach day 40 for a grade.

Keyboard: left and right select a well, `H` hire, `F` fire, `T` temps, `U` upgrade, space pause.

## Layout

| Path | What it is |
|---|---|
| `index.html`, `style.css`, `ui-play.js` | App shell and the in-run screen |
| `ui-screens.js`, `screens.css` | Title, difficulty and policy screens, event and escalation cards, handbook, end screen |
| `sim.js`, `data.js` | The simulation (no DOM) and all game content |
| `tools/balance.js` | Headless balance bots: `node tools/balance.js [easy\|medium\|hard]` |
| `dev-screens.html` | Test harness that opens each non-play screen |
| `docs/` | Game design (`GAMEPLAY.md`), simulation API (`API.md`), UI contract and the original mockup |

Useful URL parameters: `autostart=1`, `difficulty=hard`, `skip=N` (simulate N days), `seed=N`, `cash=N`, `speed=N` (test only), `debug=1`.

## Balance

`SEEDS=1,2,3 node tools/balance.js` runs scripted players through full games on each difficulty. A sensible player should finish with a B or better; idle, careless and over-hiring players should lose. The game has been played by scripts and in headless Chrome, and has not yet had a pass on real phones.
