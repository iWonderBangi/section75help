# Hook Finder — Internal Workflow Tool

## What this tool does

Hook Finder is a local prototype for identifying UK B2C company distress events that may warrant
a future Section 75 hook page on section75help.co.uk.

It does four things:

1. **Validates** live input candidates, clamping scores, flagging ambiguous identifiers, and
   dropping candidates that are missing required fields.
2. **Scores** candidates against five dimensions (B2C fit, consumer loss likelihood, search demand,
   source confidence, and commercial fit).
3. **Generates a daily Markdown report** classifying candidates as `needs_review`, `monitoring`,
   or `rejected`, with a full source breakdown per candidate.
4. **Generates a page brief** for any candidate that reaches `needs_review` status. The brief
   is a planning document only — it does not create or publish a page.

## What this tool does not do

- It does not publish anything. No Astro page is created, no content goes live.
- It does not verify company facts. All verification is a human responsibility.
- It does not represent users to their banks or handle claims on their behalf.
- It does not fabricate insolvency facts, customer numbers, or search demand figures.
- It does not commit any data to the repository.

## How to run it

```
# Mock mode — uses static sample data, no API calls
npm run hook-finder

# Live mode — reads data/live-input.json, calls Companies House API and Gazette adapter
npm run hook-finder:live

# Live mode with a custom input file
node tools/hook-finder/run.js --input path/to/input.json

# Run the test checks (no API key required)
npm run hook-finder:test
```

Output is written to `tools/hook-finder/output/` (git-ignored):

- `report-YYYY-MM-DD.md` — mock mode report
- `report-YYYY-MM-DD-live.md` — live mode report
- `brief-[company-slug].md` — one brief per `needs_review` candidate

## GitHub Actions workflow

The workflow at `.github/workflows/hook-finder.yml` runs the hook-finder automatically
and uploads the report as a downloadable artifact. It does not publish pages, create issues,
send notifications, or modify the public site in any way.

### Schedule

Runs daily at **07:00 UTC** (07:00 GMT in winter / 08:00 BST in summer).

### Triggering manually

1. Go to the repository on GitHub.
2. Click **Actions** in the top navigation bar.
3. Select **Hook Finder** from the left-hand workflow list.
4. Click **Run workflow** → **Run workflow**.

The run will appear in the list within a few seconds.

### Finding the report artifact

1. Open the completed workflow run.
2. Scroll to the **Artifacts** section at the bottom of the run summary.
3. Download `hook-finder-report-<run-id>`.

The artifact contains:
- `report-YYYY-MM-DD-live.md` — the scored candidate report
- `brief-[company-slug].md` — one brief per candidate that reached `needs_review` (if any)

Artifacts are retained for **30 days** and then deleted automatically.

### Configuring the Companies House API key

If `COMPANIES_HOUSE_API_KEY` is not set, the workflow continues safely — Companies House
enrichment is skipped and a warning is logged per candidate. Reports are still generated.

To enable full enrichment:

1. Get a free key at https://developer.company-information.service.gov.uk/
2. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `COMPANIES_HOUSE_API_KEY`
4. Value: your key
5. Save. The next workflow run will pick it up automatically.

Never commit the key to the repository.

### What input data does the CI workflow use?

The `hook-finder:ci` script runs against `tools/hook-finder/data/live-input.example.json`,
which is committed to the repository. This file contains placeholder candidates and is safe
to use in CI — it will not produce real enrichment results, but it validates that the full
pipeline (validation, dedup, enrichment, scoring, report generation) runs without error.

To monitor real candidates in CI, replace the contents of `live-input.example.json` with
actual company data and commit that file. Unlike `live-input.json` (which is git-ignored),
`live-input.example.json` is tracked, so any changes will be picked up by the next run.

### Safety notes

- **Artifact reports are for human review only.** No page should be created without
  independent verification of all facts against official primary sources.
- **Workflow failure does not affect the public website.** The hook-finder is a separate
  internal tool. A failing run produces no side-effects outside its own output directory.
