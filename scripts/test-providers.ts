/**
 * Provider test script
 * Usage: npx tsx scripts/test-providers.ts [query] [location]
 * Example: npx tsx scripts/test-providers.ts "AI" "Milan"
 */

import lumaProvider from "../src/sources/luma.js";
import meetupProvider from "../src/sources/meetup.js";
import ticketmasterProvider from "../src/sources/ticketmaster.js";
import linkedinProvider from "../src/sources/linkedin.js";
import tickadooProvider from "../src/sources/tickadoo.js";
import demoProvider from "../src/sources/stubs/demo.js";
import { fetchEnrichmentMap, predicthqEnrichmentEnabled } from "../src/enrichment/predicthq.js";

const providers = [
  lumaProvider,
  meetupProvider,
  ticketmasterProvider,
  linkedinProvider,
  tickadooProvider,
  demoProvider,
];

const query = process.argv[2] ?? "AI";
const location = process.argv[3] ?? "Milan";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";

console.log(`\n${BOLD}Event Provider Test${RESET}`);
console.log(`${DIM}query: "${query}"  location: "${location}"${RESET}\n`);

for (const provider of providers) {
  const label = `[${provider.name}]`.padEnd(16);

  if (!provider.enabled) {
    console.log(`${YELLOW}${label}${RESET} ${DIM}skipped — no credentials configured${RESET}`);
    continue;
  }

  const start = Date.now();
  try {
    const results = await provider.search(query, location);
    const ms = Date.now() - start;

    if (results.length === 0) {
      console.log(`${YELLOW}${label}${RESET} ${DIM}0 results (${ms}ms)${RESET}`);
      continue;
    }

    console.log(`${GREEN}${label}${RESET} ${BOLD}${results.length} result${results.length === 1 ? "" : "s"}${RESET} ${DIM}(${ms}ms)${RESET}`);

    for (const [i, e] of results.entries()) {
      console.log(`  ${DIM}${String(i + 1).padStart(2)}.${RESET} ${BOLD}${e.title ?? "—"}${RESET}`);
      console.log(`      ${DIM}${e.date ?? "—"} · ${e.location ?? "—"} · ${e.price ?? "—"}${e.priceAmount != null ? ` (${e.priceAmount} ${e.currency ?? ""})` : ""} · ${e.topics?.join(", ") || "no topics"}${RESET}`);
      if (e.url) console.log(`      ${CYAN}${e.url}${RESET}`);
    }
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`${RED}${label}${RESET} ${RED}error${RESET} ${DIM}(${ms}ms)${RESET} — ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log();
}

// ─── Enrichment ──────────────────────────────────────────────────────────────
const enrichLabel = "[predicthq]".padEnd(16);
if (!predicthqEnrichmentEnabled) {
  console.log(`${YELLOW}${enrichLabel}${RESET} ${DIM}enrichment skipped — no credentials configured${RESET}`);
} else {
  const start = Date.now();
  try {
    const map = await fetchEnrichmentMap(query, location);
    const ms = Date.now() - start;
    if (map.size === 0) {
      console.log(`${YELLOW}${enrichLabel}${RESET} ${DIM}0 enrichment matches (${ms}ms)${RESET}`);
    } else {
      console.log(`${GREEN}${enrichLabel}${RESET} ${BOLD}${map.size} enrichment signal${map.size === 1 ? "" : "s"}${RESET} ${DIM}(${ms}ms)${RESET}`);
      const [title, data] = [...map.entries()][0];
      console.log(`  ${CYAN}sample${RESET}   "${title}"`);
      if (data.phqRank != null)       console.log(`  ${CYAN}rank${RESET}     ${data.phqRank}`);
      if (data.phqAttendance != null) console.log(`  ${CYAN}attendance${RESET} ~${data.phqAttendance.toLocaleString()}`);
    }
  } catch (err) {
    console.log(`${RED}${enrichLabel}${RESET} ${RED}error${RESET} — ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log();
}
