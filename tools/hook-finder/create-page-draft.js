#!/usr/bin/env node
// Generates an internal MDX page draft from a needs_review hook-finder brief.
//
// Usage:
//   node tools/hook-finder/create-page-draft.js --brief <path>
//       Generate a draft for the candidate matching the given brief file.
//
//   node tools/hook-finder/create-page-draft.js
//       Generate drafts for all needs_review candidates in summary.json.
//
// Reads: tools/hook-finder/output/summary.json (run hook-finder first)
// Writes: tools/hook-finder/output/page-drafts/draft-<slug>.mdx
//
// Generated drafts are INTERNAL REVIEW DOCUMENTS. They must not be moved to
// src/content/trigger/ or any public path until all [EDITOR: ...] placeholders
// have been resolved and all facts independently verified.

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { getSectorEvidence, getSectorRejections } from "./briefer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUMMARY_PATH = join(__dirname, "output", "summary.json");
const DRAFTS_DIR = join(__dirname, "output", "page-drafts");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function now() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

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

// Extract the candidate slug from a brief filename.
// Strips "brief-" prefix, ".md" suffix, and optional "-live" suffix.
function slugFromBriefPath(briefPath) {
  const base = basename(briefPath, ".md");
  return base.replace(/^brief-/, "").replace(/-live$/, "");
}

function findCandidateBySlug(candidateSlug, summary) {
  const allCandidates = [
    ...summary.needs_review,
    ...summary.monitoring,
    ...summary.rejected,
  ];
  return (
    allCandidates.find((c) => {
      const name = c.trading_name ?? c.company_name ?? "";
      return slug(name) === candidateSlug;
    }) ?? null
  );
}

function validateForDraft(candidate) {
  if (!candidate) {
    return { ok: false, reason: "Candidate not found in summary.json." };
  }
  if (candidate.status !== "needs_review") {
    return {
      ok: false,
      reason:
        `Candidate status is "${candidate.status}" — only needs_review candidates may be drafted. ` +
        `Re-run the hook-finder if this candidate's score has changed.`,
    };
  }
  if (candidate.ambiguous_company) {
    return {
      ok: false,
      reason:
        "Candidate is flagged ambiguous_company. Resolve the company identity before generating a draft.",
    };
  }
  return { ok: true };
}

// ─── Draft generation ─────────────────────────────────────────────────────────

function renderEditorNote(text) {
  return `[EDITOR: ${text}]`;
}

function renderVerifiedFacts(facts) {
  if (!facts || facts.length === 0) return null;
  return facts.map((f) => `- ${f}`).join("\n");
}

function renderUnverifiedSignals(signals) {
  if (!signals || signals.length === 0) return null;
  return signals
    .map((s) => `- ${renderEditorNote(`verify — ${s}`)}`)
    .join("\n");
}

function renderEditorialCautions(cautions) {
  if (!cautions || cautions.length === 0) return null;
  return cautions.map((c) => `- ${c}`).join("\n");
}

function sectorLabel(sector) {
  return (sector ?? "general").replace(/-/g, " ");
}

