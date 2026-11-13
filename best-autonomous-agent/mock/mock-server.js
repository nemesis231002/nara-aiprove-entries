'use strict';
// Local mock of the AIProve API (skill.md surface only). Used by tests and by
// `node src/run.js --mode mock`. NEVER points at aiprove.fun: it binds to
// 127.0.0.1 on an ephemeral port and implements:
//   GET  /skill.md, GET /api/auth/challenge, POST /api/auth/verify
//   GET  /api/bounties, GET /api/bounties/:slug
//   POST /api/bounties/:slug/enter, POST /api/bounties/:slug/submit
// verify() checks the EIP-191 signature with ethers.verifyMessage, like a
// real server would. submit() enforces skill.md §4 payload shapes.
const http = require('node:http');
const crypto = require('node:crypto');
const { verifyMessage } = require('ethers');

const SKILL_MD = `# skill.md — Compete on the Agent Bounty Board (AIProve)
API base: https://aiprove.fun
GET /skill.md
GET /api/health
GET /api/auth/challenge?address=
POST /api/auth/verify
GET /api/bounties
GET /api/bounties/:slug
POST /api/bounties/:slug/enter
POST /api/bounties/:slug/submit
`;

// Mirror of the live board (2026-11-13, 21 open bounties), trimmed to the
// slugs the orchestrator must handle plus representative skips.
const BOUNTIES = [
  { slug: 'btc-tomorrow', cat: 'forecast', lane: 'AutoGrade', status: 'open', endDate: 'Nov 14, 2026 13:49 UTC' },
  { slug: 'forecast-eth-24h', cat: 'forecast', lane: 'AutoGrade', status: 'open', endDate: 'Nov 14, 2026 13:49 UTC' },
  { slug: 'forecast-btc-7d', cat: 'forecast', lane: 'AutoGrade', status: 'open', endDate: 'Nov 20, 2026 13:49 UTC' },
  { slug: 'signal-eth-pnl-24h', cat: 'trading', lane: 'AutoGrade', status: 'open', endDate: 'Nov 14, 2026 13:49 UTC' },
  { slug: 'spy-close-1dollar', cat: 'forecast', lane: 'AutoGrade', status: 'open', endDate: 'Nov 14, 2026 13:49 UTC' },
  { slug: 'forecast-gold-tomorrow', cat: 'forecast', lane: 'AutoGrade', status: 'open', endDate: 'Nov 14, 2026 13:49 UTC' },
  { slug: 'forecast-nvda-3d', cat: 'forecast', lane: 'AutoGrade', status: 'open', endDate: 'Nov 16, 2026 13:49 UTC' },
  { slug: 'code-golf-expr', cat: 'development', lane: 'AutoGrade', status: 'open', endDate: 'Nov 16, 2026 13:49 UTC' },
  { slug: 'fastest-primes', cat: 'development', lane: 'AutoGrade', status: 'open', endDate: 'Nov 16, 2026 13:49 UTC' },
  { slug: 'bug-hunt-utils', cat: 'development', lane: 'AutoGrade', status: 'open', endDate: 'Nov 15, 2026 13:49 UTC' },
  { slug: 'eth-pnl-fixed', cat: 'trading', lane: 'AutoGrade', status: 'open', endDate: 'Nov 20, 2026 13:49 UTC' },
  { slug: 'write-article-aiprove', cat: 'content', lane: 'PosterJudge', status: 'open', endDate: 'Nov 16, 2026 13:49 UTC' },
  { slug: 'make-meme-aiprove', cat: 'marketing', lane: 'PosterJudge', status: 'open', endDate: 'Nov 14, 2026 13:49 UTC' },
  { slug: 'top5-pons-24h', cat: 'forecast', lane: 'AutoGrade', status: 'open', endDate: 'Nov 14, 2026 13:49 UTC' },
  { slug: 'refer-most-agents', cat: 'marketing', lane: 'AutoGrade', status: 'open', endDate: 'Nov 28, 2026 13:49 UTC' },
  { slug: 'post-on-x-aiprove', cat: 'marketing', lane: 'PosterJudge', status: 'open', endDate: 'Nov 14, 2026 13:49 UTC' },
  { slug: 'make-art-aiprove', cat: 'design', lane: 'PosterJudge', status: 'open', endDate: 'Nov 17, 2026 13:49 UTC' },
  { slug: 'aiprove-mascot', cat: 'design', lane: 'PosterJudge', status: 'open', endDate: 'Nov 20, 2026 13:49 UTC' },
  { slug: 'explainer-video-aiprove', cat: 'content', lane: 'PosterJudge', status: 'open', endDate: 'Nov 20, 2026 13:49 UTC' },
  { slug: 'sample-agent-skillmd', cat: 'development', lane: 'AutoGrade', status: 'open', endDate: 'Nov 15, 2026 13:49 UTC' },
  { slug: 'best-autonomous-agent', cat: 'development', lane: 'AutoGrade', status: 'open', endDate: 'Nov 15, 2026 13:49 UTC' },
];

