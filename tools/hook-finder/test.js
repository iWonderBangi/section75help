#!/usr/bin/env node
// Hook Finder — adapter-level test checks.
// No test framework required. Uses Node's built-in assert module.
//
// Usage: node tools/hook-finder/test.js
//        npm run hook-finder:test
//
// Tests are organised into groups. Each test prints PASS or FAIL with a label.
// A final summary shows total counts. Any FAIL exits with code 1.
//
// For network-dependent adapter tests, globalThis.fetch and process.env are
// temporarily overridden and always restored, even if the test throws.

import assert from "assert/strict";

import { validateCandidate, validateCandidates } from "./validate.js";
import { detectDuplicates } from "./dedup.js";
import { scoreCandidate } from "./scorer.js";
import { ingestFromFixture, ingestFromUrl } from "./sources/gazette.js";
import { enrichFromCompaniesHouse } from "./sources/companies-house.js";
import { enrichCandidate } from "./sources/index.js";

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${label}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

async function testAsync(label, fn) {
  try {
    await fn();
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${label}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

// Temporarily override globalThis.fetch, running fn, then restore.
async function withMockFetch(mockFn, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mockFn;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

// Temporarily set environment variables, then restore.
async function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// Minimal valid candidate used as a base in many tests.
const BASE_CANDIDATE = {
  company_number: "09876543",
  company_name: "Example Furniture Ltd",
  trading_name: "Example Furniture",
  sector: "furniture-retail",
  source_confidence_score: 5,
  b2c_fit_score: 20,
  consumer_loss_score: 18,
  search_demand_score: 12,
  commercial_fit_score: 7,
  verified_facts: [],
  api_confirmed_facts: [],
  unverified_signals: [],
  editorial_cautions: [],
};

// ─── Group 1: Validation ─────────────────────────────────────────────────────

console.log("\nGroup 1: Validation");

test("valid candidate passes through", () => {
  const { valid, errors } = validateCandidate({ ...BASE_CANDIDATE });
  assert.equal(valid, true);
  assert.equal(errors.length, 0);
});

test("missing sector → error, candidate skipped", () => {
  const { valid, errors } = validateCandidate({
    ...BASE_CANDIDATE,
    sector: undefined,
  });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("sector")));
});

test("missing all identifiers → error, candidate skipped", () => {
  const { valid, errors } = validateCandidate({
    sector: "furniture-retail",
    source_confidence_score: 5,
    b2c_fit_score: 10,
    consumer_loss_score: 10,
    search_demand_score: 5,
    commercial_fit_score: 3,
  });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("identifier")));
});

test("missing company_number → warning, ambiguous_company = true", () => {
  const { valid, warnings, candidate } = validateCandidate({
    ...BASE_CANDIDATE,
    company_number: undefined,
  });
  assert.equal(valid, true);
  assert.ok(warnings.some((w) => w.includes("company_number")));
  assert.equal(candidate.ambiguous_company, true);
});

test("generic company name → warning, ambiguous_company = true", () => {
  const { valid, warnings, candidate } = validateCandidate({
    ...BASE_CANDIDATE,
    company_name: "Limited",
    trading_name: "Ltd",
  });
  assert.equal(valid, true);
  assert.ok(warnings.some((w) => w.includes("generic")));
  assert.equal(candidate.ambiguous_company, true);
});

test("score above max → clamped with warning", () => {
  const { valid, warnings, candidate } = validateCandidate({
    ...BASE_CANDIDATE,
    b2c_fit_score: 999,
  });
  assert.equal(valid, true);
  assert.ok(warnings.some((w) => w.includes("b2c_fit_score")));
  assert.equal(candidate.b2c_fit_score, 25);
});

test("score below 0 → clamped to 0 with warning", () => {
  const { valid, warnings, candidate } = validateCandidate({
    ...BASE_CANDIDATE,
    consumer_loss_score: -5,
  });
  assert.equal(valid, true);
  assert.ok(warnings.some((w) => w.includes("consumer_loss_score")));
  assert.equal(candidate.consumer_loss_score, 0);
});

test("non-numeric score → defaulted to 0 with warning", () => {
  const { valid, warnings, candidate } = validateCandidate({
    ...BASE_CANDIDATE,
    search_demand_score: "lots",
  });
  assert.equal(valid, true);
  assert.ok(warnings.some((w) => w.includes("search_demand_score")));
  assert.equal(candidate.search_demand_score, 0);
});

test("validateCandidates drops invalid, keeps valid", () => {
  const input = [
    { ...BASE_CANDIDATE },
    { sector: "furniture-retail" }, // missing identifier → dropped
  ];
  const result = validateCandidates(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].trading_name, "Example Furniture");
});

// ─── Group 2: Scoring edge cases ─────────────────────────────────────────────

console.log("\nGroup 2: Scoring");

test("high total score but low confidence → monitoring, not needs_review", () => {
  const candidate = {
    ...BASE_CANDIDATE,
    b2c_fit_score: 24,
    consumer_loss_score: 23,
    search_demand_score: 17,
    source_confidence_score: 5, // below LOW_CONFIDENCE_THRESHOLD (10)
    commercial_fit_score: 9,
  };
  const scored = scoreCandidate(candidate);
  assert.equal(scored.status, "monitoring");
  assert.equal(scored.risk_level, "high");
});

