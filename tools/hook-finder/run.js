#!/usr/bin/env node
// Hook Finder — Phase 2A: live-source ingestion prototype.
//
// Usage:
//   node tools/hook-finder/run.js                         mock mode (default)
//   node tools/hook-finder/run.js --live                  live mode, reads live-input.json
//   node tools/hook-finder/run.js --input path/to/file    live mode, reads specified file
//
// Mock mode:   uses tools/hook-finder/data/candidates.js, no API calls.
// Live mode:   reads a JSON input file, enriches each candidate via the
//              Companies House API and Gazette adapter, then scores and reports.
//
// Live mode requires COMPANIES_HOUSE_API_KEY to be set in your environment.
// Output is written to tools/hook-finder/output/ (git-ignored).
// No content is published. Human review is required before any hook page is drafted.

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { candidates as mockCandidates } from "./data/candidates.js";
import { scoreCandidates } from "./scorer.js";
import { generateReport } from "./reporter.js";
import { generateBrief } from "./briefer.js";
import { enrichCandidates } from "./sources/index.js";
import { validateCandidates } from "./validate.js";
import { detectDuplicates } from "./dedup.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");
const DEFAULT_LIVE_INPUT = join(__dirname, "data", "live-input.json");

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { mode: "mock", inputFile: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--live") options.mode = "live";
    if (args[i] === "--mock") options.mode = "mock";
    if (args[i] === "--input" && args[i + 1]) {
      options.inputFile = args[++i];
      options.mode = "live";
    }
  }
  return options;
}

function loadLiveInput(inputFile) {
  const path = inputFile ?? DEFAULT_LIVE_INPUT;
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `Could not read live input file: ${path}\n` +
        "Create it from the example:\n" +
        "  cp tools/hook-finder/data/live-input.example.json tools/hook-finder/data/live-input.json\n" +
        "Then edit live-input.json with real candidate details."
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`live-input.json is not valid JSON: ${path}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`live-input.json must be a non-empty JSON array: ${path}`);
  }
  // Strip _note fields — they are documentation only.
  return parsed.map(({ _note: _ignored, ...rest }) => rest);
}

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
  const options = parseArgs(process.argv);

  console.log("\n=== Hook Finder — Phase 2A ===");
  console.log(`Date  : ${today()}`);
  console.log(`Mode  : ${options.mode.toUpperCase()}`);
  console.log("");

  let rawCandidates;

  if (options.mode === "mock") {
    rawCandidates = mockCandidates;
    console.log(`Candidates : ${rawCandidates.length} (mock data — no API calls)`);
    console.log("");
  } else {
    // Live mode: load from file, enrich via source adapters.
    rawCandidates = loadLiveInput(options.inputFile);
    const inputLabel = options.inputFile ?? "data/live-input.json";
    console.log(`Candidates : ${rawCandidates.length} (from ${inputLabel})`);
    console.log("");

    console.log("Validating...");
    rawCandidates = validateCandidates(rawCandidates);
    if (rawCandidates.length === 0) {
      console.error("No valid candidates remain after validation. Exiting.");
      process.exit(1);
    }
    console.log(`  ${rawCandidates.length} candidate(s) passed validation.`);
    console.log("");

    console.log("Checking for duplicates...");
    const { candidates: deduped, log: dedupLog } = detectDuplicates(rawCandidates);
    if (dedupLog.length > 0) {
      dedupLog.forEach(({ action, reason, name }) => {
        console.log(`  [${action.toUpperCase()}] ${name}: ${reason}`);
      });
    } else {
      console.log("  No duplicates found.");
    }
    rawCandidates = deduped;
    console.log("");

    console.log("Enriching via source adapters...");
    rawCandidates = await enrichCandidates(rawCandidates);
    console.log("");
  }

  // Score all candidates.
  const scored = scoreCandidates(rawCandidates);

  const needsReview = scored.filter((c) => c.status === "needs_review");
  const monitoring = scored.filter((c) => c.status === "monitoring");
  const rejected = scored.filter((c) => c.status === "rejected");

  console.log("Scoring complete:");
  console.log(`  Needs review : ${needsReview.length}`);
  console.log(`  Monitoring   : ${monitoring.length}`);
  console.log(`  Rejected     : ${rejected.length}`);
  console.log("");

  console.log("Score table (highest first):");
  scored.forEach((c) => {
    const name = (c.trading_name ?? c.company_name ?? "unnamed").padEnd(30);
    const score = String(c.total_score).padStart(3);
    const risk = c.risk_level.padEnd(8);
    console.log(`  ${name} ${score}/100  risk:${risk}  → ${c.status}`);
  });
  console.log("");

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Live reports get a -live suffix so they never overwrite mock reports.
  const modeSuffix = options.mode === "live" ? "-live" : "";
  const reportPath = join(OUTPUT_DIR, `report-${today()}${modeSuffix}.md`);
  const report = generateReport(scored, today(), options.mode);
  writeFile(reportPath, report);

  if (needsReview.length === 0) {
    console.log("\nNo candidates reached needs_review — no briefs generated.");
  } else {
    console.log(`\nGenerating ${needsReview.length} page brief(s):`);
    for (const candidate of needsReview) {
      const name = candidate.trading_name ?? candidate.company_name ?? "unnamed";
      const briefPath = join(OUTPUT_DIR, `brief-${slug(name)}${modeSuffix}.md`);
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
  console.error("\nHook Finder error:", err.message);
  process.exit(1);
});
