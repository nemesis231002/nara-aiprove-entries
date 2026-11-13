# eth-pnl-fixed — Donchian breakout + volatility-expansion gate

Bounty: `eth-pnl-fixed` (AIProve) — closes Nov 20 2026 13:49 UTC, top-3 split
of 2,000,000 PROVE. Dataset: frozen ETH/USDT 1-minute bars, 1,440 bars,
24h window ending 2026-11-13 12:17 UTC (Binance spot). First close 2028.68,
last close 1960.59 (−3.36% over the day).

**Status: local work only. Nothing submitted to aiprove.fun. No network
calls to aiprove.fun were made.**

## Strategy

Long/short Donchian breakout with a volatility-expansion entry gate.
One position at a time, fixed **$10,000 notional**, no leverage.

- **Entry:** go LONG (+1) when the close breaks above the highest HIGH of
  the prior **90 bars**; go SHORT (−1) when the close breaks below the
  lowest LOW of the prior 90 bars.
- **Gate (entries only):** the breakout is taken only when **ATR(14) is
  above its own 60-bar median** — volatility is expanding, not dead chop.
  The gate never forces an exit; once in a trade the position is held
  until the opposite Donchian breakout. This is what keeps the strategy
  out of the range-bound first half of the sample.
- **Execution:** signals use closes up to and including bar *t* and are
  executed at the **close of bar *t*** (no lookahead). The position is
  closed at the close of the final bar (1439).
- **Why this shape:** on 1-minute bars the mean absolute move is ~0.073%,
  smaller than a ~0.24% round-trip taker cost, so any high-turnover rule
  is structurally unprofitable after costs. This rule makes 3 position
  changes in 1,440 bars, so total costs are $72 and the gross trend move
  can survive them.

Full logic + backtest engine: `strategy.py`. Runner: `backtest.py`.

## Assumptions (stated explicitly)

| Item | Assumption |
|---|---|
| Notional | $10,000 fixed, rebalanced every bar (per-bar mark-to-market) |
| Taker fee | 0.10% per fill (Binance spot default taker rate) |
| Slippage | 0.02% per fill (2 bps adverse move on a market fill) |
| Total cost | 0.12% per fill; a flip +1 → −1 is two fills (0.24%) |
| Execution | At the close of the signal bar; no phantom fills, no lookahead |
| Leverage / pyramiding | None |
| Stop-loss | None beyond the opposite breakout |

The grader repo (`aiprove/grader/`) is v1 FORECAST-only (Brier scoring)
and contains **no replay/fee schedule for this PnL bounty**, so the fees
above are stated assumptions, not grader-matched values. If the sandbox
uses different fees, the sensitivity table below shows the effect.

## Results (verified by running `backtest.py` on the real `bars.csv`)

| Metric | Value |
|---|---|
| **Net PnL (full 1,440 bars)** | **+$411.70 (+4.12% on $10,000)** |
| Gross PnL | +$495.70 |
| Total costs | $72.00 (6 fills × 0.12% × $10,000) |
| Max drawdown | $201.02 (2.01%) |
| Fills / round trips | 6 / 3 |
| Win rate (round trips) | 2/3 (66.7%) |

Round trips (net PnL after costs, per-bar MTM):

| Bars | Direction | Entry | Exit | Net PnL |
|---|---|---|---|---|
| 227 → 597 | LONG | 2021.18 | 2012.56 | −$65.73 |
| 597 → 1086 | SHORT | 2012.56 | 1934.64 | +$367.24 |
| 1086 → 1439 | LONG | 1934.64 | 1960.59 | +$122.18 |

## Robustness

| Split | Net PnL |
|---|---|
| First half (bars 0–719) | −$111.29 (0/2 wins, MDD $135.45) |
| Second half (bars 720–1439) | +$509.60 (2/2 wins, MDD $201.02) |
| Third 1 (bars 0–479) | −$49.44 |
| Third 2 (bars 480–959) | +$304.81 |
| Third 3 (bars 960–1439) | +$117.92 |

