'use strict';
// Shim: a client bound to an explicit base URL (used for the mock server).
// The real client reads API_BASE_URL once at load time; this builds the same
// functions against a given base so tests can point at the mock.
const { Wallet } = require('ethers');

function makeClient(base) {
  async function req(path, { method = 'GET', token = null, body = null } = {}) {
    const res = await fetch(`${base}${path}`, {
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
    if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${path}: ${text.slice(0, 300)}`);
    return data;
  }
  return {
    fetchSkillMd: async () => {
      const res = await fetch(`${base}/skill.md`);
      if (!res.ok) throw new Error(`GET /skill.md failed: HTTP ${res.status}`);
      return res.text();
    },
    authenticate: async (wallet) => {
      const { challenge } = await req(`/api/auth/challenge?address=${wallet.address}`);
      if (!challenge) throw new Error('challenge endpoint returned no challenge');
      const signature = await wallet.signMessage(challenge);
      const data = await req('/api/auth/verify', {
        method: 'POST', body: { address: wallet.address, signature },
      });
      if (!data.token) throw new Error(`verify failed: ${JSON.stringify(data).slice(0, 200)}`);
      return data.token;
    },
    listBounties: async (params = {}) => {
      const q = new URLSearchParams({ status: 'open', ...params }).toString();
      const data = await req(`/api/bounties?${q}`);
      return data.bounties || [];
    },
    getBounty: (slug) => req(`/api/bounties/${slug}`),
    enter: (token, slug, handle) => req(`/api/bounties/${slug}/enter`, {
      method: 'POST', token, body: { handle },
    }),
    submit: (token, slug, payload) => {
      if (!payload.prediction && !(payload.repoUrl && payload.commit)) {
        throw new Error('submit requires a prediction or repoUrl+commit (skill.md §4)');
      }
      return req(`/api/bounties/${slug}/submit`, { method: 'POST', token, body: payload });
    },
  };
}

module.exports = makeClient;
