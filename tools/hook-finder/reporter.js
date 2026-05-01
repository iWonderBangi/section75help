// Generates a daily Markdown report from scored candidates.
// Output is for internal human review only — never published directly.
//
// Mock mode: three-section layout (verified facts, unverified signals, editorial cautions).
//            Same as Phase 1 — no change to existing mock output.
//
// Live mode: five-section layout per candidate:
//   1. API-confirmed facts     — data returned directly from Companies House or Gazette API
//   2. Manually supplied facts — data in the input file or Gazette fixture (human-curated)
//   3. Unverified signals      — signals from non-official sources (press, reviews, filings)
//   4. Editorial cautions      — blockers the editor must resolve before drafting
//   5. Still needed            — computed list of what is currently unknown

function riskBadge(risk_level) {
  const map = { low: "Low", medium: "Medium", high: "High" };
  return map[risk_level] ?? risk_level;
}

function renderList(items, emptyText) {
  if (!items || items.length === 0) return emptyText;
  return items.map((item) => `- ${item}`).join("\n");
}

// Compute what is still unknown and required before a page can be drafted.
// Runs against the candidate's current state after enrichment.
function computeStillNeeded(c) {
  const needed = [];
  if (!c.company_number) {
    needed.push("Company number (required to verify identity at Companies House)");
  }
  if (!c.primary_source_url) {
    needed.push("Official insolvency notice URL (Gazette, Companies House, or Insolvency Service)");
  }
  if (!c.insolvency_type || c.insolvency_type === "unknown") {
    needed.push("Insolvency type confirmed from an official notice (e.g. administration, liquidation)");
  }
  if (!c.insolvency_date) {
    needed.push("Insolvency or appointment date from an official notice");
  }
  const hasAnyConfirmedFact =
    (c.api_confirmed_facts?.length ?? 0) > 0 ||
    (c.verified_facts?.length ?? 0) > 0;
  if (!hasAnyConfirmedFact) {
    needed.push(
      "At least one fact confirmed by an official source (Companies House API or Gazette notice)"
    );
  }
  return needed;
}

function formatCandidateLive(c, index) {
  const breakdown = c._score_breakdown;
  const sourceLink = c.primary_source_url
    ? `[Primary source](${c.primary_source_url})`
    : "No primary source found";
  const secondaryLink = c.secondary_source_url
    ? ` | [Secondary source](${c.secondary_source_url})`
    : "";

  const ambiguousFlag = c.ambiguous_company
    ? "**AMBIGUOUS** — company identity is uncertain"
    : "—";

  const apiConfirmed = renderList(
    c.api_confirmed_facts,
    "*None — Companies House enrichment did not run or returned no data.*"
  );
  const manualFacts = renderList(
    c.verified_facts,
    "*None recorded in the input file.*"
  );
  const unverifiedSignals = renderList(
    c.unverified_signals,
    "*None.*"
  );
  const editorialCautions = renderList(
    c.editorial_cautions,
    "*None.*"
  );
  const stillNeeded = renderList(
    computeStillNeeded(c),
    "*Nothing outstanding — proceed to brief if score permits.*"
  );

  return `### ${index + 1}. ${c.trading_name ?? c.company_name}

| Field | Value |
|---|---|
| Legal name | ${c.company_name ?? "—"} |
| Company number | ${c.company_number ?? "Not provided"} |
| Website | ${c.website ?? "—"} |
| Sector | ${c.sector} |
| Status | ${c.company_status ?? "unknown"} |
| Insolvency type | ${c.insolvency_type ?? "unknown"} |
| Insolvency date | ${c.insolvency_date ?? "Not confirmed"} |
| Risk level | ${riskBadge(c.risk_level)} |
| Ambiguous company | ${ambiguousFlag} |
| **Total score** | **${c.total_score} / 100** |

**Score breakdown:**

| Dimension | Score | Max |
|---|---|---|
| B2C fit | ${breakdown.b2c} | 25 |
| Consumer loss likelihood | ${breakdown.loss} | 25 |
| Search demand | ${breakdown.demand} | 20 |
| Source confidence | ${breakdown.confidence} | 20 |
| Commercial fit | ${breakdown.commercial} | 10 |

**Sources:** ${sourceLink}${secondaryLink}

**1. API-confirmed facts** *(returned directly by Companies House API or Gazette API — treat as verified):*

${apiConfirmed}

**2. Manually supplied facts** *(from input file or Gazette fixture — human-curated, check against original notice):*

${manualFacts}

**3. Unverified signals** *(do not present these as facts in any published page):*

${unverifiedSignals}

**4. Editorial cautions** *(must be resolved before drafting):*

${editorialCautions}

**5. Still needed before drafting:**

${stillNeeded}

**Recommended action:** ${recommendedAction(c)}

---
`;
}

