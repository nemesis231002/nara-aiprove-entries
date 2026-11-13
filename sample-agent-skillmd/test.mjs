#!/usr/bin/env node
/**
 * End-to-end test for the sample AIProve agent — MOCK ONLY, no live calls.
 *
 * 1. Starts mock-server.mjs on an ephemeral port.
 * 2. Runs agent.mjs against the mock with NO private key (fresh-keypair path).
 *    Asserts exit 0 and that the output shows: skill.md read, authenticated,
 *    open bounties listed (incl. sample-agent-skillmd), entered sample-agent-skillmd.
 * 3. Runs agent.mjs again with an ephemeral AGENT_PRIVATE_KEY generated in
 *    this process (never written to disk) — asserts the env-key path also works
 *    and uses the expected address.
 * 4. Negative checks against the mock directly:
 *      - verify with a signature from a DIFFERENT wallet -> 401
 *      - enter without a Bearer token -> 401
 *      - enter with a bogus token -> 401
 * 5. Kills the mock. Exits 0 only if every assertion passed.
 *
 * Run: node test.mjs   (or: npm test)
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { Wallet } = require("ethers");

const dir = path.dirname(fileURLToPath(import.meta.url));
let failures = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
}

function run(cmd, args, env, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env }, cwd: dir });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, out, err });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, out, err: String(e) });
    });
  });
}

async function waitForHealth(base, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

async function main() {
  // --- Start mock on ephemeral port (0) ---
  const mock = spawn("node", ["mock-server.mjs", "0"], { cwd: dir });
  let mockBase = null;
  const mockOut = await new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error("mock did not print base URL")), 10000);
    mock.stdout.on("data", (d) => {
      buf += d;
      const m = /MOCK_AIPROVE_BASE_URL=(http:\/\/127\.0\.0\.1:\d+)/.exec(buf);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    mock.stderr.on("data", (d) => (buf += d));
    mock.on("error", reject);
  }).catch((e) => {
    mock.kill();
    throw e;
  });
  mockBase = mockOut;
  check("mock server starts", !!mockBase, mockBase);
  check("mock /api/health", await waitForHealth(mockBase));

  // --- Test 1: fresh random keypair (no AGENT_PRIVATE_KEY) ---
  const r1 = await run("node", ["agent.mjs"], { API_BASE_URL: mockBase });
  console.log("--- agent run 1 (fresh keypair) output ---");
  console.log(r1.out + r1.err);
  console.log("--- end output ---");
  check("agent exits 0 (fresh keypair)", r1.code === 0, `exit=${r1.code}`);
  check("agent reads skill.md", r1.out.includes("Read skill.md from"));
  check("agent authenticates", r1.out.includes("Authenticated: address=0x"));
  check("agent lists open bounties", r1.out.includes("Open bounties (2):"));
  check("agent lists sample-agent-skillmd", r1.out.includes("sample-agent-skillmd"));
  check("agent enters sample-agent-skillmd", r1.out.includes("Entered:") && r1.out.includes('"slug": "sample-agent-skillmd"'));
  check("agent prints LOOP COMPLETE", r1.out.includes("LOOP COMPLETE"));

  // --- Test 2: supplied AGENT_PRIVATE_KEY (ephemeral, generated here, never saved) ---
  const testWallet = Wallet.createRandom();
  const r2 = await run("node", ["agent.mjs"], {
    API_BASE_URL: mockBase,
    AGENT_PRIVATE_KEY: testWallet.privateKey,
  });
  check("agent exits 0 (env key)", r2.code === 0, `exit=${r2.code}`);
  check("agent uses supplied key address", r2.out.includes(`address=${testWallet.address}`));
  check("agent does not leak private key", !r2.out.includes(testWallet.privateKey.slice(2, 20)) && !r2.out.includes("privateKey"));

  // --- Test 3: negative checks (direct mock calls) ---
  const victim = Wallet.createRandom();
  const attacker = Wallet.createRandom();
  const ch = await (await fetch(`${mockBase}/api/auth/challenge?address=${victim.address}`)).json();
  const wrongSig = await attacker.signMessage(ch.challenge);
  const badVerify = await fetch(`${mockBase}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: victim.address, signature: wrongSig }),
  });
  check("verify rejects wrong-signer signature (401)", badVerify.status === 401, `status=${badVerify.status}`);

  const noAuth = await fetch(`${mockBase}/api/bounties/sample-agent-skillmd/enter`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "nara.agent" }),
  });
  check("enter rejects missing token (401)", noAuth.status === 401, `status=${noAuth.status}`);

  const bogus = await fetch(`${mockBase}/api/bounties/sample-agent-skillmd/enter`, {
    method: "POST",
    headers: { Authorization: "Bearer bogus-token", "content-type": "application/json" },
    body: JSON.stringify({ handle: "nara.agent" }),
  });
  check("enter rejects bogus token (401)", bogus.status === 401, `status=${bogus.status}`);

  // --- Test 4: live-API guard (no network call should be made) ---
  const rLive = await run("node", ["agent.mjs"], { API_BASE_URL: "https://aiprove.fun" });
  check("live API refused without ALLOW_LIVE_API=1", rLive.code === 2 && rLive.err.includes("REFUSED"), `exit=${rLive.code}`);

  mock.kill();
  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("TEST HARNESS FAILED:", err);
  process.exit(1);
});
