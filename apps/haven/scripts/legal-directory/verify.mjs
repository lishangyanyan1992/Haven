// Stage 3 — verify each firm against the relevant state bar.
//
//   node verify.mjs
//
// Reads work/02-enriched.json, writes work/03-verified.json.
//
// State bar sites vary wildly (different forms, some with CAPTCHAs / JS-only UIs),
// so this stage is adapter-based: each state plugs in its own lookup. Where a
// state has no reliable programmatic lookup, the firm is flagged
// `needsManualVerify: true` instead of failing — a human confirms it before it
// ships. We verify by FIRM here; for solo firms the firm name often == attorney
// name. For multi-attorney firms, confirm at least one licensed attorney.

import { readFile, writeFile } from "node:fs/promises";

import { WORK_DIR, sleep } from "./config.mjs";
import { ca } from "./adapters/calbar.mjs";

// Each adapter returns { barNumber, status, noDiscipline } or null if not found.
// Implement these incrementally — start with the metros you seed first.
const adapters = {
  // California — parses the CalBar licensee detail page (keyed on bar number,
  // captured by enrich.mjs from the firm's own site). See adapters/calbar.mjs.
  CA: ca,
  // New York — OCA attorney search: https://iapps.courts.state.ny.us/attorneyservices/search
  NY: async (_firm) => null,
  // Washington — WSBA legal directory: https://www.mywsba.org/PersonifyEbusiness/LegalDirectory
  WA: async (_firm) => null,
  // Add MA, TX, IL, DC, GA, ... as you expand coverage.
};

async function main() {
  const firms = JSON.parse(await readFile(`${WORK_DIR}/02-enriched.json`, "utf8"));
  const out = [];

  for (const firm of firms) {
    const adapter = adapters[firm.state];
    let barVerified = null;
    let needsManualVerify = true;

    if (adapter) {
      try {
        const result = await adapter(firm);
        if (result) {
          barVerified = { state: firm.state, ...result };
          needsManualVerify = false;
        }
        await sleep(800);
      } catch (error) {
        console.warn(`Verify failed for ${firm.firmName} (${firm.state}): ${error.message}`);
      }
    }

    out.push({ ...firm, barVerified, needsManualVerify });
    console.log(`${barVerified ? "✓ verified" : "… needs manual verify"}: ${firm.firmName} (${firm.state})`);
  }

  await writeFile(`${WORK_DIR}/03-verified.json`, JSON.stringify(out, null, 2));
  const verified = out.filter((f) => f.barVerified).length;
  console.log(`Verified ${verified}/${out.length} automatically -> work/03-verified.json`);
  console.log("Manually confirm any `needsManualVerify: true` firms, then set their barVerified field before building.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
