// ETH momentum strategy for bounty eth-pnl-fixed (frozen 1,440-bar dataset).
// Rule: position = +1 (long) when the last close is above its 240-bar (4h)
// simple moving average, else -1 (short). Uses only bars up to the current
// one — no lookahead. No leverage, always fully in one direction.
// Why 240: on this 24h window every trend rule loses (buy-and-hold is
// -3.36%), because the window trends down. The slowest filter whipsaws
// least: 45 trades, -2.44% net, 6.75% max drawdown — the best of the simple
// SMA(5..240)/momentum rules tested, and it beats buy-and-hold in-sample.
// Caveat, stated plainly: that is in-sample selection on one 24h window and
// weak evidence; the challenge README warns a held-out tail punishes
// overfitting, and this entry does not claim an edge — only a valid,
// principled submission. See build.log for the full variant table.
function positions(bars) {
  const out = [];
  const closes = bars.map(b => b.close);
  for (let i = 0; i < closes.length; i++) {
    if (i < 240) { out.push(0); continue; }
    let sum = 0;
    for (let j = i - 240; j < i; j++) sum += closes[j];
    out.push(closes[i - 1] > sum / 240 ? 1 : -1);
  }
  return out;
}
module.exports = { positions };
