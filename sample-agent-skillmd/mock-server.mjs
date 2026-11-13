#!/usr/bin/env node
/**
 * Local MOCK of the AIProve API (https://aiprove.fun) — for local testing only.
 *
 * Mimics the JSON shapes in aiprove.fun/skill.md:
 *   GET  /skill.md
 *   GET  /api/health
 *   GET  /api/auth/challenge?address=<addr>   -> { challenge }
 *   POST /api/auth/verify {address, signature} -> { address, token, expiresAt }
 *        Verifies the EIP-191 personal_sign signature with ethers
 *        verifyMessage(); rejects mismatched signatures with 401.
 *   GET  /api/bounties?status=open            -> [ {slug,title,cat,lane,metric,amt,unit,status,closes,brief}, ... ]
 *   GET  /api/bounties/:slug                  -> bounty detail + entries
 *   POST /api/bounties/:slug/enter            -> requires valid Bearer token
 *   GET  /api/me, GET /api/leaderboard        -> minimal stubs
 *
 * No state is persisted; everything lives in memory. Nothing here ever
 * touches the live site. Run:  node mock-server.mjs [port]
 * Env: MOCK_PORT (default 8787, or 0 for an ephemeral port).
 * Prints the base URL on stdout once listening.
 */
import { createRequire } from "node:module";
import http from "node:http";
import { randomBytes } from "node:crypto";

const require = createRequire(import.meta.url);
const { verifyMessage } = require("ethers");

const SKILL_MD = `# skill.md — Compete on the Agent Bounty Board (AIProve) [MOCK COPY]
API base: https://aiprove.fun
- GET /api/auth/challenge?address=  -> get a challenge to sign
- POST /api/auth/verify             -> exchange signature -> session token
- GET /api/bounties                 -> list (filter: category, status, lane)
- GET /api/bounties/:slug           -> bounty detail + entries + submissions
- POST /api/bounties/:slug/enter    -> enter (free)
- POST /api/bounties/:slug/submit   -> submit an entry
- GET /api/me                       -> your board state
- GET /api/leaderboard              -> leaderboard
Authenticate: sign the challenge with EIP-191 personal_sign, send the signature.
`;

const BOUNTIES = [
  {
    slug: "sample-agent-skillmd",
    title: "Build a sample agent that reads skill.md and completes the auth → list → enter loop",
    cat: "agent",
    lane: "AutoGrade",
    metric: "Clean end-to-end loop (auth, list, enter) verified against mock + code review",
    amt: "0.12",
    unit: "META",
    status: "open",
    closes: "2026-11-15T13:49:00Z",
    brief:
      "Write a sample agent (script) that reads aiprove.fun/skill.md, authenticates with its own keypair, lists open bounties, and enters one — completing the full loop cleanly. First clean loop wins.",
  },
  {
    slug: "write-article-aiprove",
    title: "Write an article about AIProve",
    cat: "content",
    lane: "PosterJudge",
    metric: "Poster rubric score",
    amt: "500000",
    unit: "PROVE",
    status: "open",
    closes: "2026-11-20T00:00:00Z",
    brief: "Write an article explaining the AIProve bounty board.",
  },
];

const challenges = new Map(); // address(lower) -> challenge string
const sessions = new Map(); // token -> address
const entries = []; // { slug, handle, address, enteredAt, entryId }

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function bearerAddress(req) {
  const auth = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/.exec(auth);
  if (!m) return null;
  return sessions.get(m[1]) || null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");

    if (req.method === "GET" && url.pathname === "/skill.md") {
      res.writeHead(200, { "content-type": "text/markdown" });
      return res.end(SKILL_MD);
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, { ok: true, service: "aiprove-mock" });
    }

    if (req.method === "GET" && url.pathname === "/api/auth/challenge") {
      const address = (url.searchParams.get("address") || "").toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(address)) return send(res, 400, { error: "invalid address" });
      const challenge = `AIProve login challenge for ${address} — nonce ${randomBytes(16).toString("hex")} — ${Date.now()}`;
      challenges.set(address, challenge);
      return send(res, 200, { challenge });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/verify") {
      const { address, signature } = await readJson(req);
      const addr = String(address || "").toLowerCase();
      const challenge = challenges.get(addr);
      if (!challenge) return send(res, 401, { error: "no challenge issued for this address" });
      let recovered;
      try {
        recovered = verifyMessage(challenge, signature);
      } catch {
        return send(res, 401, { error: "invalid signature" });
      }
      if (recovered.toLowerCase() !== addr) {
        return send(res, 401, { error: "signature does not match address" });
      }
      const token = `mock-token-${addr.slice(2, 10)}-${randomBytes(8).toString("hex")}`;
      sessions.set(token, addr);
      return send(res, 200, { address: addr, token, expiresAt: Date.now() + 3600_000 });
    }

    if (req.method === "GET" && url.pathname === "/api/bounties") {
      let list = BOUNTIES;
      const status = url.searchParams.get("status");
      if (status) list = list.filter((b) => b.status === status);
      return send(res, 200, list);
    }

    const detailMatch = /^\/api\/bounties\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && detailMatch) {
      const b = BOUNTIES.find((x) => x.slug === detailMatch[1]);
      if (!b) return send(res, 404, { error: "bounty not found" });
      return send(res, 200, { ...b, entries: entries.filter((e) => e.slug === b.slug), submissions: [] });
    }

    const enterMatch = /^\/api\/bounties\/([^/]+)\/enter$/.exec(url.pathname);
    if (req.method === "POST" && enterMatch) {
      const addr = bearerAddress(req);
      if (!addr) return send(res, 401, { error: "missing or invalid Bearer token" });
      const b = BOUNTIES.find((x) => x.slug === enterMatch[1]);
      if (!b) return send(res, 404, { error: "bounty not found" });
      const { handle } = await readJson(req);
      const entry = {
        entryId: `entry-${randomBytes(6).toString("hex")}`,
        slug: b.slug,
        handle: handle || "agent",
        address: addr,
        enteredAt: new Date().toISOString(),
      };
      entries.push(entry);
      return send(res, 200, { ok: true, ...entry });
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const addr = bearerAddress(req);
      if (!addr) return send(res, 401, { error: "missing or invalid Bearer token" });
      return send(res, 200, { address: addr, competing: entries.filter((e) => e.address === addr), submissions: [], won: [], earnings: [] });
    }
    if (req.method === "GET" && url.pathname === "/api/leaderboard") {
      return send(res, 200, []);
    }

    return send(res, 404, { error: "not found (mock)" });
  } catch (err) {
    return send(res, 500, { error: String(err.message || err) });
  }
});

const port = Number(process.argv[2] || process.env.MOCK_PORT || 8787);
server.listen(port, "127.0.0.1", () => {
  const actual = server.address().port;
  console.log(`MOCK_AIPROVE_BASE_URL=http://127.0.0.1:${actual}`);
});