function generateDraft(candidate, sourceBriefPath) {
  const name = candidate.trading_name ?? candidate.company_name ?? "the company";
  const legalName = candidate.company_name ?? renderEditorNote("legal name — verify from Companies House");
  const companyNumber = candidate.company_number ?? renderEditorNote("company number");
  const insolvencyType = candidate.insolvency_type && candidate.insolvency_type !== "unknown"
    ? candidate.insolvency_type
    : renderEditorNote("insolvency type — administration, liquidation, etc.");
  const insolvencyDate = candidate.insolvency_date
    ?? renderEditorNote("date of administration/liquidation — verify from Gazette notice");
  const candidateSlug = slug(name);

  const evidence = getSectorEvidence(candidate.sector);
  const rejections = getSectorRejections(candidate.sector);

  const primarySourceNote = candidate.primary_source_url
    ? `[Gazette/Companies House notice](${candidate.primary_source_url})`
    : renderEditorNote("primary source URL — mandatory before publishing");

  const verifiedFactsBlock = renderVerifiedFacts([
    ...(candidate.api_confirmed_facts ?? []),
    ...(candidate.verified_facts ?? []),
  ]);

  const unverifiedBlock = renderUnverifiedSignals(candidate.unverified_signals);
  const cautionsBlock = renderEditorialCautions(candidate.editorial_cautions);

  const lines = [];

  // ── Frontmatter ──────────────────────────────────────────────────────────
  lines.push("---");
  lines.push("# Internal metadata — remove all fields in this block before publishing");
  lines.push("draft: true");
  lines.push("internalOnly: true");
  lines.push("publishAllowed: false");
  lines.push('status: "internal-review-draft"');
  lines.push(`generatedAt: "${now()}"`);
  lines.push(
    `sourceBrief: "${sourceBriefPath ? sourceBriefPath.replace(/\\/g, "/") : "summary.json"}"`
  );
  lines.push('lastFactCheck: ""');
  lines.push("");
  lines.push("# Page metadata — fill in and retain when moving to src/content/trigger/");
  lines.push(
    `title: "${name} administration: can customers claim a refund under Section 75?"`
  );
  lines.push(
    `description: "${renderEditorNote("write a meta description, 150-160 characters, starting with the company name and the Section 75 entitlement")}"`
  );
  lines.push('publishedAt: ""');
  lines.push('updatedAt: ""');
  lines.push("category: trigger");
  lines.push("disclaimer: true");
  lines.push(`company: "${name}"`);
  lines.push(`legalName: "${legalName}"`);
  lines.push(`companyNumber: "${companyNumber}"`);
  lines.push(`slugSuggestion: "${candidateSlug}"`);
  lines.push(`failureDate: "${insolvencyDate}"`);
  lines.push("---");
  lines.push("");

  // ── Internal header comment ───────────────────────────────────────────────
  lines.push("{/*");
  lines.push("  INTERNAL REVIEW DRAFT — DO NOT PUBLISH");
  lines.push(`  Generated: ${today()}`);
  lines.push(`  Candidate: ${name} | Score: ${candidate.total_score}/100 | Risk: ${candidate.risk_level}`);
  lines.push(`  Source: ${sourceBriefPath ?? "summary.json"}`);
  lines.push("");
  lines.push("  Before moving to src/content/trigger/:");
  lines.push("  [ ] All [EDITOR: ...] placeholders resolved and removed");
  lines.push("  [ ] Insolvency notice verified against Gazette or Companies House");
  lines.push("  [ ] Administrator name confirmed from official notice");
  lines.push("  [ ] Consumer impact confirmed from a named, citable source");
  lines.push("  [ ] No sentence promises a specific refund outcome");
  lines.push("  [ ] No copy implies we handle claims on behalf of the user");
  lines.push("  [ ] Disclaimer block present near top and foot of page");
  lines.push("  [ ] All mandatory internal links present and working");
  lines.push("  [ ] Remove draft, internalOnly, publishAllowed, status, generatedAt,");
  lines.push("      sourceBrief, lastFactCheck fields from frontmatter");
  lines.push("  [ ] Set publishedAt and updatedAt to the publish date");
  lines.push("*/}");
  lines.push("");

  // ── Editorial cautions block ──────────────────────────────────────────────
  if (cautionsBlock) {
    lines.push("{/*");
    lines.push("  EDITORIAL CAUTIONS — resolve before drafting:");
    lines.push("");
    cautionsBlock.split("\n").forEach((l) => lines.push(`  ${l}`));
    lines.push("*/}");
    lines.push("");
  }

  // ── Disclaimer (top) ──────────────────────────────────────────────────────
  lines.push("> This page provides general information about Section 75 of the Consumer Credit Act 1974. It is not legal advice for your specific situation. We do not act for you, represent you to your bank, or handle claims on your behalf. For advice tailored to your circumstances, contact a solicitor or the Citizens Advice consumer helpline.");
  lines.push("");

  // ── Page title ───────────────────────────────────────────────────────────
  lines.push(`# ${name} administration: can customers claim a refund under Section 75?`);
  lines.push("");

  // ── Opening paragraph ────────────────────────────────────────────────────
  lines.push(
    renderEditorNote(
      "Opening paragraph — 150 words max. Start with the specific financial loss the reader faces. " +
      "Name the company and the date it entered " + insolvencyType + ". " +
      "State clearly that Section 75 of the Consumer Credit Act 1974 may entitle them to a refund " +
      "from their credit card provider. No preamble. No 'in this article we will explore.' " +
      "The reader is stressed — give them the lifeline in the first sentence."
    )
  );
  lines.push("");
  lines.push("**Example opening to adapt (do not publish verbatim — write from verified facts):**");
  lines.push("");
  lines.push(
    `> You paid by credit card for [${renderEditorNote("describe the product or service")}] from ${name}. On ${insolvencyDate}, the company entered ${insolvencyType} — and [${renderEditorNote("describe the loss: goods not delivered / installation abandoned / holiday cancelled")}]. If you paid at least £1 of a purchase totalling more than £100 on a credit card, Section 75 of the Consumer Credit Act 1974 may entitle you to a full refund from your card provider, even though it was the retailer — not the bank — that failed you.`
  );
  lines.push("");

  // ── What happened ─────────────────────────────────────────────────────────
  lines.push("## What happened");
  lines.push("");

  if (verifiedFactsBlock) {
    lines.push("**Confirmed facts:**");
    lines.push("");
    lines.push(verifiedFactsBlock);
    lines.push("");
  }

  lines.push(
    `- ${name} entered ${insolvencyType} on ${insolvencyDate}.`
  );
  lines.push(
    `- Legal name: ${legalName}${candidate.company_number ? ` (Companies House number: ${candidate.company_number})` : ""}.`
  );
  lines.push(
    `- Administrator: ${renderEditorNote("name and firm — verify from Gazette notice before including. Do not guess.")}`
  );
  lines.push(
    `- ${renderEditorNote("describe what customers are owed — typical order type, what was not delivered or completed. Do not state customer numbers or loss amounts without a citable source.")}`
  );
  lines.push("");
  lines.push(`**Primary source:** ${primarySourceNote}`);
  lines.push("");

  if (unverifiedBlock) {
    lines.push("**Signals to verify before including:**");
    lines.push("");
    lines.push(unverifiedBlock);
    lines.push("");
  }

  // ── Does Section 75 apply ─────────────────────────────────────────────────
  lines.push(`## Does Section 75 apply to ${name} customers?`);
  lines.push("");
  lines.push(
    "Section 75 of the [Consumer Credit Act 1974](https://www.legislation.gov.uk/ukpga/1974/39/section/75) makes credit card providers jointly liable with retailers for purchases where:"
  );
  lines.push("");
  lines.push("- The total purchase price was more than £100 and no more than £30,000");
  lines.push("- You paid at least £1 of that price on a credit card");
  lines.push("- The purchase was personal — not for a business");
  lines.push("");
  lines.push(
    `If ${name} took your payment and [${renderEditorNote("describe the failure: goods not delivered / service not completed / booking cancelled")}], and your card payment meets these criteria, you have a Section 75 claim against your card provider — not just against the retailer.`
  );
  lines.push("");
  lines.push(
    "**Deposits and part-payments:** Section 75 can apply even where only part of the price was paid by credit card, provided the total cash price was more than £100 and no more than £30,000 and the other criteria are met. A deposit payment may be sufficient to support a Section 75 claim, provided the other criteria are met."
  );
  lines.push("");
  lines.push(
    "**Third-party purchases:** If you bought through a third-party marketplace rather than directly from the company, Section 75 may not apply — the contract must be between you and the retailer. If you are unsure, [check your eligibility](/) before proceeding."
  );
  lines.push("");
  lines.push(
    renderEditorNote(
      `add any sector-specific edge cases for ${sectorLabel(candidate.sector)} — ` +
      "e.g. bespoke orders, part-delivered goods, gift purchases, business purchases on personal cards"
    )
  );
  lines.push("");

  // ── Evidence ──────────────────────────────────────────────────────────────
  lines.push("## What evidence to gather");
  lines.push("");
  lines.push(
    "Gather the following before making your claim. Having this ready will speed up your bank's investigation."
  );
  lines.push("");
  evidence.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push(
    renderEditorNote("add any additional evidence specific to this case or company type")
  );
  lines.push("");

  // ── How to claim ──────────────────────────────────────────────────────────
  lines.push("## How to make the claim");
  lines.push("");
  lines.push(
    "The full claims process is covered in the [Section 75 master guide](/guide/). In brief:"
  );
  lines.push("");
  lines.push(
    "1. **Write to your card provider** citing Section 75 of the Consumer Credit Act 1974 and explaining why the criteria are met. Include your evidence."
  );
  lines.push(
    "2. **Wait up to eight weeks** for a formal response. Providers are required to respond within this period under FCA rules."
  );
  lines.push(
    "3. **If rejected, escalate to the Financial Ombudsman Service.** Banks routinely reject valid claims at first attempt. The FOS upholds a significant proportion of Section 75 appeals — see [how to escalate to the FOS](/guide/financial-ombudsman/)."
  );
  lines.push("");

  // ── What your bank will say ───────────────────────────────────────────────
  lines.push("## What your bank will say");
  lines.push("");
  lines.push(
    "Banks often reject valid Section 75 claims at first attempt. Here are the most common responses for this type of claim, and how to rebut them."
  );
  lines.push("");
  rejections.forEach(({ rejection, rebuttal }) => {
    lines.push(`**${rejection}**`);
    lines.push("");
    lines.push(rebuttal);
    lines.push("");
  });
  lines.push(
    renderEditorNote("add any bank responses specific to this case or sector")
  );
  lines.push("");

  // ── FOS escalation ────────────────────────────────────────────────────────
  lines.push("## If your bank refuses");
  lines.push("");
  lines.push(
    `If your card provider rejects your Section 75 claim, you can escalate for free to the [Financial Ombudsman Service](/guide/financial-ombudsman/). The FOS is independent of the banks. You must give your bank eight weeks to respond — or receive a final response letter — before the FOS will accept your case.`
  );
  lines.push("");
  lines.push(
    "FOS backlogs mean cases can take months to resolve. This is normal and does not mean your case is weak. Submit your complaint, keep copies of all correspondence, and follow up if you have not heard within 12 weeks."
  );
  lines.push("");

  // ── Claim pack CTA ────────────────────────────────────────────────────────
  lines.push("## Get help writing your claim letter");
  lines.push("");
  lines.push(
    `The Section 75 claim pack (£6.99) includes a pre-written claim letter with the correct legal citations under the Consumer Credit Act 1974, a follow-up letter for use if your bank is slow to respond, and a rejection rebuttal for use if your bank declines. The templates are designed for ${sectorLabel(candidate.sector)} claims and cover common Section 75 disputes, including non-delivery, faulty goods, goods not as described, and business failure.`
  );
  lines.push("");
  lines.push("[Get the claim pack — £6.99](/claim-pack/)");
  lines.push("");

  // ── Disclaimer (foot) ─────────────────────────────────────────────────────
  lines.push("---");
  lines.push("");
  lines.push(
    "> This page provides general information about Section 75 of the Consumer Credit Act 1974. It is not legal advice for your specific situation. We do not act for you, represent you to your bank, or handle claims on your behalf. For advice tailored to your circumstances, contact a solicitor or the Citizens Advice consumer helpline."
  );
  lines.push("");

  // ── Internal footer ───────────────────────────────────────────────────────
  lines.push("{/*");
  lines.push("  Mandatory internal links — confirm all are present before publishing:");
  lines.push("  [x] /guide/ (master guide) — at least two links");
  lines.push("  [x] / (eligibility checker)");
  lines.push("  [x] /claim-pack/");
  lines.push("  [x] /guide/financial-ombudsman/");
  lines.push(
    `  [ ] /category/${candidateSlug.split("-")[0]}/ or relevant category page (if it exists)`
  );
  lines.push("*/}");

  return lines.join("\n");
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { briefPath: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--brief" && args[i + 1]) {
      options.briefPath = args[++i];
    }
  }
  return options;
}