test("score >= 80 with confidence >= 10 → needs_review", () => {
  const candidate = {
    ...BASE_CANDIDATE,
    b2c_fit_score: 24,
    consumer_loss_score: 23,
    search_demand_score: 17,
    source_confidence_score: 15,
    commercial_fit_score: 9,
  };
  const scored = scoreCandidate(candidate);
  assert.equal(scored.status, "needs_review");
});

test("total score < 60 → rejected regardless of confidence", () => {
  const candidate = {
    ...BASE_CANDIDATE,
    b2c_fit_score: 4,
    consumer_loss_score: 3,
    search_demand_score: 2,
    source_confidence_score: 17,
    commercial_fit_score: 1,
  };
  const scored = scoreCandidate(candidate);
  assert.equal(scored.status, "rejected");
});

// ─── Group 3: Duplicate detection ────────────────────────────────────────────

console.log("\nGroup 3: Duplicate detection");

test("same company_number → merged, log records action", () => {
  const c1 = { ...BASE_CANDIDATE, company_number: "11111111", b2c_fit_score: 10 };
  const c2 = { ...BASE_CANDIDATE, company_number: "11111111", b2c_fit_score: 20 };
  const { candidates, log } = detectDuplicates([c1, c2]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].b2c_fit_score, 20); // higher score wins
  assert.ok(log.some((l) => l.action === "merged"));
});

test("same URL, different company_number → both kept, later flagged", () => {
  const url = "https://www.thegazette.co.uk/notice/abc";
  const c1 = { ...BASE_CANDIDATE, company_number: "11111111", primary_source_url: url };
  const c2 = { ...BASE_CANDIDATE, company_number: "22222222", primary_source_url: url };
  const { candidates, log } = detectDuplicates([c1, c2]);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[1].ambiguous_company, true);
  assert.ok(log.some((l) => l.action === "flagged"));
});

test("no duplicates → all candidates pass through unchanged", () => {
  const c1 = { ...BASE_CANDIDATE, company_number: "11111111" };
  const c2 = { ...BASE_CANDIDATE, company_number: "22222222" };
  const { candidates, log } = detectDuplicates([c1, c2]);
  assert.equal(candidates.length, 2);
  assert.equal(log.length, 0);
});

// ─── Group 4: Gazette fixture ingestion ──────────────────────────────────────

console.log("\nGroup 4: Gazette fixture");

test("valid fixture → ingested, verified_facts populated", () => {
  const fixture = {
    notice_url: "https://www.thegazette.co.uk/notice/99999999",
    company_name: "Test Retailer Ltd",
    company_number: "09999999",
    notice_date: "2026-04-01",
    notice_type: "Appointment of Administrator",
    practitioners: [{ name: "Jane Smith", role: "administrator" }],
  };
  const result = ingestFromFixture(fixture);
  assert.equal(result.ingested, true);
  assert.ok(result.updates.verified_facts.some((f) => f.includes("Test Retailer Ltd")));
  assert.ok(result.updates.verified_facts.some((f) => f.includes("Jane Smith")));
  assert.equal(result.updates.insolvency_type, "administration");
  assert.ok(result.confidenceDelta >= 10);
});

test("empty fixture object → ingested false, warning", () => {
  const result = ingestFromFixture({});
  assert.equal(result.ingested, false);
  assert.ok(result.warning);
});

test("null fixture → ingested false, warning", () => {
  const result = ingestFromFixture(null);
  assert.equal(result.ingested, false);
  assert.ok(result.warning);
});

// ─── Group 5: Gazette URL adapter ────────────────────────────────────────────

console.log("\nGroup 5: Gazette URL adapter");

await testAsync("Gazette URL returns 200 → ingested, unverified_signals populated", async () => {
  const mockFetch = async () => ({ status: 200, ok: true });
  const url = "https://www.thegazette.co.uk/notice/12345678";
  const result = await withMockFetch(mockFetch, () => ingestFromUrl(url));
  assert.equal(result.ingested, true);
  assert.ok(result.warning?.includes("not parsed"));
  assert.ok(result.updates.unverified_signals?.some((s) => s.includes("12345678")));
  assert.equal(result.confidenceDelta, 3);
});

await testAsync("Gazette URL returns 404 → ingested false, clear warning", async () => {
  const mockFetch = async () => ({ status: 404, ok: false });
  const url = "https://www.thegazette.co.uk/notice/00000000";
  const result = await withMockFetch(mockFetch, () => ingestFromUrl(url));
  assert.equal(result.ingested, false);
  assert.ok(result.warning?.includes("404"));
  assert.equal(result.confidenceDelta, 0);
});

await testAsync("Gazette URL network error → ingested false, warning", async () => {
  const mockFetch = async () => { throw new Error("ECONNREFUSED"); };
  const url = "https://www.thegazette.co.uk/notice/12345678";
  const result = await withMockFetch(mockFetch, () => ingestFromUrl(url));
  assert.equal(result.ingested, false);
  assert.ok(result.warning?.includes("ECONNREFUSED"));
  assert.equal(result.confidenceDelta, 1);
});

