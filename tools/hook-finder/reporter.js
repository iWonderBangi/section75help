// Generates a daily Markdown report from scored candidates.
// Output is for internal human review only — never published directly.

function statusBadge(status) {
  const map = { needs_review: "NEEDS REVIEW", monitoring: "MONITORING", rejected: "REJECTED" };
  return map[status] ?? status.toUpperCase();
}

function riskBadge(risk_level) {
  const map = { low: "Low", medium: "Medium", high: "High" };
  return map[risk_level] ?? risk_level;
}

function scoreBar(score, max) {
  const filled = Math.round((score / max) * 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)} ${score}/${max}`;
}

function renderList(items, emptyText) {
  if (!items || items.length === 0) return emptyText;
  return items.map((item) => `- ${item}`).join("\n");
}

function formatCandidate(c, index) {
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
  const unverifiedSignals = renderList(
    c.unverified_signals,
    "*None.*"
  );
  const editorialCautions = renderList(
    c.editorial_cautions,
    "*None.*"
  );

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

export function generateReport(scoredCandidates, date) {
  const needs = scoredCandidates.filter((c) => c.status === "needs_review");
  const monitoring = scoredCandidates.filter((c) => c.status === "monitoring");
  const rejected = scoredCandidates.filter((c) => c.status === "rejected");

  const lines = [];

  lines.push(`# Hook Page Discovery Report — ${date}`);
  lines.push("");
  lines.push("> Internal use only. Do not publish any claims from this report without independent");
  lines.push("> verification of all facts against official sources (the Gazette, Companies House,");
  lines.push("> Insolvency Service). This report is a recommendation engine, not a publishing queue.");
  lines.push("");
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
    needs.forEach((c, i) => lines.push(formatCandidate(c, i)));
  }

  if (monitoring.length > 0) {
    lines.push("## Monitoring");
    lines.push("");
    lines.push(
      "These candidates have signals worth watching but do not yet meet the threshold for a hook page brief — either the score is too low, source confidence is insufficient, or the consumer impact is unclear."
    );
    lines.push("");
    monitoring.forEach((c, i) => lines.push(formatCandidate(c, i)));
  }

  if (rejected.length > 0) {
    lines.push("## Rejected / Ignored");
    lines.push("");
    lines.push(
      "These candidates scored below 60. No Section 75 hook page is warranted. Archive if no change in 30 days."
    );
    lines.push("");
    rejected.forEach((c, i) => lines.push(formatCandidate(c, i)));
  }

  lines.push("---");
  lines.push("");
  lines.push("*Generated by tools/hook-finder — Phase 1 prototype using mock data.*");
  lines.push(
    "*Scoring: B2C fit (25) + Consumer loss (25) + Search demand (20) + Source confidence (20) + Commercial fit (10) = 100 max.*"
  );
  lines.push("*Classification: 80+ = needs\\_review | 60–79 = monitoring | <60 = rejected*");
  lines.push(
    "*Source confidence below 10 overrides needs\\_review regardless of total score.*"
  );

  return lines.join("\n");
}