function startMockServer(port = 0) {
  const records = { entries: [], submissions: [] };
  const challenges = new Map(); // address -> challenge
  const tokens = new Map(); // token -> address

  const server = http.createServer(async (req, res) => {
    const send = (code, obj, type = 'application/json') => {
      res.writeHead(code, { 'content-type': type });
      res.end(type === 'application/json' ? JSON.stringify(obj) : obj);
    };
    const body = await new Promise(resolve => {
      let b = '';
      req.on('data', c => { b += c; });
      req.on('end', () => resolve(b));
    });
    let json = {};
    try { json = body ? JSON.parse(body) : {}; } catch { return send(400, { error: 'bad json' }); }
    const url = new URL(req.url, 'http://127.0.0.1');

    if (req.method === 'GET' && url.pathname === '/skill.md') return send(200, SKILL_MD, 'text/plain');
    if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/api/auth/challenge') {
      const address = url.searchParams.get('address');
      if (!address) return send(400, { error: 'address required' });
      const challenge = `mock-challenge-${crypto.randomBytes(16).toString('hex')}`;
      challenges.set(address.toLowerCase(), challenge);
      return send(200, { address, challenge });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/verify') {
      const { address, signature } = json;
      const challenge = challenges.get(String(address).toLowerCase());
      if (!challenge) return send(400, { error: 'no challenge for address' });
      let recovered;
      try { recovered = verifyMessage(challenge, signature); } catch { return send(401, { error: 'bad signature' }); }
      if (recovered.toLowerCase() !== String(address).toLowerCase()) {
        return send(401, { error: 'signature does not match address' });
      }
      const token = `mock-token-${crypto.randomBytes(12).toString('hex')}`;
      tokens.set(token, address);
      return send(200, { address, token, expiresAt: Date.now() + 3600e3 });
    }
    if (req.method === 'GET' && url.pathname === '/api/bounties') {
      return send(200, { bounties: BOUNTIES, count: BOUNTIES.length });
    }
    const m = url.pathname.match(/^\/api\/bounties\/([\w-]+)(\/(enter|submit))?$/);
    if (m) {
      const slug = m[1];
      const bounty = BOUNTIES.find(b => b.slug === slug);
      if (!bounty) return send(404, { error: 'unknown bounty' });
      if (req.method === 'GET' && !m[2]) return send(200, { bounty, entries: [], submissions: [] });
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
      if (!tokens.has(token)) return send(401, { error: 'invalid token' });
      if (req.method === 'POST' && m[3] === 'enter') {
        const entry = { id: crypto.randomUUID(), bountySlug: slug, agent: tokens.get(token), handle: json.handle || null };
        records.entries.push(entry);
        return send(200, entry);
      }
      if (req.method === 'POST' && m[3] === 'submit') {
        const okPrediction = json.prediction && typeof json.prediction === 'object';
        const okRepo = json.repoUrl && json.commit;
        if (!okPrediction && !okRepo) return send(400, { error: 'submission needs prediction or repoUrl+commit' });
        const sub = { submissionId: crypto.randomUUID(), bountySlug: slug, agent: tokens.get(token), kind: okPrediction ? 'prediction' : 'repo', handle: json.handle || null };
        records.submissions.push({ ...sub, payload: json });
        return send(200, sub);
      }
    }
    return send(404, { error: 'not found' });
  });

  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => {
      const { port: p } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${p}`,
        records,
        close: () => new Promise(r => server.close(r)),
      });
    });
  });
}

module.exports = { startMockServer, BOUNTIES };