function writeDraft(candidateSlug, content) {
  mkdirSync(DRAFTS_DIR, { recursive: true });
  const filePath = join(DRAFTS_DIR, `draft-${candidateSlug}.mdx`);
  writeFileSync(filePath, content, "utf8");
  console.log(
    `  Written: ${filePath.replace(__dirname, "tools/hook-finder")}`
  );
  return filePath;
}

function processSingleBrief(briefPath, summary) {
  const candidateSlug = slugFromBriefPath(briefPath);
  console.log(`Brief slug: ${candidateSlug}`);

  const candidate = findCandidateBySlug(candidateSlug, summary);
  const validation = validateForDraft(candidate);
  if (!validation.ok) {
    console.error(`  Cannot generate draft: ${validation.reason}`);
    process.exit(1);
  }

  const name = candidate.trading_name ?? candidate.company_name;
  console.log(
    `Generating draft for: ${name} (score: ${candidate.total_score}/100)`
  );
  const draft = generateDraft(candidate, briefPath);
  writeDraft(candidateSlug, draft);
}

function processAllNeedsReview(summary) {
  if (summary.needs_review.length === 0) {
    console.log(
      "No needs_review candidates in summary.json. Run the hook-finder first, or check candidate scores."
    );
    return;
  }

  console.log(
    `Generating drafts for ${summary.needs_review.length} needs_review candidate(s):`
  );
  for (const candidate of summary.needs_review) {
    const validation = validateForDraft(candidate);
    const name = candidate.trading_name ?? candidate.company_name ?? "unnamed";
    if (!validation.ok) {
      console.warn(`  Skipping "${name}": ${validation.reason}`);
      continue;
    }
    const candidateSlug = slug(name);
    console.log(`  ${name} (score: ${candidate.total_score}/100)`);
    const draft = generateDraft(candidate, null);
    writeDraft(candidateSlug, draft);
  }
}

function run() {
  const options = parseArgs(process.argv);

  console.log("\n=== Hook Finder — Page Draft Generator (Phase 5A) ===");
  console.log("");

  const summary = loadSummary();
  console.log(`Summary date: ${summary.date} | Mode: ${summary.mode}`);
  console.log(`Needs review: ${summary.counts.needs_review} | Monitoring: ${summary.counts.monitoring} | Rejected: ${summary.counts.rejected}`);
  console.log("");
  console.log("Output directory: tools/hook-finder/output/page-drafts/");
  console.log(
    "Drafts are INTERNAL REVIEW DOCUMENTS. Do not move to src/content/ without editorial review."
  );
  console.log("");

  if (options.briefPath) {
    processSingleBrief(options.briefPath, summary);
  } else {
    processAllNeedsReview(summary);
  }

  console.log("");
  console.log("Done. Review all [EDITOR: ...] placeholders before passing to a writer.");
  console.log(
    "Do not move drafts to src/content/trigger/ until all facts are independently verified.\n"
  );
}

run();