**Honest verdict: the edge is thin and concentrated.** The full-sample
profit comes almost entirely from one short trade (bars 597–1086, the
mid-day decline, +$367 of the +$412 total). The first half loses money
and the first third loses money; the strategy is **not** positive in every
split. What *is* robust is the family: the same rule with Donchian
windows 60 / 90 / 120 is net-positive in all three cases (+$264.79 /
+$411.70 / +$360.48), with the same 3-trade structure, so the result does
not hinge on one tuned window. Window 90 was chosen as the middle of that
tested range, not as the maximum. If the held-out tail has no comparable
trending move, expect roughly breakeven to slightly negative — this is a
weak-positive trend rule, not a strong edge.

Note on split arithmetic: the half PnLs sum to $398.31, not $411.70.
The $13.39 gap is a split-boundary artifact, verified exactly: the first
half closes the open short at bar 719 ($12.00 cost) while the full run
holds it through the bar-1086 flip, and the 719→720 bar's mark-to-market
(+$1.39, short, close 2016.87 → 2016.59) belongs to neither half. Same
for thirds (gap $38.41 = 2 × $12 boundary closes + $12.30 + $2.11 bar
mark-to-markets). The full-sample number is the authoritative one.

## Buy-and-hold baseline (same bars, $10,000, no fees)

| | Net PnL | Max drawdown |
|---|---|---|
| Full sample | −$335.64 (−3.36%) | $613.48 |
| First half | −$58.22 | — |
| Second half | −$277.70 | — |

The strategy beats buy-and-hold by **+$747.34** net and cuts max
drawdown by ~67% ($201.02 vs $613.48) — mostly by being short (or flat)
during the day's decline instead of riding it down.

## Cost sensitivity (full sample, same signals)

| Cost assumption | Net PnL | Max drawdown |
|---|---|---|
| Taker 0.10% + slip 0.02% (base) | +$411.70 | $201.02 |
| Taker 0.05% + slip 0.01% | +$447.70 | $189.02 |
| Maker 0.02% + slip 0.01% | +$465.70 | $183.02 |

The result is insensitive to the fee assumption because turnover is so
low (6 fills) — the risk is not fees, it is whether the trend move
repeats out of sample.

## What was tried and rejected

- **EMA crossovers** (12/20/30 × 48/60/100/120, bands 0/0.05%/0.10%):
  all 36 variants net-negative (best −$47.41, worst −$870.28); first half
  negative in every variant. High turnover (16–69 fills) vs 0.073% mean
  1-minute moves.
- **SMA-regime, RSI / Bollinger mean-reversion:** gross PnL small-positive
  ($30–$350) but costs ate it; best net was SMA-360 short-only +$9.80.
- **Donchian without the ATR gate:** Donchian 60 −$31.20, Donchian 120
  −$25.87 — the gate (which cuts first-half chop trades) is what turns
  the family positive.
- **EMA + ATR gate used as an exit:** 118 fills, −$1,634.63 — the gate
  must block entries only, never force exits.

## How to run

```bash
python3 backtest.py bars.csv   # prints all tables, writes results.json + equity_curve.csv
```

Requires Python 3 + pandas + numpy (verified on Python 3.12.3,
pandas 2.1.4, numpy 1.26.4). No network, no API keys.

## Files

- `strategy.py` — strategy definition + backtest engine (no lookahead,
  fills at signal-bar close, per-bar MTM on fixed $10,000 notional)
- `backtest.py` — runner: full sample, halves, thirds, baseline,
  cost sensitivity, window robustness; writes `results.json`
- `bars.csv` — frozen dataset copy (source:
  `~/workspace/aiprove-agent/aiprove/challenges/eth-backtest/bars.csv`)
- `results.json` — machine-readable results of the run above
- `equity_curve.csv` — per-bar equity (PnL in $), final value +$411.70
- `build.log` — every command run + its outcome
- `README.md` — this file

Note: there is no git repository under `~/workspace/aiprove-agent`, so
there is no commit hash to pin; this directory is the submission.
