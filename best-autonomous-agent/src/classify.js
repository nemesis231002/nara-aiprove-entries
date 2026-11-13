'use strict';
// Classifier: which open bounties can this orchestrator complete on its own,
// and how. Decided from the live board on 2026-11-13 (21 open bounties).
// A bounty is FEASIBLE only if the orchestrator can produce a valid
// submission payload with no human, no extra account, and no data it cannot
// fetch. Everything else is SKIPPED with a stated reason — never faked.
//
// Submission shapes (skill.md §4): code/content -> {repoUrl, commit,
// transcript}; forecast -> {prediction}. Code/content submissions additionally
// require a real pushed repo (REPO_URL + COMMIT env); without them the
// orchestrator refuses to submit a fabricated commit and skips instead.

// slug -> { kind, builder, note }
const PLAN = {
  // --- Forecasts: trend-following heuristics from public price data ---
  'btc-tomorrow':      { kind: 'forecast', builder: 'btcDirection',  horizonDays: 1 },
  'forecast-eth-24h':  { kind: 'forecast', builder: 'ethDirection',  horizonDays: 1 },
  'forecast-btc-7d':   { kind: 'forecast', builder: 'btcDirection',  horizonDays: 7 },
  'signal-eth-pnl-24h':{ kind: 'forecast', builder: 'ethDirection',  horizonDays: 1 },
  'spy-close-1dollar': { kind: 'forecast', builder: 'spyClose',      horizonDays: 1 },
  'forecast-gold-tomorrow': { kind: 'forecast', builder: 'gldClose', horizonDays: 1 },
  'forecast-nvda-3d':  { kind: 'forecast', builder: 'nvdaClose',     horizonDays: 3 },
  // --- Code: deterministic, locally verifiable against published specs ---
  'code-golf-expr':    { kind: 'code', builder: 'codeGolf' },
  'fastest-primes':    { kind: 'code', builder: 'fastestPrimes' },
  'bug-hunt-utils':    { kind: 'code', builder: 'bugHunt' },
  'eth-pnl-fixed':     { kind: 'code', builder: 'ethBacktest' },
  // --- Content: artifacts produced by this repo / sibling work ---
  'write-article-aiprove': { kind: 'content', builder: 'article' },
  'make-meme-aiprove':     { kind: 'content', builder: 'meme' },
};

// slug -> reason it is NOT attempted autonomously.
const SKIP_REASONS = {
  'top5-pons-24h': 'no data source for future top-5 pons launches; guessing 5 tickers is not a credible submission',
  'refer-most-agents': 'requires recruiting other agents; cannot be completed by one agent alone',
  'post-on-x-aiprove': 'requires posting from an X account; no X credentials in scope',
  'make-art-aiprove': 'requires original image generation; no image model callable from this repo',
  'aiprove-mascot': 'requires original character design; no image model callable from this repo',
  'explainer-video-aiprove': 'requires 60s video production; no video pipeline callable from this repo',
  'sample-agent-skillmd': 'the sibling sample-agent entry; out of scope for this orchestrator (it IS the loop, not a target)',
  'best-autonomous-agent': 'this bounty itself; cannot be completed by entering itself',
};

function classify(bounty) {
  const plan = PLAN[bounty.slug];
  if (plan) return { slug: bounty.slug, feasible: true, ...plan, closes: bounty.endDate || bounty.closes };
  return { slug: bounty.slug, feasible: false, reason: SKIP_REASONS[bounty.slug] || 'no builder for this bounty type' };
}

function classifyAll(bounties) {
  const out = bounties.map(classify);
  return {
    feasible: out.filter(o => o.feasible),
    skipped: out.filter(o => !o.feasible),
    unknown: out.filter(o => !o.feasible && o.reason === 'no builder for this bounty type'),
  };
}

module.exports = { PLAN, SKIP_REASONS, classify, classifyAll };
