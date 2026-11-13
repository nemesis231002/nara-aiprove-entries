'use strict';
// Unit tests: classifier, forecast builders, code verifiers, transcript scrub.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { classifyAll } = require('../src/classify');
const { buildForecast, directionFromCloses, closeFromCloses } = require('../src/builders/forecast');
const { buildCode } = require('../src/builders/code');
const { buildContent } = require('../src/builders/content');
const { scrub, Transcript } = require('../src/transcript');
const { BOUNTIES } = require('../mock/mock-server');

test('classifier: 13 feasible, 8 skipped, no unknown types', () => {
  const { feasible, skipped, unknown } = classifyAll(BOUNTIES);
  assert.equal(feasible.length, 13);
  assert.equal(skipped.length, 8);
  assert.equal(unknown.length, 0);
  const slugs = feasible.map(f => f.slug).sort();
  assert.deepEqual(slugs, [
    'btc-tomorrow', 'bug-hunt-utils', 'code-golf-expr', 'eth-pnl-fixed',
    'fastest-primes', 'forecast-btc-7d', 'forecast-eth-24h',
    'forecast-gold-tomorrow', 'forecast-nvda-3d', 'make-meme-aiprove',
    'signal-eth-pnl-24h', 'spy-close-1dollar', 'write-article-aiprove',
  ]);
  const skipSlugs = skipped.map(s => s.slug).sort();
  assert.deepEqual(skipSlugs, [
    'aiprove-mascot', 'best-autonomous-agent', 'explainer-video-aiprove',
    'make-art-aiprove', 'post-on-x-aiprove', 'refer-most-agents',
    'sample-agent-skillmd', 'top5-pons-24h',
  ]);
});

test('forecast: direction + close heuristics', () => {
  const up = directionFromCloses([100, 102, 105]);
  assert.equal(up.answer, 'yes');
  assert.ok(up.confidence > 0.5 && up.confidence <= 0.75);
  const down = directionFromCloses([100, 98, 95]);
  assert.equal(down.answer, 'no');
  const neutral = directionFromCloses(null);
  assert.equal(neutral.confidence, 0.5);
  assert.equal(neutral.fallback, true);
  assert.equal(closeFromCloses([100, 101, 102]), 102.51);
  assert.equal(closeFromCloses(null), null);
});

test('forecast: builders with stubbed prices produce valid payloads', async () => {
  const stub = {
    cryptoCloses: async (id) => (id === 'bitcoin' ? [68000, 69000] : [1900, 1950]),
    yahooCloses: async () => ({ closes: [740, 745, 750, 748, 752], last: 752 }),
  };
  for (const slug of ['btc-tomorrow', 'forecast-eth-24h', 'forecast-btc-7d', 'signal-eth-pnl-24h']) {
    const b = await buildForecast(slug, stub);
    assert.equal(b.prediction.answer, 'yes');
    assert.ok(b.prediction.confidence >= 0.51 && b.prediction.confidence <= 0.75);
  }
  for (const slug of ['spy-close-1dollar', 'forecast-gold-tomorrow', 'forecast-nvda-3d']) {
    const b = await buildForecast(slug, stub);
    assert.equal(typeof b.prediction.answer, 'number');
    assert.ok(b.prediction.answer > 0);
  }
  const dead = { cryptoCloses: async () => { throw new Error('down'); }, yahooCloses: async () => { throw new Error('down'); } };
  const fb = await buildForecast('btc-tomorrow', dead);
  assert.equal(fb.prediction.confidence, 0.5); // neutral fallback, flagged
  assert.equal(fb.meta.fallback, true);
  assert.equal(await buildForecast('spy-close-1dollar', dead), null); // no price, no guess
});

test('code-golf: passes public cases + 200 random oracle cases, <400 bytes', () => {
  const built = buildCode('codeGolf');
  assert.ok(built.verification.bytes < 400, `golfed file is ${built.verification.bytes} bytes`);
  assert.equal(built.verification.passed, 9);
  const { evalExpr } = require('../artifacts/eval-expr.js');
  // Random-expression oracle: compare against JS eval on generated expressions.
  const rnd = (seed => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)(42);
  const gen = (depth) => {
    if (depth === 0) return String(Math.floor(rnd() * 20) + 1) + (rnd() < 0.3 ? '.' + Math.floor(rnd() * 9) : '');
    const op = ['+', '-', '*', '/'][Math.floor(rnd() * 4)];
    const l = gen(depth - 1), r = gen(depth - 1);
    const e = `${l}${op}${r}`;
    return rnd() < 0.5 ? `(${e})` : e;
  };
  for (let i = 0; i < 200; i++) {
    const expr = gen(3);
    const expected = eval(expr); // eslint-disable-line no-eval
    const got = evalExpr(expr);
    assert.ok(Math.abs(got - expected) < 1e-9, `${expr}: got ${got}, want ${expected}`);
  }
});

test('fastest-primes: public cases + N=5,000,000 correct and fast', () => {
  const built = buildCode('fastestPrimes');
  assert.equal(built.verification.passed, 5);
  assert.equal(built.verification.n5m, 348513);
  assert.ok(built.verification.ms5m < 2000, `5M sieve took ${built.verification.ms5m}ms`);
});

test('bug-hunt: both reported bugs replay as genuine', () => {
  const built = buildCode('bugHunt');
  assert.equal(built.verification.verified.length, 2);
  assert.deepEqual(built.verification.verified.map(v => v.fn).sort(), ['countVowels', 'factorial']);
  assert.equal(built.verification.verified.find(v => v.fn === 'factorial').buggyOutput, 24);
  assert.equal(built.verification.verified.find(v => v.fn === 'countVowels').buggyOutput, 0);
});

test('eth-backtest: strategy runs, deterministic, sane PnL', () => {
  const a = buildCode('ethBacktest');
  const b = buildCode('ethBacktest');
  assert.deepEqual(a.verification, b.verification);
  assert.equal(a.verification.bars, 1440);
  assert.ok(Number.isFinite(a.verification.pnlPct));
  assert.ok(a.verification.maxDrawdownPct >= 0 && a.verification.maxDrawdownPct <= 100);
});

test('content: article long enough, meme present', () => {
  const art = buildContent('article');
  assert.ok(art.verification.words >= 400);
  const meme = buildContent('meme');
  assert.ok(meme.verification.bytes > 10000);
});

test('transcript: scrub redacts keys and tokens', () => {
  const key = '0x' + 'ab'.repeat(32);
  const token = 'Bearer abc.def.ghi123';
  const t = new Transcript();
  t.log('test', `key=${key} token=${token} addr=0x1234`);
  const text = t.text();
  assert.ok(!text.includes(key));
  assert.ok(!text.includes('abc.def.ghi123'));
  assert.ok(text.includes('[REDACTED-PRIVATE-KEY]'));
  assert.ok(text.includes('[REDACTED-TOKEN]'));
  assert.ok(text.includes('0x1234')); // short address is not a secret
  assert.equal(scrub(`AGENT_PRIVATE_KEY=${'cd'.repeat(32)}`), 'AGENT_PRIVATE_KEY=[REDACTED]');
  assert.match(t.hash(), /^[0-9a-f]{64}$/);
});

test('no source file reads the operator key file', () => {
  const srcDir = path.join(__dirname, '..', 'src');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of [...walk(srcDir), ...walk(path.join(__dirname, '..', 'mock'))]) {
    const content = fs.readFileSync(f, 'utf8');
    assert.ok(!content.includes('.pg/agent.key'), `${f} references the operator key file`);
    assert.ok(!content.includes('agent.key'), `${f} references agent.key`);
  }
});
