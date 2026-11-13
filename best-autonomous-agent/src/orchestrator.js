'use strict';
// Orchestrator: the full autonomous loop.
//   read skill.md -> sign in with own keypair -> list open bounties ->
//   classify -> build each feasible bounty -> enter -> submit ->
//   write scrubbed provenance transcript + summary.
// Modes:
//   dry  — GETs only (fetch skill.md + list bounties), no auth, no writes.
//   mock — full loop against the local mock API (default; safe).
//   live — full loop against API_BASE_URL (default https://aiprove.fun).
//          Requires AGENT_PRIVATE_KEY in env. Code/content submissions
//          additionally require REPO_URL + COMMIT (a real pushed repo);
//          without them those bounties are skipped, never faked.
const fs = require('node:fs');
const path = require('node:path');
const client = require('./client');
const { loadIdentity } = require('./auth');
const { Transcript } = require('./transcript');
const { classifyAll } = require('./classify');
const { buildForecast } = require('./builders/forecast');
const { buildCode } = require('./builders/code');
const { buildContent } = require('./builders/content');

const HANDLE = process.env.AGENT_HANDLE || 'nara.agent';
const OUT = path.join(__dirname, '..', 'out');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run({ mode = 'mock', priceApi = null } = {}) {
  const t = new Transcript();
  const summary = {
    mode, startedAt: new Date().toISOString(), address: null, ephemeralKey: null,
    skillMdRead: false, entered: [], submitted: [], skipped: [], failed: [],
  };
  const log = (step, detail) => { t.log(step, detail); };

  let api = client;
  let mockServer = null;
  if (mode === 'mock') {
    const { startMockServer } = require('../mock/mock-server');
    mockServer = await startMockServer(0);
    process.env.API_BASE_URL = mockServer.baseUrl;
    // Re-require client so BASE picks up the mock URL (client reads env at load;
    // BASE is a const, so instead patch via module override below).
    api = require('./client-mock-shim')(mockServer.baseUrl);
  }

  try {
    // 1. Read skill.md (the brief's first step).
    const skill = await api.fetchSkillMd();
    summary.skillMdRead = skill.includes('/api/bounties') && skill.includes('/api/auth/challenge');
    log('read-skill.md', `bytes=${skill.length} endpoints-present=${summary.skillMdRead}`);
    if (!summary.skillMdRead) throw new Error('skill.md did not contain the expected endpoints');

    // 2. Identity + auth (dry mode stops before this: no keypair, no writes).
    let token = null;
    if (mode !== 'dry') {
      const id = loadIdentity();
      summary.address = id.address;
      summary.ephemeralKey = id.ephemeral;
      log('identity', `address=${id.address} ephemeral=${id.ephemeral}`);
      token = await api.authenticate(id.wallet);
      log('auth', 'challenge signed, session token issued');
    }

    // 3. List + classify.
    const bounties = await api.listBounties();
    const { feasible, skipped } = classifyAll(bounties);
    log('list', `open=${bounties.length} feasible=${feasible.length} skipped=${skipped.length}`);
    for (const s of skipped) summary.skipped.push({ slug: s.slug, reason: s.reason });

    // 4. Build + enter + submit each feasible bounty.
    const repoUrl = process.env.REPO_URL || null;
    const commit = process.env.COMMIT || null;
    for (const b of feasible) {
      try {
        let payload = null;
        let built = null;
        if (b.kind === 'forecast') {
          built = await buildForecast(b.slug, priceApi || undefined);
          if (!built) { summary.skipped.push({ slug: b.slug, reason: 'no price data and no neutral fallback available' }); continue; }
          payload = { prediction: built.prediction, handle: HANDLE };
          log(`build:${b.slug}`, `forecast ${JSON.stringify(built.prediction)} meta=${JSON.stringify(built.meta)}`);
        } else {
          // code / content need a real repo@commit; refuse to fabricate one.
          if (!repoUrl || !commit) {
            summary.skipped.push({ slug: b.slug, reason: 'REPO_URL/COMMIT not set; will not submit a fabricated commit' });
            log(`skip:${b.slug}`, 'no real repo@commit available');
            continue;
          }
          built = b.kind === 'code' ? buildCode(b.builder) : buildContent(b.builder);
          if (!built) { summary.skipped.push({ slug: b.slug, reason: 'builder returned nothing' }); continue; }
          log(`build:${b.slug}`, `verified ${JSON.stringify(built.verification)} files=${built.files.join(',')}`);
          payload = { repoUrl, commit, transcript: t.text(), handle: HANDLE };
        }
        if (mode === 'dry') { summary.skipped.push({ slug: b.slug, reason: 'dry mode: no writes' }); continue; }
        await api.enter(token, b.slug, HANDLE);
        summary.entered.push(b.slug);
        log(`enter:${b.slug}`, 'entered');
        const res = await api.submit(token, b.slug, payload);
        summary.submitted.push({ slug: b.slug, submission: res.submissionId || res.id || 'ok' });
        log(`submit:${b.slug}`, `accepted submission=${res.submissionId || res.id || 'ok'}`);
        await sleep(150); // be a polite client; not a rate-limit dodge, just spacing
      } catch (e) {
        summary.failed.push({ slug: b.slug, error: String(e.message).slice(0, 300) });
        log(`fail:${b.slug}`, String(e.message).slice(0, 300));
      }
    }
  } catch (e) {
    summary.fatal = String(e.message).slice(0, 500);
    log('fatal', summary.fatal);
  } finally {
    if (mockServer) await mockServer.close();
  }

  summary.finishedAt = new Date().toISOString();
  summary.transcriptSha256 = t.hash();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'transcript.jsonl'), t.text());
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  return { summary, transcript: t.text() };
}

module.exports = { run, HANDLE };
