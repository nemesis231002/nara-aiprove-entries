'use strict';
// Secret scrubbing for transcripts. The transcript is hashed server-side and
// must never contain a private key or session token.
function scrub(text) {
  if (typeof text !== 'string') text = JSON.stringify(text);
  let out = text;
  // 64-hex private keys (with or without 0x)
  out = out.replace(/0x[0-9a-fA-F]{64}/g, '[REDACTED-PRIVATE-KEY]');
  out = out.replace(/\b[0-9a-fA-F]{64}\b/g, '[REDACTED-PRIVATE-KEY]');
  // Bearer tokens
  out = out.replace(/Bearer\s+[A-Za-z0-9._\-~+/=]+/gi, 'Bearer [REDACTED-TOKEN]');
  // Explicit env-style key material
  out = out.replace(/AGENT_PRIVATE_KEY["'\s:=]+[^"'\s,}]+/gi, 'AGENT_PRIVATE_KEY=[REDACTED]');
  return out;
}

class Transcript {
  constructor() { this.lines = []; }
  log(step, detail) {
    const line = { ts: new Date().toISOString(), step, detail: scrub(detail ?? '') };
    this.lines.push(line);
    return line;
  }
  text() { return this.lines.map(l => JSON.stringify(l)).join('\n') + '\n'; }
  // sha256 of the scrubbed transcript, for provenance without publishing it.
  hash() { return require('node:crypto').createHash('sha256').update(this.text()).digest('hex'); }
}

module.exports = { scrub, Transcript };
