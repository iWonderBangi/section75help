#!/usr/bin/env node
// Hook Finder — Phase 1 local prototype.
// Scores mock candidates, writes a daily Markdown report, and generates
// page briefs for any candidate that reaches needs_review status.
//
// Usage:  node tools/hook-finder/run.js
//
// Output is written to tools/hook-finder/output/
// None of these files are published. Human review is required before any
// hook page is drafted.

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { candidates } from "./data/candidates.js";
import { scoreCandidates } from "./scorer.js";
import { generateReport } from "./reporter.js";
import { generateBrief } from "./briefer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function writeFile(filePath, content) {
  writeFileSync(filePath, content, "utf8");
  console.log(`  Written: ${filePath.replace(__dirname, "tools/hook-finder")}`);
}

async function run() {
  console.log("\n=== Hook Finder — Phase 1 ===");
  console.log(`Date: ${today()}`);
  console.log(`Candidates loaded: ${candidates.length}`);
  console.log("");

  // Score all candidates.
  const scored = scoreCandidates(candidates);

  const needsReview = scored.filter((c) => c.status === "needs_review");
  const monitoring = scored.filter((c) => c.status === "monitoring");
  const rejected = scored.filter((c) => c.status === "rejected");

  console.log("Scoring complete:");
  console.log(`  Needs review : ${needsReview.length}`);
  console.log(`  Monitoring   : ${monitoring.length}`);
  console.log(`  Rejected     : ${rejected.length}`);
  console.log("");

  // Print a quick score table to stdout.
  console.log("Score table (highest first):");
  scored.forEach((c) => {
    const name = (c.trading_name ?? c.company_name).padEnd(30);
    const score = String(c.total_score).padStart(3);
    const risk = c.risk_level.padEnd(8);
    console.log(`  ${name} ${score}/100  risk:${risk}  → ${c.status}`);
  });
  console.log("");

  // Ensure output directory exists.
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write the daily report.
  const reportPath = join(OUTPUT_DIR, `report-${today()}.md`);
  const report = generateReport(scored, today());
  writeFile(reportPath, report);

  // Write page briefs for needs_review candidates only.
  if (needsReview.length === 0) {
    console.log("\nNo candidates reached needs_review — no briefs generated.");
  } else {
    console.log(`\nGenerating ${needsReview.length} page brief(s):`);
    for (const candidate of needsReview) {
      const name = candidate.trading_name ?? candidate.company_name;
      const briefPath = join(OUTPUT_DIR, `brief-${slug(name)}.md`);
      const brief = generateBrief(candidate);
      writeFile(briefPath, brief);
    }
  }

  console.log("\nDone. Review the output files before taking any action.");
  console.log(
    "Do not publish claims about any company without verifying against official primary sources.\n"
  );
}

run().catch((err) => {
  console.error("Hook Finder error:", err);
  process.exit(1);
});
