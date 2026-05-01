#!/usr/bin/env node
// Creates a GitHub Issue for needs_review candidates from the latest summary.json.
//
// Usage:
//   node tools/hook-finder/create-issue.js             live mode (creates issue)
//   node tools/hook-finder/create-issue.js --dry-run   prints issue body, no API calls
//
// Required env (live mode only):
//   GITHUB_TOKEN       — GitHub Actions GITHUB_TOKEN or a personal access token
//   GITHUB_REPOSITORY  — owner/repo (set automatically in GitHub Actions)
//
// Optional env (set automatically in GitHub Actions):
//   GITHUB_RUN_ID      — used to generate artifact link in issue body
//   GITHUB_SERVER_URL  — defaults to https://github.com

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUMMARY_PATH = join(__dirname, "output", "summary.json");

const LABELS = ["hook-finder", "needs-review", "content-opportunity"];
const LABEL_COLORS = {
  "hook-finder": "0075ca",
  "needs-review": "d93f0b",
  "content-opportunity": "0e8a16",
};

const GH_API = "https://api.github.com";
const GH_API_VERSION = "2022-11-28";

function loadSummary() {
  let raw;
  try {
    raw = readFileSync(SUMMARY_PATH, "utf8");
  } catch {
    throw new Error(
      `Could not read summary file: ${SUMMARY_PATH}\n` +
        "Run the hook-finder first to generate it:\n" +
        "  npm run hook-finder        (mock mode)\n" +
        "  npm run hook-finder:ci     (CI mode)"
    );
  }
  return JSON.parse(raw);
}

function issueTitle(date) {
  return `Hook Finder candidates needing review — ${date}`;
}

function renderList(items, emptyText) {
  if (!items || items.length === 0) return emptyText;
  return items.map((item) => `- ${item}`).join("\n");
}

function recommendedAction(c) {
  if (c.status === "needs_review") {
    return "Assign to editor for hook page brief. Verify all facts against primary sources before drafting.";
  }
  return "No action required.";
}

