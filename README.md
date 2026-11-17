# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/iuzuka/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/iuzuka/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every pre-token protocol DefiLlama tracks, ranked by what its launch would be worth, with a farm plan for each. Built for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01).

## Run it

```sh
node main.ts --input <snapshot.json>
```

The program reads the sealed snapshot (`/input/snapshot.json` in the grader, or `--input` locally) and writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to `/output` (or `MAKEFUN_OUTPUT_DIR`). Node.js 22.18 or later, standard library only, no install and no network. The run is deterministic: the same snapshot in gives the same bytes out.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Open `out/dashboard/index.html` in a browser to use the board. Tests:

```sh
node --test tests/model.test.ts
```

## How it is priced

An implied value is a model's reading, not a price. It answers one question: if this protocol issued a token tomorrow, what would the market pay for it, judged by what it pays for the protocols that already trade?

```
implied = TVL × category multiple × growth × maturity × breadth
```

- **Category multiple.** For each category, the median market-cap-to-TVL ratio of its live-token protocols. A DEX is priced like a DEX and a lender like a lender. A category with fewer than 3 live comparables uses the global median. Every multiple is clamped to 0.05–2.0x.
- **Growth.** The 7-day TVL change, clamped to −60%…+120%, moves the value by half its size.
- **Maturity.** A protocol earns its full multiple slowly: 0.6 at launch, rising to 1.0 over 1095 days.
- **Breadth.** Each extra chain adds 3%, up to 5 extra chains.

The board covers the snapshot's watchlist in full (the floor, never a ceiling) plus every other rankable pre-token protocol below the floor, strongest first. Live-token protocols are kept apart and shown at the market's own values. Every row carries a six-step farm plan, derived from its own category, chains, TVL and age. No step promises an airdrop.

## Layout

- `main.ts` — the entrypoint: reads the snapshot, writes the board and the dossier.
- `lib/model.ts` — the comps-calibrated model, the board, the gate and the dashboard data.
- `lib/farm.ts` — the farm plans.
- `dashboard/` — the static board: index, styles and script, no network.
- `vendor/makefun-board.ts` — make.fun's dossier library, from the competition kit.
- `screenshots/` — the board, a protocol's detail view and a filtered view.
- `tests/` — model tests (watchlist coverage, ranking, gate, determinism, farm-plan parity).

## Data

The snapshot is DefiLlama's public protocol list (`https://api.llama.fi/protocols`), frozen at the competition's input build. It carries no ranking, no implied value and no farm plan; deriving them is this entry's work.

---

<sub>Entered on [make.fun](https://make.fun/?ref=781caceh&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