- **No credentials are stored in the workflow file.** The API key is read from a GitHub
  Actions secret at runtime and is never echoed to logs.

## GitHub Issue delivery

When the workflow runs, it checks whether any candidates reached `needs_review` status.

### When an issue IS created

- One or more candidates scored 80+ with sufficient source confidence.
- A GitHub Issue is opened titled `Hook Finder candidates needing review — YYYY-MM-DD`.
- The issue body includes: summary counts, each needs_review candidate with its score
  breakdown, risk level, source links, verified facts, unverified signals, editorial
  cautions, recommended action, and a link to the workflow run artifact.
- Labels applied: `hook-finder`, `needs-review`, `content-opportunity`.

### When an issue is NOT created

- No candidates reached `needs_review` status.
- The workflow logs: "No needs_review candidates found. Artifact uploaded only."
- The artifact is still uploaded regardless.

### Duplicate prevention

Before creating an issue, the script lists open issues labelled `hook-finder` and checks
whether one with the same title already exists. If it does, no duplicate is created and
the URL of the existing issue is logged.

### Reviewing an issue

1. Open the issue from the GitHub Issues tab.
2. Read the editorial cautions and "still needed" items for each candidate.
3. Independently verify all facts against the Gazette and Companies House before drafting.
4. Download the workflow artifact for the full scored report and any generated page briefs.
5. Close the issue once reviewed, whether or not a page is drafted.

**A GitHub Issue does not mean a page should be published.** It means a human editor
should review the evidence and decide. No page should be drafted until all facts have
been independently verified against official primary sources.

### Testing issue body generation locally (dry run)

Run the hook-finder first to generate `output/summary.json`, then:

```
npm run hook-finder          # generates summary.json from mock data
npm run hook-finder:issue-dry-run   # prints the issue title and body, no API calls
```

This lets you preview exactly what would be posted to GitHub without creating an issue.
No `GITHUB_TOKEN` is required for dry-run mode.

### No manual GitHub settings needed

Issue creation uses the built-in `GITHUB_TOKEN` provided by GitHub Actions. No additional
secrets are required. The token has `issues: write` permission, which is declared in the
workflow file.

## Using a real Companies House API key

Live mode calls the Companies House public API. You need a free API key.

### 1. Get a key

Register at https://developer.company-information.service.gov.uk/ and create an application.
The free tier covers all usage required by this tool.

### 2. Set the key in your shell — do not commit it

**macOS / Linux (bash or zsh):**
```bash
export COMPANIES_HOUSE_API_KEY=your_key_here
```
Add this line to `~/.bashrc`, `~/.zshrc`, or a local `.env.local` file that is gitignored.
Never add it to a file that gets committed.

**Windows PowerShell:**
```powershell
$env:COMPANIES_HOUSE_API_KEY = "your_key_here"
```
To persist across sessions, add it to your PowerShell profile (`$PROFILE`) or set it as a
user environment variable in System Properties. Never hard-code it in a script file.

### 3. Verify it is set

```bash
echo $COMPANIES_HOUSE_API_KEY      # macOS / Linux
echo $env:COMPANIES_HOUSE_API_KEY  # PowerShell
```

### 4. Run in live mode

```
npm run hook-finder:live
```

If the key is missing or incorrect, the tool will print a clear error message and continue
without the Companies House data (warnings are collected per candidate, not crashes).

### What the key is used for

The tool calls two endpoints per candidate:
- `GET /company/{company_number}` — confirms legal name, status, and address
- `GET /company/{company_number}/insolvency` — confirms insolvency type, practitioners, and date

No write operations are performed. Rate limits are generous for manual use.

### Security

- **Never commit the key.** `data/live-input.json` and `output/` are git-ignored.
  The `.env` file is also git-ignored by the root `.gitignore`.
- **Never hardcode the key** in `companies-house.js` or any other file.
- If you suspect a key has been exposed, revoke it immediately in the Companies House
  developer portal and generate a replacement.

