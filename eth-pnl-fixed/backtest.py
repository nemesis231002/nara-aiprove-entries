"""Run the eth-pnl-fixed backtest and write results.json.

Usage:  python3 backtest.py [bars.csv]
Reads bars.csv (default: ./bars.csv), runs strategy.positions + backtest,
prints full-sample metrics, half/third splits, buy-and-hold baseline,
cost sensitivity, and the Donchian-window robustness table (60/90/120),
and writes results.json next to this file.
"""
import json
import sys

import numpy as np
import pandas as pd

import strategy as S


def fmt_section(name, r):
    wr = r["win_rate"] * 100 if r["win_rate"] == r["win_rate"] else float("nan")
    return (f"{name:28s} net ${r['net_pnl']:8.2f}  gross ${r['gross_pnl']:8.2f}  "
            f"costs ${r['total_costs']:6.2f}  MDD ${r['max_drawdown']:7.2f}  "
            f"fills {r['fills']:2d}  RT {r['round_trips']:2d}  "
            f"win {r['wins']}/{r['round_trips']} ({wr:4.1f}%)")


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "bars.csv"
    df = S.load_bars(path)
    n = len(df)
    pos = S.positions(df)

    full = S.backtest(df, pos)
    h1 = S.backtest(df, pos, start=0, end=n // 2)
    h2 = S.backtest(df, pos, start=n // 2, end=n)
    thirds = [S.backtest(df, pos, start=i * 480, end=(i + 1) * 480)
              for i in range(3)]
    bh = S.buy_and_hold(df)
    bh_h1 = S.buy_and_hold(df, 0, n // 2)
    bh_h2 = S.buy_and_hold(df, n // 2, n)

    print(f"bars={n}  first close {df['close'].iloc[0]:.2f}  "
          f"last close {df['close'].iloc[-1]:.2f}  "
          f"notional ${S.NOTIONAL:,.0f}")
    print(f"base cost: taker fee {S.FEE*100:.2f}% + slippage "
          f"{S.SLIPPAGE*100:.2f}% = {S.COST_PER_FILL*100:.2f}% per fill")
    print()
    print("STRATEGY  Donchian(90) breakout + ATR(14) > 60-bar median ATR gate")
    print(fmt_section("FULL SAMPLE (1440 bars)", full))
    print(fmt_section("  first half  (bars 0-719)", h1))
    print(fmt_section("  second half (bars 720-1439)", h2))
    for i, t in enumerate(thirds):
        print(fmt_section(f"  third {i+1} (bars {i*480}-{(i+1)*480-1})", t))
    print()
    print("ROUND TRIPS (full sample, net PnL after costs, per-bar MTM):")
    for rt in full["trades"]:
        d = "LONG " if rt["direction"] > 0 else "SHORT"
        print(f"  bars {rt['entry_bar']:4d} -> {rt['exit_bar']:4d}  {d}  "
              f"entry {rt['entry_price']:8.2f}  exit {rt['exit_price']:8.2f}  "
              f"net ${rt['net_pnl']:8.2f}")
    print()
    print("BUY-AND-HOLD BASELINE (long $10,000, no fees):")
    print(f"  full sample: net ${bh['net_pnl']:8.2f} "
          f"({bh['net_pnl']/S.NOTIONAL*100:+.2f}%)  MDD ${bh['max_drawdown']:.2f}")
    print(f"  first half:  net ${bh_h1['net_pnl']:8.2f}  "
          f"second half: net ${bh_h2['net_pnl']:8.2f}")
    print()
    print("COST SENSITIVITY (full sample, same signals):")
    sens = {}
    for label, c in [("taker 0.10% + slip 0.02% (base)", 0.0012),
                     ("taker 0.05% + slip 0.01%", 0.0006),
                     ("maker 0.02% + slip 0.01%", 0.0003)]:
        r = S.backtest(df, pos, cost_per_fill=c)
        sens[label] = r["net_pnl"]
        print(f"  {label:32s} net ${r['net_pnl']:8.2f}  MDD ${r['max_drawdown']:.2f}")
    print()
    print("WINDOW ROBUSTNESS (same ATR gate, Donchian W = 60 / 90 / 120):")
    win_rows = {}
    for w in (60, 90, 120):
        S.DONCHIAN_W = w
        p2 = S.positions(df)
        r2 = S.backtest(df, p2)
        h1b = S.backtest(df, p2, start=0, end=n // 2)
        h2b = S.backtest(df, p2, start=n // 2, end=n)
        win_rows[w] = {"net_pnl": r2["net_pnl"], "max_drawdown": r2["max_drawdown"],
                       "fills": r2["fills"], "round_trips": r2["round_trips"],
                       "win_rate": r2["win_rate"], "h1": h1b["net_pnl"],
                       "h2": h2b["net_pnl"]}
        print(f"  W={w:3d}: net ${r2['net_pnl']:8.2f}  MDD ${r2['max_drawdown']:7.2f}  "
              f"fills {r2['fills']}  RT {r2['round_trips']}  "
              f"H1 ${h1b['net_pnl']:8.2f}  H2 ${h2b['net_pnl']:8.2f}")
    S.DONCHIAN_W = 90

    out = {
        "notional_usd": S.NOTIONAL,
        "cost_per_fill": S.COST_PER_FILL,
        "fee": S.FEE, "slippage": S.SLIPPAGE,
        "bars": n,
        "first_close": float(df["close"].iloc[0]),
        "last_close": float(df["close"].iloc[-1]),
        "strategy": "Donchian(90) breakout, long/short, ATR(14) > 60-bar median ATR entry gate",
        "full": {k: (v if not isinstance(v, np.ndarray) else v.tolist())
                 for k, v in full.items() if k != "trades"},
        "trades": full["trades"],
        "first_half": {k: v for k, v in h1.items() if k not in ("equity", "trades")},
        "second_half": {k: v for k, v in h2.items() if k not in ("equity", "trades")},
        "thirds": [{k: v for k, v in t.items() if k not in ("equity", "trades")}
                   for t in thirds],
        "buy_and_hold": {"full": bh, "first_half": bh_h1, "second_half": bh_h2},
        "cost_sensitivity_net_pnl": sens,
        "window_robustness": win_rows,
    }
    with open("results.json", "w") as f:
        json.dump(out, f, indent=2, default=float)
    np.savetxt("equity_curve.csv",
               np.column_stack([np.arange(n), full["equity"]]),
               delimiter=",", header="bar,equity_usd", comments="")
    print()
    print("wrote results.json, equity_curve.csv")


if __name__ == "__main__":
    main()
