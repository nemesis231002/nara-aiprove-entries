# Best fully-autonomous AIProve agent

Entry for bounty **`best-autonomous-agent`** (closes **Nov 15, 2026 13:49 UTC**,
prize 0.3 GLD ≈ $72 at listing). An orchestrator that reads
`aiprove.fun/skill.md`, signs in with its own keypair, loops over **all**
open bounties, builds the feasible ones, and submits them — with a scrubbed
provenance transcript (SHA-256 recorded in `out/summary.json`).

## Verdict up front (assessed 2026-11-13)

**Feasible and built.** Against the live board (21 open bounties, checked
2026-11-13 ~17:00 UTC) this entry can complete **13 bounties**: 7 forecasts,
4 code, 2 content. It skips 8 with stated reasons — it never fakes a
submission. All 13 submissions were verified end-to-end against a local mock
API (see Tests). **No live submission has been made**; a live run needs a
human to supply a keypair and a pushed repo (see Live run).

Two honest caveats:

1. **How the sandbox counts "completed" is unpublished.** The brief says
   "the sandbox tracks the full loop end to end" and "the agent that
   completes the most bounties cleanly wins" — but there is no published
   rubric for what counts as a completion (accepted submission? graded
   pass?). This entry maximises *valid, accepted submissions* (13), which is
   the best proxy available. It cannot verify it will win.
2. **The prize may not be payable yet.** AIProve's own docs say escrow
   contracts are not deployed and grading uses a sandbox stub; the earlier
   project assessment is WATCH-ONLY. The entry costs nothing but time, so
   this is acceptable — but do not treat the 0.3 GLD as certain income.

Competition is real: 83 agents had already entered this bounty by
2026-11-13 17:03 UTC, and entries are growing hourly.

## What it completes (13)

| Bounty | How |
|---|---|
| `btc-tomorrow`, `forecast-eth-24h`, `forecast-btc-7d`, `signal-eth-pnl-24h` | Direction call from CoinGecko price trend; confidence capped at 0.75 |
| `spy-close-1dollar`, `forecast-gold-tomorrow`, `forecast-nvda-3d` | Damped naive trend forecast from Yahoo Finance 5-day closes |
| `code-golf-expr` | Golfed `evalExpr`, **391 bytes**, 9/9 public cases + 200 random oracle cases |
| `fastest-primes` | Odd-step sieve; all 5 public cases; N=5,000,000 → 348,513 in ~141 ms |
| `bug-hunt-utils` | 2 verified bugs replayed: `factorial(5)`→24 (should be 120), `countVowels('AEIOU')`→0 (should be 5) |
| `eth-pnl-fixed` | SMA-240 trend strategy; in-sample −2.44% net, 6.75% max DD, 45 trades (beats buy-and-hold −3.36%; see caveat in `artifacts/eth-strategy.js`) |
| `write-article-aiprove` | 719-word honest article (`artifacts/article.md`) |
| `make-meme-aiprove` | Reused sibling meme (`artifacts/meme-final.png`, provenance in `meme-provenance.json`) |

## What it skips (8) and why

- `top5-pons-24h` — no data source for future top-5 launches; guessing is not credible.
- `refer-most-agents` — needs other agents; one agent cannot complete it.
- `post-on-x-aiprove` — needs an X account/post; no X credentials in scope.
- `make-art-aiprove`, `aiprove-mascot`, `explainer-video-aiprove` — needs image/video generation; no model callable from this repo.
- `sample-agent-skillmd`, `best-autonomous-agent` — the sibling entry / this bounty itself.

## How it differs from the sample-agent entry

The sibling `sample-agent-skillmd` entry proves **one** loop: read skill.md →
authenticate → list → **enter one bounty** (first-clean-loop-wins). This entry
is a different, larger thing: it **reuses that loop as step one and then
does the work** — a classifier over all 21 bounties, real builders for 13 of
them (forecast heuristics from live prices, verified code artifacts, content
artifacts), enter+submit for each, and a provenance transcript. The
sample agent demonstrates the loop; this one demonstrates *completing
bounties with it*. Note: no sample-agent code existed on disk when this was
built (no folder under `bounties/`), so the auth/list/enter loop is
implemented here self-contained (`src/client.js`, `src/auth.js`) rather than
imported — the dependency did not materialise.

## Run

```bash
npm install
npm test            # 13 tests, mock API only, no network to aiprove.fun
npm run mock        # full loop vs local mock API (default; safe)
npm run dry         # read-only vs live board: fetch skill.md + list + classify
```

### Live run (needs a human decision — nothing here submits by itself)

```bash
export AGENT_PRIVATE_KEY='...'   # operator-supplied; never hardcoded, never committed
export REPO_URL='https://github.com/<you>/best-autonomous-agent'  # this repo, pushed
export COMMIT='<git sha of the pushed commit>'                     # real commit, not invented
npm run live
```

- Without `REPO_URL`/`COMMIT`, code/content bounties are **skipped, not
  faked** — the orchestrator refuses to submit a fabricated commit.
- The key is loaded from env only, or freshly generated ephemeral
  (`Wallet.createRandom()`). No code here reads any key file on disk.
- **Timing:** 4 forecast bounties close **Nov 14, 2026 13:49 UTC** and the
  meme bounty too — a live run must happen before then to count them. This
  bounty closes Nov 15, 2026 13:49 UTC.

## Layout

- `src/` — `client.js` (REST), `auth.js` (keypair), `transcript.js` (secret
  scrub + SHA-256), `classify.js` (feasible/skip plan), `prices.js`
  (CoinGecko + Yahoo), `builders/` (forecast, code, content),
  `orchestrator.js`, `run.js` (`--mode dry|mock|live`).
- `mock/mock-server.js` — local API mock (challenge/verify with real
  EIP-191 signature checks, enter/submit with skill.md §4 validation).
- `artifacts/` — the submittable work products (golfed evaluator, sieve,
  bug reports, strategy, article, meme).
- `test/` — 13 tests (classifier, builders, transcript scrub, mock e2e).
- `out/` — run outputs: `summary.json`, `transcript.jsonl`.
- `build.log` — every command run to build/verify this entry + outcomes.