## Preparing a live-input.json file

Copy the example and edit it:

```
cp tools/hook-finder/data/live-input.example.json tools/hook-finder/data/live-input.json
```

`live-input.json` is git-ignored. Fill in real candidate details. The file is a JSON array.
Required fields per entry: `sector`, and at least one of `company_number`, `trading_name`,
or `company_name`. All other fields are optional but improve scoring accuracy.

See `data/live-input.example.json` for the full field list and annotations.

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

**The low-confidence override:** If `source_confidence_score` is below 10, the candidate is
capped at `monitoring` regardless of its total score. A high B2C fit score alone is not
sufficient to justify publishing claims about a company without official insolvency evidence.

**Live mode confidence deltas:** The Companies House adapter adds up to +14 to
`source_confidence_score` (6 for a confirmed company record, 8 for a confirmed insolvency case).
The Gazette URL adapter adds +3 for a confirmed URL. A Gazette fixture adds +10.

## Validation and duplicate detection

**Validation** runs before enrichment. Candidates are dropped if they are missing `sector` and
all identifiers. Scores outside their legal range are clamped with a warning. Missing
`company_number` or a generic company name triggers `ambiguous_company = true`.

**Duplicate detection** runs after validation, before enrichment, to avoid redundant API calls:
- Same `company_number` → the later entry is merged into the earlier one. Higher scores win.
- Same `primary_source_url`, different numbers → both are kept, but the later entry is flagged.

## Live-mode report sections

Each candidate in a live-mode report has five sections:

1. **API-confirmed facts** — data returned directly by the Companies House API. Treat as verified.
2. **Manually supplied facts** — data from the input file or a Gazette fixture. Check against the
   original notice before drafting.
3. **Unverified signals** — signals from non-official sources (press, reviews, overdue filings).
   Do not present these as facts in any published page.
4. **Editorial cautions** — specific blockers the editor must resolve before drafting.
5. **Still needed** — a computed list of what is currently unknown and required before a page
   can be drafted.

## Why human review is required before publishing

Section 75 hook pages make factual claims about specific companies and specific insolvency events.
Publishing inaccurate or unverified claims creates legal risk (defamation, misleading information),
reputational risk (the site's credibility depends on accuracy), and commercial risk (FCA scrutiny
if we appear to be making false representations that prompt consumers to make unfounded claims).

A human editor must, before any page is drafted:

1. Confirm the insolvency notice against the Gazette or Companies House.
2. Verify the administrator's name and firm from the official notice.
3. Confirm the consumer impact from a named source — do not estimate.
4. Check whether ATOL, ABTA, or other protection schemes apply (travel companies).
5. Ensure the page does not promise a refund outcome or imply we act on the customer's behalf.

## Phase 2C additions

- A live Gazette RSS feed parser to surface new notices automatically.
- A search demand estimator (Google Trends or DataForSEO API).
- A completed candidates archive (JSON or SQLite) so re-runs do not re-process known companies.
- A simple review UI or CLI prompt to approve a candidate and trigger brief generation.

## File structure

```
tools/hook-finder/
  data/
    candidates.js                  Mock candidate data (Phase 1, used in mock mode)
    live-input.example.json        Template for live candidate input (commit this)
    live-input.json                Your actual live candidates (git-ignored)
    fixtures/
      gazette-notice.example.json  Gazette fixture schema for ingestFromFixture()
  output/                          Generated reports and briefs (git-ignored)
  sources/
    companies-house.js             Companies House API client
    gazette.js                     Gazette adapter (fixture + URL)
    index.js                       Adapter registry and merger
  briefer.js                       Page brief generator
  dedup.js                         Duplicate detection
  reporter.js                      Daily Markdown report generator
  run.js                           CLI entry point
  scorer.js                        Scoring and classification logic
  test.js                          Adapter-level test checks
  validate.js                      Input validation
  README.md                        This file
```
