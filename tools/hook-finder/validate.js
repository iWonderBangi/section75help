// Input validation for live candidates.
// Runs before enrichment so invalid entries are skipped before any API call is made.
//
// A candidate that fails validation (errors) is dropped from the pipeline.
// A candidate with warnings proceeds but receives editorial cautions.
// Score fields that are out of range are clamped to their legal maximum and flagged.
//
// ambiguous_company is set to true when the company cannot be reliably identified:
//   - company_number is missing (cannot verify at Companies House)
//   - company name is generic, very short, or empty
//   - primary_source_url provides no identifying information

const KNOWN_SECTORS = new Set([
  "furniture-retail",
  "kitchen-installation",
  "travel",
  "wedding-venue",
  "gym-membership",
  "car-dealer",
  "electronics-retail",
  "holiday-park",
  "care-home",
  "b2b-software",
  "default",
]);

// Words that, when a company name consists solely of them, indicate
// the name is too generic to uniquely identify a company.
const GENERIC_WORDS = new Set([
  "limited", "ltd", "group", "holdings", "services", "solutions",
  "company", "enterprises", "international", "global", "uk", "the",
  "and", "plc", "llp", "lp", "co",
]);

export const SCORE_CAPS = {
  b2c_fit_score: 25,
  consumer_loss_score: 25,
  search_demand_score: 20,
  source_confidence_score: 20,
  commercial_fit_score: 10,
};

function isAmbiguousName(name) {
  if (!name || name.trim().length < 3) return true;
  const words = name
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => GENERIC_WORDS.has(w));
}

// Validates a single candidate.
// Returns { valid: boolean, warnings: string[], errors: string[], candidate }
// On failure (valid: false), candidate is the unmodified original.
// On success (valid: true), candidate has scores clamped and new fields applied.
export function validateCandidate(candidate) {
  const warnings = [];
  const errors = [];
  const addedCautions = [];
  let ambiguous_company = false;

  // --- Hard errors: skip this candidate entirely ---

  const hasIdentifier =
    candidate.company_number ||
    candidate.trading_name ||
    candidate.company_name;

  if (!hasIdentifier) {
    errors.push(
      "No identifier found. Candidate must have at least one of: " +
        "company_number, trading_name, company_name."
    );
  }

  if (!candidate.sector) {
    errors.push("sector is required for scoring.");
  }

  if (errors.length > 0) {
    return { valid: false, warnings, errors, candidate };
  }

  // --- Warnings: proceed but flag issues ---

  if (!KNOWN_SECTORS.has(candidate.sector)) {
    warnings.push(
      `sector "${candidate.sector}" is not in the known list. ` +
        "The briefer will use default sector templates."
    );
  }

  if (!candidate.company_number) {
    warnings.push(
      "No company_number — Companies House lookup will be skipped. " +
        "Company identity may be ambiguous."
    );
    addedCautions.push(
      "Company number is missing. Verify company identity manually before drafting."
    );
    ambiguous_company = true;
  }

  if (!candidate.primary_source_url) {
    warnings.push(
      "No primary_source_url — Gazette URL adapter will be skipped. " +
        "An official insolvency notice is required before publishing."
    );
    addedCautions.push(
      "No primary source URL provided. Do not publish without an official insolvency notice."
    );
  }

  const displayName = (candidate.trading_name ?? candidate.company_name ?? "").trim();
  if (isAmbiguousName(displayName)) {
    warnings.push(
      `Company name "${displayName || "(empty)"}" may be too generic or short to uniquely ` +
        "identify a company. Verify no other registered company shares this name."
    );
    addedCautions.push(
      "Company name may be ambiguous. Verify unique company identity before drafting."
    );
    ambiguous_company = true;
  }

  // --- Score clamping ---

  const clipped = { ...candidate };
  for (const [field, max] of Object.entries(SCORE_CAPS)) {
    const val = candidate[field];
    if (val === undefined || val === null) continue;
    if (typeof val !== "number" || isNaN(val)) {
      warnings.push(
        `${field} is not a number ("${val}") — defaulting to 0.`
      );
      clipped[field] = 0;
    } else if (val < 0) {
      warnings.push(`${field} is negative (${val}) — clamping to 0.`);
      clipped[field] = 0;
    } else if (val > max) {
      warnings.push(
        `${field} exceeds maximum (${val} > ${max}) — clamping to ${max}.`
      );
      clipped[field] = max;
    }
  }

  // --- Apply computed fields ---

  clipped.ambiguous_company = ambiguous_company;

  if (addedCautions.length > 0) {
    clipped.editorial_cautions = [
      ...(clipped.editorial_cautions ?? []),
      ...addedCautions,
    ];
  }

  // Ensure all required array fields exist so adapters can append safely.
  clipped.verified_facts = clipped.verified_facts ?? [];
  clipped.api_confirmed_facts = clipped.api_confirmed_facts ?? [];
  clipped.unverified_signals = clipped.unverified_signals ?? [];
  clipped.editorial_cautions = clipped.editorial_cautions ?? [];

  return { valid: true, warnings, errors: [], candidate: clipped };
}

// Validate an array of candidates, logging to console.
// Returns only valid candidates (errors cause a candidate to be dropped).
export function validateCandidates(candidates) {
  const valid = [];
  let skippedCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const raw = candidates[i];
    const label =
      raw.trading_name ??
      raw.company_name ??
      raw.company_number ??
      `[index ${i}]`;

    const { valid: isValid, warnings, errors, candidate } = validateCandidate(raw);

    if (!isValid) {
      console.error(`  [SKIP] ${label}: ${errors.join("; ")}`);
      skippedCount++;
      continue;
    }

    for (const w of warnings) {
      console.warn(`  [WARN] ${label}: ${w}`);
    }

    valid.push(candidate);
  }

  if (skippedCount > 0) {
    console.warn(
      `\n  ${skippedCount} candidate(s) skipped — fix validation errors and re-run.`
    );
  }

  return valid;
}
