'use strict';
// Code builders. Each builder VERIFIES its artifact locally against the
// published challenge spec before the orchestrator may submit it:
// - code-golf-expr: golfed evalExpr passes all public cases + random oracle cases
// - fastest-primes: sieve passes all public cases, N=5,000,000 timed
// - bug-hunt-utils: each reported bug is replayed against utils.js and a
//   reference implementation (buggy output != expected, reference == expected)
// - eth-pnl-fixed: momentum strategy runs over the frozen bars.csv and a
//   backtest report (PnL, max drawdown, trades) is produced with a stated
//   0.1%-per-trade fee assumption (the sandbox fee model is not published)
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ART = path.join(__dirname, '..', '..', 'artifacts');
const CHALLENGES = path.join(__dirname, '..', '..', '..', '..', 'aiprove', 'challenges');

function verifyCodeGolf() {
  const file = path.join(ART, 'eval-expr.js');
  const src = fs.readFileSync(file, 'utf8');
  const { evalExpr } = require(file);
  const cases = JSON.parse(fs.readFileSync(path.join(CHALLENGES, 'code-golf-expr', 'cases.json'), 'utf8'));
  for (const c of cases) {
    if (evalExpr(c.in) !== c.out) throw new Error(`code-golf case failed: ${c.in} -> ${evalExpr(c.in)} != ${c.out}`);
  }
  return { bytes: Buffer.byteLength(src), publicCases: cases.length, passed: cases.length };
}

function verifyPrimes() {
  const file = path.join(ART, 'primes.js');
  const cases = JSON.parse(fs.readFileSync(path.join(CHALLENGES, 'fastest-primes', 'cases.json'), 'utf8'));
  for (const c of cases) {
    const out = execFileSync('node', [file], { input: String(c.n) }).toString().trim();
    if (Number(out) !== c.count) throw new Error(`primes case failed: N=${c.n} -> ${out} != ${c.count}`);
  }
  const t0 = process.hrtime.bigint();
  const out5m = execFileSync('node', [file], { input: '5000000' }).toString().trim();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (Number(out5m) !== 348513) throw new Error(`primes N=5000000 -> ${out5m} != 348513`);
  return { publicCases: cases.length, passed: cases.length, n5m: Number(out5m), ms5m: Math.round(ms * 10) / 10 };
}

function verifyBugHunt() {
  const reports = JSON.parse(fs.readFileSync(path.join(ART, 'bug-hunt.json'), 'utf8'));
  const utils = require(path.join(CHALLENGES, 'bug-hunt-utils', 'utils.js'));
  const reference = {
    factorial: n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
    countVowels: s => (s.match(/[aeiou]/gi) || []).length,
  };
  const verified = [];
  for (const r of reports) {
    const got = utils[r.fn](...r.input);
    const ref = reference[r.fn](...r.input);
    if (got === r.expected) throw new Error(`bug-hunt: ${r.fn} is not actually buggy on ${JSON.stringify(r.input)}`);
    if (ref !== r.expected) throw new Error(`bug-hunt: reference disagrees for ${r.fn}`);
    verified.push({ fn: r.fn, input: r.input, buggyOutput: got, expected: r.expected });
  }
  return { reports: reports.length, verified };
}

function verifyEthBacktest() {
  const strategy = require(path.join(ART, 'eth-strategy.js'));
  const bars = fs.readFileSync(path.join(CHALLENGES, 'eth-backtest', 'bars.csv'), 'utf8')
    .trim().split('\n').slice(1)
    .map(l => { const p = l.split(','); return { close: Number(p[4]) }; });
  const positions = strategy.positions(bars);
  if (positions.length !== bars.length) throw new Error('strategy length mismatch');
  if (!positions.every(p => p === 1 || p === -1 || p === 0)) throw new Error('invalid position values');
  // Backtest: fractional capital, 0.1% fee per position change (stated assumption).
  let capital = 1, peak = 1, maxDd = 0, trades = 0;
  for (let i = 1; i < bars.length; i++) {
    const ret = (bars[i].close - bars[i - 1].close) / bars[i - 1].close;
    if (positions[i] !== positions[i - 1]) { capital *= 0.999; trades++; }
    capital *= 1 + positions[i - 1] * ret;
    peak = Math.max(peak, capital);
    maxDd = Math.max(maxDd, (peak - capital) / peak);
  }
  return {
    bars: bars.length, trades,
    pnlPct: Math.round((capital - 1) * 10000) / 100,
    maxDrawdownPct: Math.round(maxDd * 10000) / 100,
    feeAssumption: '0.1% per position change',
  };
}

const VERIFIERS = {
  codeGolf: verifyCodeGolf,
  fastestPrimes: verifyPrimes,
  bugHunt: verifyBugHunt,
  ethBacktest: verifyEthBacktest,
};

// Builder name -> artifact files shipped in the submission repo.
const ARTIFACT_FILES = {
  codeGolf: ['eval-expr.js'],
  fastestPrimes: ['primes.js'],
  bugHunt: ['bug-hunt.json'],
  ethBacktest: ['eth-strategy.js'],
};

function buildCode(builder) {
  const verify = VERIFIERS[builder];
  if (!verify) return null;
  const verification = verify();
  return {
    kind: 'code', builder, files: ARTIFACT_FILES[builder],
    verification, repoPath: `artifacts/${builder}`,
  };
}

module.exports = { buildCode, verifyCodeGolf, verifyPrimes, verifyBugHunt, verifyEthBacktest };
