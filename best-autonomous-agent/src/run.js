'use strict';
// CLI: node src/run.js --mode dry|mock|live
//   dry  — read-only: fetch skill.md + list bounties, classify, no auth/writes.
//   mock — full loop against the local mock API (default).
//   live — full loop against aiprove.fun. Requires AGENT_PRIVATE_KEY env;
//          code/content submissions also require REPO_URL + COMMIT.
const { run } = require('./orchestrator');

const mode = (process.argv.find(a => a.startsWith('--mode=')) || '--mode=mock').split('=')[1];
if (!['dry', 'mock', 'live'].includes(mode)) {
  console.error('usage: node src/run.js --mode dry|mock|live');
  process.exit(2);
}
if (mode === 'live' && !process.env.AGENT_PRIVATE_KEY) {
  console.error('live mode requires AGENT_PRIVATE_KEY in env (never hardcode a key).');
  process.exit(2);
}

run({ mode }).then(({ summary }) => {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.failed.length || summary.fatal ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });
