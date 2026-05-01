# Hook Finder — Internal Workflow Tool

## What this tool does

Hook Finder is a local prototype for identifying UK B2C company distress events that may warrant
a future Section 75 hook page on section75help.co.uk.

It does three things:

1. **Scores** a list of candidate companies against five dimensions (B2C fit, consumer loss
   likelihood, search demand, source confidence, and commercial fit).
2. **Generates a daily Markdown report** classifying candidates as `needs_review`, `monitoring`,
   or `rejected`, with a score breakdown, source links, and a recommended action for each.
3. **Generates a page brief** for any candidate that reaches `needs_review` status. The brief
   outlines a suggested page title, target search queries, verified facts, safety wording, and
   a recommended CTA. It is a planning document, not a draft page.

## What this tool does not do

- It does not publish anything. No Astro page is created, no content goes live.
- It does not connect to any external API, scrape any website, or fetch live data.
- It does not verify company facts. All verification is a human responsibility.
- It does not represent users to their banks or handle claims on their behalf.
- It does not fabricate insolvency facts, customer numbers, or search demand figures.

## How to run it

```
node tools/hook-finder/run.js
```

Output is written to `tools/hook-finder/output/`:

- `report-YYYY-MM-DD.md` — the daily candidate report
- `brief-[company-slug].md` — one brief per `needs_review` candidate

The `output/` directory is git-ignored. Generated files are for local review only.

## How scoring works

Each candidate is scored on five dimensions. Scores are capped at their maximum values.

| Dimension | Max | What it measures |
|---|---|---|
| B2C fit | 25 | How consumer-facing the company is. B2B companies score very low. |
| Consumer loss likelihood | 25 | How likely affected customers hold credit card payments for undelivered goods. |
| Search demand | 20 | Estimated volume of "[company name] refund" and related queries. |
| Source confidence | 20 | Quality and officiality of the insolvency evidence (Gazette, Companies House, Insolvency Service). |
| Commercial fit | 10 | Whether the Section 75 claim pack is a natural next step for customers of this company. |
| **Total** | **100** | |

**Classification thresholds:**

| Score | Status | Meaning |
|---|---|---|
| 80–100 | `needs_review` | Brief generation is warranted. Verify all facts before drafting. |
| 60–79 | `monitoring` | Check again in 48 hours. Not ready for a brief. |
| Below 60 | `rejected` | No hook page warranted. Archive after 30 days with no change. |

**The low-confidence override:** If `source_confidence_score` is below 10 (no official notice
found), the candidate is capped at `monitoring` regardless of its total score. A high B2C fit
score is not sufficient to justify publishing claims about a company without official insolvency
evidence.

## Why human review is required before publishing

Section 75 hook pages make factual claims about specific companies and specific insolvency events.
Publishing inaccurate or unverified claims creates legal risk (defamation, misleading information),
reputational risk (the site's credibility depends on accuracy), and commercial risk (FCA scrutiny
if we appear to be making false representations that prompt consumers to make unfounded claims).

The hook finder is a recommendation engine. A human editor must:

1. Confirm the insolvency notice against the Gazette or Companies House before any page is drafted.
2. Verify the administrator's name and firm.
3. Confirm the consumer impact (number of customers, typical loss amounts) from a named source.
4. Check whether ATOL, ABTA, or other protection schemes apply (for travel companies).
5. Ensure the page does not promise a refund outcome or imply we act on the customer's behalf.

## Phase 2 additions

Phase 1 uses mock data only. Phase 2 should add:

- A live Gazette RSS feed parser to identify new insolvency notices daily.
- A Companies House API integration to pull filing history and director details.
- A search demand estimator (Google Trends, keyword tool API, or DataForSEO).
- Automated daily scheduling (cron or GitHub Actions) to run the scorer and post a Slack
  or email summary to the editorial team.
- A simple web UI or CLI flag to approve a candidate and trigger brief generation without
  editing the source file.
- A completed candidates archive (JSON or SQLite) so the tool remembers which companies
  have already been processed.

## File structure

```
tools/hook-finder/
  data/
    candidates.js       Mock candidate data (Phase 1)
  output/               Generated reports and briefs (git-ignored)
  briefer.js            Page brief generator
  reporter.js           Daily Markdown report generator
  run.js                CLI entry point
  scorer.js             Scoring and classification logic
  README.md             This file
```
