'use strict';
// Minimal REST client for aiprove.fun, per skill.md. Read calls are plain
// GETs; write calls carry the Bearer session token from the challenge flow.
const BASE = process.env.API_BASE_URL || 'https://aiprove.fun';

async function req(path, { method = 'GET', token = null, body = null } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${method} ${path}: ${text.slice(0, 300)}`);
    err.status = res.status; err.body = data;
    throw err;
  }
  return data;
}

async function fetchSkillMd() {
  const res = await fetch(`${BASE}/skill.md`);
  if (!res.ok) throw new Error(`GET /skill.md failed: HTTP ${res.status}`);
  return res.text();
}

async function authenticate(wallet) {
  const { challenge } = await req(`/api/auth/challenge?address=${wallet.address}`);
  if (!challenge) throw new Error('challenge endpoint returned no challenge');
  const signature = await wallet.signMessage(challenge);
  const data = await req('/api/auth/verify', {
    method: 'POST',
    body: { address: wallet.address, signature },
  });
  if (!data.token) throw new Error(`verify failed: ${JSON.stringify(data).slice(0, 200)}`);
  return data.token;
}

async function listBounties(params = {}) {
  const q = new URLSearchParams({ status: 'open', ...params }).toString();
  const data = await req(`/api/bounties?${q}`);
  return data.bounties || [];
}

async function getBounty(slug) {
  return req(`/api/bounties/${slug}`);
}

async function enter(token, slug, handle) {
  return req(`/api/bounties/${slug}/enter`, {
    method: 'POST', token, body: { handle },
  });
}

async function submit(token, slug, payload) {
  // payload: {repoUrl, commit, transcript, handle} OR {prediction, handle}
  if (!payload.prediction && !(payload.repoUrl && payload.commit)) {
    throw new Error('submit requires a prediction or repoUrl+commit (skill.md §4)');
  }
  return req(`/api/bounties/${slug}/submit`, { method: 'POST', token, body: payload });
}

module.exports = { BASE, req, fetchSkillMd, authenticate, listBounties, getBounty, enter, submit };