function formatCandidateMock(c, index) {
  const breakdown = c._score_breakdown;
  const sourceLink = c.primary_source_url
    ? `[Primary source](${c.primary_source_url})`
    : "No primary source found";
  const secondaryLink = c.secondary_source_url
    ? ` | [Secondary source](${c.secondary_source_url})`
    : "";

  const verifiedFacts = renderList(
    c.verified_facts,
    "*None recorded — treat all signals as unverified.*"
  );
  const unverifiedSignals = renderList(c.unverified_signals, "*None.*");
  const editorialCautions = renderList(c.editorial_cautions, "*None.*");

  return `### ${index + 1}. ${c.trading_name ?? c.company_name}

| Field | Value |
|---|---|
| Legal name | ${c.company_name} |
| Company number | ${c.company_number} |
| Website | ${c.website ?? "—"} |
| Sector | ${c.sector} |
| Status | ${c.company_status} |
| Insolvency type | ${c.insolvency_type} |
| Insolvency date | ${c.insolvency_date ?? "Not confirmed"} |
| Risk level | ${riskBadge(c.risk_level)} |
| **Total score** | **${c.total_score} / 100** |

**Score breakdown:**

| Dimension | Score | Max |
|---|---|---|
| B2C fit | ${breakdown.b2c} | 25 |
| Consumer loss likelihood | ${breakdown.loss} | 25 |
| Search demand | ${breakdown.demand} | 20 |
| Source confidence | ${breakdown.confidence} | 20 |
| Commercial fit | ${breakdown.commercial} | 10 |

**Sources:** ${sourceLink}${secondaryLink}

**Verified facts:**

${verifiedFacts}

**Unverified signals** *(do not present these as facts in any published page):*

${unverifiedSignals}

**Editorial cautions:**

${editorialCautions}

**Recommended action:** ${recommendedAction(c)}

---
`;
}

function recommendedAction(c) {
  if (c.status === "needs_review") {
    return "Assign to editor for hook page brief. Verify all facts against primary sources before drafting.";
  }
  if (c.status === "monitoring") {
    if (c.risk_level === "high") {
      return "Do not publish. Continue monitoring the Gazette and Companies House for an official notice.";
    }
    return "Check again in 48 hours. Publish only after administrator details and consumer impact are confirmed.";
  }
  return "No action required. Archive if no change in 30 days.";
}

export function generateReport(scoredCandidates, date, mode = "mock") {
  const needs = scoredCandidates.filter((c) => c.status === "needs_review");
  const monitoring = scoredCandidates.filter((c) => c.status === "monitoring");
  const rejected = scoredCandidates.filter((c) => c.status === "rejected");

  const formatFn =
    mode === "live" ? formatCandidateLive : formatCandidateMock;

  const lines = [];

  lines.push(`# Hook Page Discovery Report — ${date}`);
  lines.push("");
  lines.push("> Internal use only. Do not publish any claims from this report without independent");
  lines.push("> verification of all facts against official sources (the Gazette, Companies House,");
  lines.push("> Insolvency Service). This report is a recommendation engine, not a publishing queue.");
  lines.push("");

  if (mode === "live") {
    lines.push(
      "> **Live mode.** Candidates were enriched via the Companies House API and Gazette adapter."
    );
    lines.push(
      "> API-confirmed facts (section 1) came directly from official APIs."
    );
    lines.push(
      "> Manually supplied facts (section 2) came from the input file or a Gazette fixture."
    );
    lines.push(
      "> Unverified signals (section 3) must not be stated as facts in any published page."
    );
    lines.push("");
  }

  lines.push("## Summary");
  lines.push("");
  lines.push(`| Status | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Needs review | ${needs.length} |`);
  lines.push(`| Monitoring | ${monitoring.length} |`);
  lines.push(`| Rejected / ignored | ${rejected.length} |`);
  lines.push(`| **Total candidates** | **${scoredCandidates.length}** |`);
  lines.push("");
  lines.push("---");
  lines.push("");

  if (needs.length > 0) {
    lines.push("## Needs Review");
    lines.push("");
    lines.push(
      "These candidates scored 80+ and have sufficient source confidence for a hook page brief to be drafted. A human editor must verify all facts before any page is written."
    );
    lines.push("");
    needs.forEach((c, i) => lines.push(formatFn(c, i)));
  }

  if (monitoring.length > 0) {
    lines.push("## Monitoring");
    lines.push("");
    lines.push(
      "These candidates have signals worth watching but do not yet meet the threshold for a hook page brief — either the score is too low, source confidence is insufficient, or the consumer impact is unclear."
    );
    lines.push("");
    monitoring.forEach((c, i) => lines.push(formatFn(c, i)));
  }

  if (rejected.length > 0) {
    lines.push("## Rejected / Ignored");
    lines.push("");
    lines.push(
      "These candidates scored below 60. No Section 75 hook page is warranted. Archive if no change in 30 days."
    );
    lines.push("");
    rejected.forEach((c, i) => lines.push(formatFn(c, i)));
  }

  lines.push("---");
  lines.push("");
  const modeNote =
    mode === "live"
      ? "live mode — candidates enriched via Companies House API and Gazette adapter."
      : "mock mode — using static mock candidates, no API calls made.";
  lines.push(`*Generated by tools/hook-finder — Phase 2B, ${modeNote}*`);
  lines.push(
    "*Scoring: B2C fit (25) + Consumer loss (25) + Search demand (20) + Source confidence (20) + Commercial fit (10) = 100 max.*"
  );
  lines.push("*Classification: 80+ = needs\\_review | 60–79 = monitoring | <60 = rejected*");
  lines.push(
    "*Source confidence below 10 overrides needs\\_review regardless of total score.*"
  );

  return lines.join("\n");
}
