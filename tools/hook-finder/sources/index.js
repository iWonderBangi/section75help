// Source adapter registry.
// Runs all applicable adapters for a candidate in sequence and merges their output.
//
// Merge rules (conservative by design):
//   - Array fields (verified_facts, unverified_signals, editorial_cautions):
//     always APPENDED — adapter output is added to existing content, never replaces it.
//   - source_confidence_score:
//     adapter _confidence_delta values are summed and added to the existing score.
//     The result is capped at 20 (the maximum for this dimension).
//   - Scalar fields (company_name, insolvency_type, insolvency_date, etc.):
//     the adapter value is used ONLY if the candidate field is currently missing,
//     null, or "unknown". Existing non-empty values are preserved.
//
// Adapter execution order:
//   1. Gazette adapter — if primary_source_url is a Gazette URL.
//   2. Companies House adapter — if company_number is present.
//
// Either adapter can be skipped via options: { skipGazette, skipCompaniesHouse }

import { enrichFromCompaniesHouse } from "./companies-house.js";
import { ingestFromUrl as gazetteFromUrl } from "./gazette.js";

const ARRAY_FIELDS = [
  "verified_facts",
  "api_confirmed_facts",
  "unverified_signals",
  "editorial_cautions",
];
const SCALAR_EMPTY = [null, undefined, "unknown", ""];

function isEmptyScalar(value) {
  return SCALAR_EMPTY.includes(value);
}

function mergeUpdates(candidate, updates) {
  const merged = { ...candidate };

  for (const [key, value] of Object.entries(updates)) {
    if (key === "_confidence_delta") continue; // handled separately

    if (ARRAY_FIELDS.includes(key)) {
      if (Array.isArray(value) && value.length > 0) {
        merged[key] = [...(merged[key] ?? []), ...value];
      }
    } else if (key === "source_confidence_score") {
      // Direct score override — used only if explicitly set by an adapter.
      // Prefer _confidence_delta instead; direct overrides are unusual.
      merged[key] = Math.min(value, 20);
    } else if (!isEmptyScalar(value) && isEmptyScalar(merged[key])) {
      // Scalar: only fill in if the field is currently empty/unknown.
      merged[key] = value;
    }
    // If the candidate already has a non-empty scalar, the adapter value is discarded.
  }

  // Apply confidence delta from this adapter.
  if (updates._confidence_delta) {
    const current = merged.source_confidence_score ?? 0;
    merged.source_confidence_score = Math.min(
      current + updates._confidence_delta,
      20
    );
  }

  return merged;
}

// Enrich a single candidate by running all applicable adapters.
// Returns { candidate, warnings } — candidate is the fully enriched object.
export async function enrichCandidate(candidate, options = {}) {
  let current = { ...candidate };
  const warnings = [];

  // 1. Gazette adapter — run when primary_source_url points to the Gazette.
  if (
    !options.skipGazette &&
    current.primary_source_url?.includes("thegazette.co.uk")
  ) {
    try {
      const result = await gazetteFromUrl(current.primary_source_url);
      if (result.warning) warnings.push(`[Gazette] ${result.warning}`);
      if (result.ingested || Object.keys(result.updates).length > 0) {
        current = mergeUpdates(current, result.updates);
        if (result.confidenceDelta) {
          current.source_confidence_score = Math.min(
            (current.source_confidence_score ?? 0) + result.confidenceDelta,
            20
          );
        }
      }
    } catch (err) {
      warnings.push(`[Gazette] Unexpected error: ${err.message}`);
    }
  }

  // 2. Companies House adapter — run when company_number is present.
  if (!options.skipCompaniesHouse && current.company_number) {
    try {
      const result = await enrichFromCompaniesHouse(current);
      if (result.warning) warnings.push(`[Companies House] ${result.warning}`);
      if (result.enriched) {
        current = mergeUpdates(current, result.updates);
      }
    } catch (err) {
      warnings.push(`[Companies House] ${err.message}`);
    }
  }

  current.updated_at = new Date().toISOString();

  return { candidate: current, warnings };
}

// Enrich an array of candidates, logging progress to stdout.
export async function enrichCandidates(candidates, options = {}) {
  const results = [];

  for (const candidate of candidates) {
    const name =
      candidate.trading_name ??
      candidate.company_name ??
      candidate.company_number ??
      "unknown";

    process.stdout.write(`  Enriching: ${name.padEnd(32)} `);

    const { candidate: enriched, warnings } = await enrichCandidate(
      candidate,
      options
    );

    if (warnings.length > 0) {
      console.log(`done (${warnings.length} warning(s))`);
      warnings.forEach((w) => console.warn(`    ! ${w}`));
    } else {
      console.log("done");
    }

    results.push(enriched);
  }

  return results;
}
