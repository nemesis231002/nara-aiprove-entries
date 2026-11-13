#!/usr/bin/env node
/**
 * Sample AIProve agent — bounty: sample-agent-skillmd
 *
 * Loop (per aiprove.fun/skill.md):
 *   1. Read skill.md from the API base (GET /skill.md)
 *   2. Authenticate with its OWN keypair:
 *        GET /api/auth/challenge?address=<addr>
 *        sign challenge with EIP-191 personal_sign (ethers Wallet.signMessage)
 *        POST /api/auth/verify  -> Bearer session token
 *   3. List open bounties: GET /api/bounties?status=open
 *   4. Enter one (free): POST /api/bounties/<slug>/enter { handle }
 *
 * Identity for docs/README only: handle "nara.agent",
 * address 0x4f11A30D3EdD59f8F7740dFA6D568597d8fe412c.
 * The RUNNING agent uses its own keypair: a fresh random one per run,
 * unless AGENT_PRIVATE_KEY is supplied in the environment.
 *
 * SECURITY — never hardcode a private key; never log one; never read
 * ~/.pg/agent.key (that file belongs to the parent agent, not this sample).
 * The private key is used only in-memory to sign the challenge.
 *
 * LIVE-API GUARD: write calls (verify / enter) against the real
 * https://aiprove.fun are REFUSED unless ALLOW_LIVE_API=1 is set
 * explicitly. Live testing is pending parent approval. Point
 * API_BASE_URL at the local mock (see mock-server.mjs / test.mjs)
 * for the verified loop.
 *
 * Env:
 *   API_BASE_URL       default https://aiprove.fun
 *   AGENT_PRIVATE_KEY  optional 0x-prefixed secp256k1 key; else fresh random
 *   AGENT_HANDLE       default "nara.agent"
 *   BOUNTY_SLUG        preferred slug; default "sample-agent-skillmd"
 *                      (falls back to the first open bounty if absent)
 *   ALLOW_LIVE_API     set to "1" to allow writes to https://aiprove.fun
 *
 * Run:
 *   node agent.mjs                       # against API_BASE_URL (mock in tests)
 *   API_BASE_URL=http://127.0.0.1:8787 node agent.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Resolves via ancestor node_modules (~/workspace/aiprove-agent/node_modules)
// or a local install (`npm install` in this directory). No other deps.
const { Wallet } = require("ethers");

const API = (process.env.API_BASE_URL || "https://aiprove.fun").replace(/\/$/, "");
const HANDLE = process.env.AGENT_HANDLE || "nara.agent";
const PREFERRED_SLUG = process.env.BOUNTY_SLUG || "sample-agent-skillmd";
const IS_LIVE = API === "https://aiprove.fun";

if (IS_LIVE && process.env.ALLOW_LIVE_API !== "1") {
  console.error(
    "REFUSED: write calls to the live API (https://aiprove.fun) need " +
      "ALLOW_LIVE_API=1. Live-API testing is pending parent approval.\n" +
      "Run against the local mock instead: npm test  (or set API_BASE_URL to the mock)."
  );
  process.exit(2);
}

async function jsonOrThrow(res, step) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${step}: non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`${step}: HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function main() {
  // --- Identity: own keypair (fresh random, or AGENT_PRIVATE_KEY) ---
  let wallet;
  let keySource;
  if (process.env.AGENT_PRIVATE_KEY) {
    wallet = new Wallet(process.env.AGENT_PRIVATE_KEY.trim());
    keySource = "AGENT_PRIVATE_KEY env var";
  } else {
    wallet = Wallet.createRandom();
    keySource = "fresh random keypair (generated for this run only, not saved)";
  }
  console.log(`[1/4] Identity: address=${wallet.address} handle=${HANDLE} key=${keySource}`);
  // NOTE: the private key is never printed, logged, or written to disk.

  // --- Step 1: read skill.md ---
  const skillRes = await fetch(`${API}/skill.md`);
  if (!skillRes.ok) throw new Error(`skill.md: HTTP ${skillRes.status}`);
  const skill = await skillRes.text();
  for (const needle of ["/api/auth/challenge", "/api/auth/verify", "/api/bounties", "/enter"]) {
    if (!skill.includes(needle)) throw new Error(`skill.md missing expected endpoint ${needle}`);
  }
  console.log(`[1/4] Read skill.md from ${API}/skill.md (${skill.length} bytes, endpoints verified)`);

  // --- Step 2: authenticate (challenge -> EIP-191 sign -> verify) ---
  const challengeData = await jsonOrThrow(
    await fetch(`${API}/api/auth/challenge?address=${wallet.address}`),
    "challenge"
  );
  if (!challengeData.challenge) throw new Error(`challenge: no challenge in ${JSON.stringify(challengeData)}`);
  console.log(`[2/4] Challenge received: ${String(challengeData.challenge).slice(0, 80)}...`);
  const signature = await wallet.signMessage(challengeData.challenge);
  const verifyData = await jsonOrThrow(
    await fetch(`${API}/api/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: wallet.address, signature }),
    }),
    "verify"
  );
  if (!verifyData.token) throw new Error(`verify: no token in ${JSON.stringify(verifyData)}`);
  const token = verifyData.token;
  console.log(
    `[2/4] Authenticated: address=${verifyData.address} token=${token.slice(0, 12)}... expiresAt=${verifyData.expiresAt}`
  );

  // --- Step 3: list open bounties ---
  const listData = await jsonOrThrow(
    await fetch(`${API}/api/bounties?status=open`),
    "list bounties"
  );
  const bounties = Array.isArray(listData) ? listData : listData.bounties;
  if (!Array.isArray(bounties) || bounties.length === 0) {
    throw new Error("list bounties: no open bounties returned");
  }
  console.log(`[3/4] Open bounties (${bounties.length}):`);
  for (const b of bounties) {
    console.log(`       - ${b.slug} | ${b.title} | ${b.amt} ${b.unit} | lane=${b.lane} | closes=${b.closes}`);
  }

  // --- Step 4: enter one (prefer BOUNTY_SLUG, else first open) ---
  const target = bounties.find((b) => b.slug === PREFERRED_SLUG) || bounties[0];
  console.log(`[4/4] Entering bounty: ${target.slug} (${target.title})`);
  const enterData = await jsonOrThrow(
    await fetch(`${API}/api/bounties/${encodeURIComponent(target.slug)}/enter`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ handle: HANDLE }),
    }),
    "enter"
  );
  console.log(`[4/4] Entered: ${JSON.stringify(enterData)}`);

  console.log("LOOP COMPLETE: skill.md read -> authenticated -> listed open bounties -> entered " + target.slug);
  console.log(JSON.stringify({ address: wallet.address, handle: HANDLE, bounty: target.slug, entered: enterData }, null, 2));
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
