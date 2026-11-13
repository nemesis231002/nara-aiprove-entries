'use strict';
// End-to-end test: the orchestrator's full loop against the local mock API.
// Uses a FRESHLY GENERATED ephemeral keypair (never a real key) and stubbed
// prices; asserts 13 submissions land on the mock and the transcript holds
// no secret material.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { startMockServer } = require('../mock/mock-server');
const makeClient = require('../src/client-mock-shim');
const { loadIdentity } = require('../src/auth');
const { run } = require('../src/orchestrator');

const STUB_PRICES = {
  cryptoCloses: async (id) => (id === 'bitcoin' ? [68000, 69000] : [1900, 1950]),
  yahooCloses: async () => ({ closes: [740, 745, 750, 748, 752], last: 752 }),
};

test('auth round-trip against mock with a fresh keypair', async () => {
  const mock = await startMockServer(0);
  try {
    const api = makeClient(mock.baseUrl);
    const { wallet, address, ephemeral } = loadIdentity();
    assert.equal(ephemeral, true); // no AGENT_PRIVATE_KEY in test env
    const token = await api.authenticate(wallet);
    assert.ok(token.startsWith('mock-token-'));
    assert.equal(address, wallet.address);
    // Wrong-signature check: a different wallet cannot claim this address.
    const { Wallet } = require('ethers');
    const other = Wallet.createRandom();
    const { challenge } = await (await fetch(`${mock.baseUrl}/api/auth/challenge?address=${address}`)).json();
    const badSig = await other.signMessage(challenge);
    const res = await fetch(`${mock.baseUrl}/api/auth/verify`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address, signature: badSig }),
    });
    assert.equal(res.status, 401);
  } finally { await mock.close(); }
});

test('orchestrator mock run: 13 submissions, 8 skips, clean transcript', async () => {
  process.env.REPO_URL = 'https://github.com/example/best-autonomous-agent';
  process.env.COMMIT = 'test-commit-0000000000000000000000000000000000000001';
  delete process.env.AGENT_PRIVATE_KEY; // force ephemeral identity
  const { summary, transcript } = await run({ mode: 'mock', priceApi: STUB_PRICES });
  assert.equal(summary.fatal, undefined);
  assert.equal(summary.skillMdRead, true);
  assert.equal(summary.ephemeralKey, true);
  assert.equal(summary.entered.length, 13);
  assert.equal(summary.submitted.length, 13);
  assert.equal(summary.failed.length, 0);
  assert.equal(summary.skipped.length, 8);
  // No secret material in the transcript (scan for hex keys / tokens).
  assert.ok(!/0x[0-9a-fA-F]{64}/.test(transcript));
  assert.ok(!/mock-token-/.test(transcript));
  // Forecast submissions carry predictions; code/content carry repoUrl+commit.
  const forecastSubs = summary.submitted.filter(s =>
    ['btc-tomorrow', 'forecast-eth-24h', 'forecast-btc-7d', 'signal-eth-pnl-24h',
     'spy-close-1dollar', 'forecast-gold-tomorrow', 'forecast-nvda-3d'].includes(s.slug));
  assert.equal(forecastSubs.length, 7);
  const codeSubs = summary.submitted.filter(s =>
    ['code-golf-expr', 'fastest-primes', 'bug-hunt-utils', 'eth-pnl-fixed',
     'write-article-aiprove', 'make-meme-aiprove'].includes(s.slug));
  assert.equal(codeSubs.length, 6);
  // Summary + transcript files were written.
  const outDir = path.join(__dirname, '..', 'out');
  assert.ok(fs.existsSync(path.join(outDir, 'summary.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'transcript.jsonl')));
  assert.match(summary.transcriptSha256, /^[0-9a-f]{64}$/);
  delete process.env.REPO_URL;
  delete process.env.COMMIT;
});

test('orchestrator mock run without REPO_URL: code/content skipped, forecasts still submit', async () => {
  delete process.env.REPO_URL;
  delete process.env.COMMIT;
  delete process.env.AGENT_PRIVATE_KEY;
  const { summary } = await run({ mode: 'mock', priceApi: STUB_PRICES });
  assert.equal(summary.submitted.length, 7); // forecasts only
  assert.ok(summary.skipped.some(s => s.slug === 'code-golf-expr' && /REPO_URL/.test(s.reason)));
});
