'use strict';
// Identity: the agent's own keypair. The key is NEVER read from disk and
// NEVER hardcoded. It comes from AGENT_PRIVATE_KEY (operator-supplied) or is
// freshly generated for this run (ephemeral test identity). It never reads
// a key from disk and never hardcodes one; the sibling auth script in the
// parent folder reads an operator key file, and this entry deliberately does
// NOT do that and must never be changed to do so.
const { Wallet } = require('ethers');

function loadIdentity() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (pk) {
    const w = new Wallet(pk.trim());
    return { wallet: w, address: w.address, ephemeral: false };
  }
  const w = Wallet.createRandom();
  return { wallet: w, address: w.address, ephemeral: true };
}

module.exports = { loadIdentity };
