'use strict';
// Content builders. Artifacts are produced by this repo (article) or reused
// from sibling work in this workspace (meme — built for make-meme-aiprove by
// the same team; provenance noted in the artifact's sidecar JSON).
const fs = require('node:fs');
const path = require('node:path');

const ART = path.join(__dirname, '..', '..', 'artifacts');

function buildContent(builder) {
  if (builder === 'article') {
    const file = path.join(ART, 'article.md');
    const text = fs.readFileSync(file, 'utf8');
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words < 400) throw new Error(`article too short: ${words} words`);
    return { kind: 'content', builder, files: ['article.md'], verification: { words } };
  }
  if (builder === 'meme') {
    const file = path.join(ART, 'meme-final.png');
    const stat = fs.statSync(file);
    if (stat.size < 10000) throw new Error('meme file suspiciously small');
    return { kind: 'content', builder, files: ['meme-final.png'], verification: { bytes: stat.size } };
  }
  return null;
}

module.exports = { buildContent };