await testAsync("Non-Gazette URL → ingested false, warning about wrong URL", async () => {
  const result = await ingestFromUrl("https://www.bbc.co.uk/news/example");
  assert.equal(result.ingested, false);
  assert.ok(result.warning?.includes("does not appear to be a Gazette notice"));
});

// ─── Group 6: Companies House adapter ────────────────────────────────────────

console.log("\nGroup 6: Companies House adapter");

await testAsync("missing API key → enrichCandidate captures warning, no crash", async () => {
  const { warnings } = await withEnv(
    { COMPANIES_HOUSE_API_KEY: undefined },
    () => enrichCandidate({ ...BASE_CANDIDATE }, { skipGazette: true })
  );
  assert.ok(
    warnings.some((w) => w.includes("COMPANIES_HOUSE_API_KEY")),
    "Expected missing key warning"
  );
});

await testAsync("CH company 404 → enriched false, warning about number", async () => {
  const mockFetch = async () => ({ status: 404, ok: false });
  const result = await withEnv(
    { COMPANIES_HOUSE_API_KEY: "test-key" },
    () => withMockFetch(mockFetch, () => enrichFromCompaniesHouse({ ...BASE_CANDIDATE }))
  );
  assert.equal(result.enriched, false);
  assert.ok(result.warning?.includes("No record found"));
});

await testAsync("CH company found, no insolvency record → enriched true, unverified signal", async () => {
  const mockFetch = async (url) => {
    if (url.includes("/insolvency")) return { status: 404, ok: false };
    return {
      status: 200,
      ok: true,
      json: async () => ({
        company_name: "Example Furniture Ltd",
        company_status: "active",
        registered_office_address: { locality: "London", postal_code: "EC1A 1BB" },
      }),
    };
  };
  const result = await withEnv(
    { COMPANIES_HOUSE_API_KEY: "test-key" },
    () => withMockFetch(mockFetch, () => enrichFromCompaniesHouse({ ...BASE_CANDIDATE }))
  );
  assert.equal(result.enriched, true);
  assert.ok(result.updates.api_confirmed_facts?.some((f) => f.includes("Example Furniture Ltd")));
  assert.ok(
    result.updates.unverified_signals?.some((s) =>
      s.includes("No insolvency case found")
    )
  );
});

await testAsync("CH company found with insolvency → api_confirmed_facts populated", async () => {
  const mockFetch = async (url) => {
    if (url.includes("/insolvency")) {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          cases: [
            {
              type: "administration-order",
              practitioners: [
                {
                  name: "Jane Smith",
                  role: "administrator",
                  appointed_on: "2026-04-25",
                },
              ],
            },
          ],
        }),
      };
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({
        company_name: "Example Furniture Ltd",
        company_status: "administration",
        registered_office_address: {},
      }),
    };
  };
  const result = await withEnv(
    { COMPANIES_HOUSE_API_KEY: "test-key" },
    () => withMockFetch(mockFetch, () => enrichFromCompaniesHouse({ ...BASE_CANDIDATE }))
  );
  assert.equal(result.enriched, true);
  assert.ok(result.updates.api_confirmed_facts?.some((f) => f.includes("Jane Smith")));
  assert.equal(result.updates.insolvency_type, "administration");
  assert.equal(result.updates.insolvency_date, "2026-04-25");
  assert.ok((result.updates._confidence_delta ?? 0) >= 14); // 6 (company) + 8 (insolvency)
});

// ─── Group 7: End-to-end monitoring gate ─────────────────────────────────────

console.log("\nGroup 7: End-to-end monitoring gate");

test("candidate with source_confidence < 10 stays monitoring even at high total score", () => {
  const candidate = {
    ...BASE_CANDIDATE,
    b2c_fit_score: 24,
    consumer_loss_score: 23,
    search_demand_score: 17,
    source_confidence_score: 9, // just below threshold
    commercial_fit_score: 9,
  };
  const scored = scoreCandidate(candidate);
  assert.equal(scored.status, "monitoring",
    `Expected monitoring but got ${scored.status} (total: ${scored.total_score})`);
});

test("ambiguous_company candidate does not auto-promote to needs_review via score alone", () => {
  const { candidate: validated } = validateCandidate({
    ...BASE_CANDIDATE,
    company_number: undefined, // triggers ambiguous_company
    b2c_fit_score: 24,
    consumer_loss_score: 23,
    search_demand_score: 17,
    source_confidence_score: 5, // low confidence because no company_number
    commercial_fit_score: 9,
  });
  const scored = scoreCandidate(validated);
  // Low confidence overrides high total score
  assert.ok(
    scored.status !== "needs_review",
    `Expected monitoring or rejected but got ${scored.status}`
  );
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`  ${passed} passed   ${failed} failed   ${passed + failed} total`);
console.log("─".repeat(50));

if (failed > 0) {
  process.exit(1);
}
