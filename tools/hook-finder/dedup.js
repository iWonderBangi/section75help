// Duplicate detection for live candidates.
// Runs after validation, before enrichment, to avoid redundant API calls.
//
// Two duplicate rules:
//
//   Same company_number → MERGE
//     The later entry is merged into the earlier one. Higher scores win.
//     Array fields are combined and deduplicated. An editorial caution is added.
//
//   Same primary_source_url (different company_number) → FLAG
//     Both entries are kept. The later entry receives an editorial caution noting
//     the shared URL, and ambiguous_company is set to true on it.
//     This can happen when a Gazette notice covers multiple companies.
//
// Entries with no company_number and no primary_source_url cannot be deduplicated
// and always pass through.

const SCORE_FIELDS = [
  "b2c_fit_score",
  "consumer_loss_score",
  "search_demand_score",
  "source_confidence_score",
  "commercial_fit_score",
];

const ARRAY_FIELDS = [
  "verified_facts",
  "api_confirmed_facts",
  "unverified_signals",
  "editorial_cautions",
];

// Merge `source` into `target` (mutates `target`).
function mergeDuplicate(target, source) {
  // Take the higher score for each dimension.
  for (const field of SCORE_FIELDS) {
    if ((source[field] ?? 0) > (target[field] ?? 0)) {
      target[field] = source[field];
    }
  }

  // Append and deduplicate array fields.
  for (const field of ARRAY_FIELDS) {
    const combined = [...(target[field] ?? []), ...(source[field] ?? [])];
    // Deduplicate by text so the same fact is not listed twice.
    target[field] = [...new Set(combined)];
  }

  const sourceName = source.trading_name ?? source.company_name ?? source.company_number ?? "unknown";
  target.editorial_cautions = [
    ...(target.editorial_cautions ?? []),
    `A duplicate entry for company number ${target.company_number} (as "${sourceName}") was merged into this record. Review the combined data for conflicts before drafting.`,
  ];
}

// Detect and handle duplicates in a candidate array.
// Returns { candidates: deduped array, log: record of what happened }
export function detectDuplicates(candidates) {
  const byNumber = new Map(); // company_number → index in output
  const byUrl = new Map();    // primary_source_url → index in output
  const output = [];
  const log = [];

  for (const raw of candidates) {
    const num = raw.company_number;
    const url = raw.primary_source_url;

    // Same company_number → merge into existing entry.
    if (num && byNumber.has(num)) {
      const existingIdx = byNumber.get(num);
      mergeDuplicate(output[existingIdx], raw);
      const name = raw.trading_name ?? raw.company_name ?? num;
      log.push({
        action: "merged",
        reason: `same company_number (${num})`,
        name,
      });
      continue;
    }

    const candidate = { ...raw };

    // Same URL but different company_number → flag, keep both.
    if (url && byUrl.has(url)) {
      const existingIdx = byUrl.get(url);
      const existingName =
        output[existingIdx].trading_name ??
        output[existingIdx].company_name ??
        "unknown";
      candidate.ambiguous_company = true;
      candidate.editorial_cautions = [
        ...(candidate.editorial_cautions ?? []),
        `Primary source URL is also cited by another candidate ("${existingName}"). Verify these are distinct companies and that the URL uniquely identifies this insolvency event.`,
      ];
      const name = candidate.trading_name ?? candidate.company_name ?? "unknown";
      log.push({
        action: "flagged",
        reason: `shared primary_source_url with "${existingName}"`,
        name,
      });
    }

    const idx = output.length;
    output.push(candidate);
    if (num) byNumber.set(num, idx);
    if (url) byUrl.set(url, idx);
  }

  return { candidates: output, log };
}