function generateIssueBody(summary) {
  const { date, counts, needs_review: candidates } = summary;

  const runId = process.env.GITHUB_RUN_ID;
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const repo = process.env.GITHUB_REPOSITORY;
  const artifactLink =
    runId && repo ? `${serverUrl}/${repo}/actions/runs/${runId}` : null;

  const lines = [];

  lines.push(
    "> **Internal use only.** This issue was created automatically by the Hook Finder tool. Do not publish any page listed here without independently verifying all facts against official primary sources (the Gazette, Companies House, Insolvency Service)."
  );
  lines.push("");
  lines.push(`## Summary — ${date}`);
  lines.push("");
  lines.push("| Status | Count |");
  lines.push("|---|---|");
  lines.push(`| Needs review | ${counts.needs_review} |`);
  lines.push(`| Monitoring | ${counts.monitoring} |`);
  lines.push(`| Rejected | ${counts.rejected} |`);
  lines.push(`| **Total** | **${counts.total}** |`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Candidates requiring review");
  lines.push("");

  candidates.forEach((c, i) => {
    const name = c.trading_name ?? c.company_name ?? "Unnamed";
    const breakdown = c._score_breakdown;

    lines.push(`### ${i + 1}. ${name}`);
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(`| Total score | **${c.total_score} / 100** |`);
    lines.push(`| Risk level | ${c.risk_level} |`);
    lines.push(`| Company number | ${c.company_number ?? "—"} |`);
    lines.push(`| Sector | ${c.sector} |`);
    lines.push(`| Insolvency type | ${c.insolvency_type ?? "unknown"} |`);
    lines.push(`| Insolvency date | ${c.insolvency_date ?? "Not confirmed"} |`);
    if (c.ambiguous_company) {
      lines.push(
        `| Company identity | AMBIGUOUS — verify before drafting |`
      );
    }
    lines.push("");

    if (breakdown) {
      lines.push("**Score breakdown:**");
      lines.push("");
      lines.push("| Dimension | Score | Max |");
      lines.push("|---|---|---|");
      lines.push(`| B2C fit | ${breakdown.b2c} | 25 |`);
      lines.push(`| Consumer loss likelihood | ${breakdown.loss} | 25 |`);
      lines.push(`| Search demand | ${breakdown.demand} | 20 |`);
      lines.push(`| Source confidence | ${breakdown.confidence} | 20 |`);
      lines.push(`| Commercial fit | ${breakdown.commercial} | 10 |`);
      lines.push("");
    }

    const primaryLink = c.primary_source_url
      ? `[Primary source](${c.primary_source_url})`
      : "No primary source found";
    const secondaryLink = c.secondary_source_url
      ? ` | [Secondary source](${c.secondary_source_url})`
      : "";
    lines.push(`**Sources:** ${primaryLink}${secondaryLink}`);
    lines.push("");

    if ((c.api_confirmed_facts?.length ?? 0) > 0) {
      lines.push("**API-confirmed facts** *(treat as verified):*");
      lines.push("");
      lines.push(renderList(c.api_confirmed_facts, "*None.*"));
      lines.push("");
    }

    lines.push(
      "**Verified facts** *(manually supplied — check against original notice):*"
    );
    lines.push("");
    lines.push(renderList(c.verified_facts, "*None recorded.*"));
    lines.push("");

    lines.push(
      "**Unverified signals** *(do not present as facts in any published page):*"
    );
    lines.push("");
    lines.push(renderList(c.unverified_signals, "*None.*"));
    lines.push("");

    lines.push("**Editorial cautions** *(must be resolved before drafting):*");
    lines.push("");
    lines.push(renderList(c.editorial_cautions, "*None.*"));
    lines.push("");

    lines.push(`**Recommended action:** ${recommendedAction(c)}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  lines.push("## Before drafting any page");
  lines.push("");
  lines.push(
    "- Confirm the insolvency notice against the Gazette or Companies House."
  );
  lines.push(
    "- Verify the administrator's name and firm from the official notice."
  );
  lines.push(
    "- Confirm consumer impact from a named source — do not estimate."
  );
  lines.push(
    "- Check whether ATOL, ABTA, or other schemes apply (travel companies)."
  );
  lines.push(
    "- Ensure no copy implies we handle claims on behalf of the user."
  );
  lines.push("");

  if (artifactLink) {
    lines.push(
      `The full scored report and any generated page briefs are in the [workflow run artifact](${artifactLink}).`
    );
  } else {
    lines.push(
      "The full scored report and any generated page briefs are in the workflow run artifact."
    );
  }

  lines.push("");
  lines.push(
    "*Generated by tools/hook-finder — Phase 4. This issue does not mean a page should be published. It means a human editor should review the evidence and decide.*"
  );

  return lines.join("\n");
}

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GH_API_VERSION,
    "User-Agent": "hook-finder/phase-4",
    "Content-Type": "application/json",
  };
}

async function ensureLabel(owner, repo, label, token) {
  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/labels/${encodeURIComponent(label)}`,
    { headers: ghHeaders(token) }
  );
  if (res.ok) return;
  await fetch(`${GH_API}/repos/${owner}/${repo}/labels`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({
      name: label,
      color: LABEL_COLORS[label] ?? "ededed",
    }),
  });
  // Do not throw — labels are nice-to-have, not required for issue creation.
}

async function findExistingIssue(owner, repo, title, token) {
  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/issues?labels=hook-finder&state=open&per_page=30`,
    { headers: ghHeaders(token) }
  );
  if (!res.ok) return null;
  const issues = await res.json();
  return issues.find((i) => i.title === title) ?? null;
}

async function createIssue(owner, repo, title, body, labels, token) {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({ title, body, labels }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("\n=== Hook Finder — Issue Delivery (Phase 4) ===");
  console.log(`Mode: ${dryRun ? "DRY RUN (no API calls)" : "LIVE"}`);
  console.log("");

  const summary = loadSummary();
  console.log(`Date:          ${summary.date}`);
  console.log(`Needs review:  ${summary.counts.needs_review}`);
  console.log(`Monitoring:    ${summary.counts.monitoring}`);
  console.log(`Rejected:      ${summary.counts.rejected}`);
  console.log("");

  if (summary.counts.needs_review === 0) {
    console.log(
      "No needs_review candidates found. Artifact uploaded only. No issue created."
    );
    return;
  }

  const title = issueTitle(summary.date);
  const body = generateIssueBody(summary);

  if (dryRun) {
    console.log("=== Issue title ===");
    console.log(title);
    console.log("");
    console.log("=== Issue body ===");
    console.log(body);
    console.log("");
    console.log("Dry run complete. No issue created.");
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN is not set. Cannot create issue.");
    process.exit(1);
  }

  const repoStr = process.env.GITHUB_REPOSITORY;
  if (!repoStr || !repoStr.includes("/")) {
    console.error(
      "GITHUB_REPOSITORY is not set or malformed (expected owner/repo)."
    );
    process.exit(1);
  }
  const [owner, repo] = repoStr.split("/");

  console.log("Ensuring labels exist...");
  for (const label of LABELS) {
    try {
      await ensureLabel(owner, repo, label, token);
      console.log(`  OK: ${label}`);
    } catch {
      console.warn(`  Warning: could not ensure label "${label}" — continuing without it.`);
    }
  }
  console.log("");

  console.log("Checking for existing issue with the same title...");
  const existing = await findExistingIssue(owner, repo, title, token);
  if (existing) {
    console.log(`  Already exists: ${existing.html_url}`);
    console.log("  Skipping — no duplicate created.");
    return;
  }
  console.log("  None found — creating new issue.");
  console.log("");

  console.log("Creating issue...");
  const issue = await createIssue(owner, repo, title, body, LABELS, token);
  console.log(`  Created: ${issue.html_url}`);
  console.log("");
  console.log("Done.");
}

run().catch((err) => {
  console.error("\nIssue delivery error:", err.message);
  process.exit(1);
});
