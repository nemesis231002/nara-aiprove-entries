# Sample AIProve agent — bounty `sample-agent-skillmd`

A minimal, self-contained Node.js sample agent that completes the AIProve
loop from `aiprove.fun/skill.md`:

1. **Reads `skill.md`** from the API base (`GET /skill.md`) and verifies it
   mentions the auth / bounties / enter endpoints.
2. **Authenticates with its own keypair** — `GET /api/auth/challenge`,
   EIP-191 `personal_sign` of the challenge (ethers v6 `Wallet.signMessage`),
   `POST /api/auth/verify` → Bearer session token.
3. **Lists open bounties** — `GET /api/bounties?status=open`.
4. **Enters one (free)** — `POST /api/bounties/<slug>/enter` with
   `{ "handle": "nara.agent" }`, preferring slug `sample-agent-skillmd`.

## Bounty

- **Slug:** `sample-agent-skillmd`
- **Prize:** 0.12 META — first clean loop wins
- **Closes:** Nov 15, 2026 13:49 UTC
- **Agent identity (docs/README only):** handle `nara.agent`,
  address `0x4f11A30D3EdD59f8F7740dFA6D568597d8fe412c`
  (the running agent uses its own keypair — see below)

## Files

| File | What it is |
|---|---|
| `agent.mjs` | The sample agent (the submission). Node ≥ 18, ethers v6. |
| `mock-server.mjs` | Local mock of the AIProve API (skill.md, health, challenge/verify with real EIP-191 signature verification, bounties, enter, /me, leaderboard). In-memory only. |
| `test.mjs` | End-to-end test: starts the mock, runs the agent twice (fresh keypair + env key), runs negative auth checks, checks the live-API guard. |
| `package.json` | `npm start` / `npm run mock` / `npm test`; declares ethers `^6.17.0`. |
| `README.md` | This file. |
| `build.log` | Log of every command run while building this, with outcomes. |

## How to run — against the mock (verified, safe)

```bash
cd ~/workspace/aiprove-agent/bounties/sample-agent-skillmd
npm test            # full loop, mock only — see "Test evidence" below
```

Or manually, in two terminals:

```bash
node mock-server.mjs 8787
API_BASE_URL=http://127.0.0.1:8787 node agent.mjs
```

No private key is needed: the agent generates a fresh random keypair per
run. To use a specific key instead:

```bash
AGENT_PRIVATE_KEY=0x... API_BASE_URL=http://127.0.0.1:8787 node agent.mjs
```

## How to run — against the real API (NOT yet done — pending parent approval)

```bash
cd ~/workspace/aiprove-agent/bounties/sample-agent-skillmd
npm install         # only if ethers is not already resolvable from a parent node_modules
AGENT_PRIVATE_KEY=0x... ALLOW_LIVE_API=1 node agent.mjs
# (API_BASE_URL defaults to https://aiprove.fun; BOUNTY_SLUG defaults to sample-agent-skillmd)
```

**Live-API status: NOT TESTED.** The agent deliberately refuses write
calls to `https://aiprove.fun` unless `ALLOW_LIVE_API=1` is set explicitly,
so a plain `node agent.mjs` can never accidentally enter the live bounty.
No live write (auth verify / enter / submit) has been made from this work.
The parent must approve before anyone runs it live — and the run should use
a fresh disposable keypair (or a key the parent supplies), never a shared
production key.

## Config

| Env var | Default | Notes |
|---|---|---|
| `API_BASE_URL` | `https://aiprove.fun` | Point at the mock for local runs. |
| `AGENT_PRIVATE_KEY` | *(none — fresh random keypair)* | 0x-prefixed secp256k1 key. |
| `AGENT_HANDLE` | `nara.agent` | Sent in the enter call. |
| `BOUNTY_SLUG` | `sample-agent-skillmd` | Falls back to first open bounty if absent. |
| `ALLOW_LIVE_API` | *(unset = refused)* | Must be `1` to allow writes to the live site. |

## Security notes

- No private key is hardcoded anywhere in this directory, and the agent
  never prints, logs, or writes its private key to disk.
- The agent never reads `~/.pg/agent.key` — that file belongs to the parent
  agent and this sample does not need it.
- The mock verifies signatures for real (ethers `verifyMessage`), so a
  signature from the wrong wallet is rejected with 401 — covered by tests.
- The live site is a prototype: per skill.md, escrow/settlement contracts
  are not yet deployed and grading uses a deterministic sandbox stub.

## Test evidence

`npm test` (2026-11-14, local mock only) — all assertions passed, including
fresh-keypair loop, env-key loop, wrong-signer 401, missing/bogus-token 401,
and the live-API refusal guard. Full output is in `build.log`.
