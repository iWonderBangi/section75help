// Gazette source adapter.
// Maps a Gazette notice to candidate model fields via two methods:
//
//   ingestFromFixture(fixture)
//     Accepts a structured JSON object representing a manually curated Gazette notice.
//     Use for testing, or when an analyst has already extracted the key fields.
//     Schema: see tools/hook-finder/data/fixtures/gazette-notice.example.json
//     Confidence delta: 10 (official notice, human-verified).
//
//   ingestFromUrl(url)
//     Accepts a Gazette notice URL. Confirms the URL resolves (HTTP 200) and records
//     it as the primary_source_url. Does NOT attempt to parse the HTML — The Gazette
//     does not expose a stable public JSON API, and HTML scraping is too fragile to
//     be reliable. All extracted data is placed in unverified_signals only.
//     Confidence delta: 3 (URL confirmed but not parsed).
//
// The Gazette adapter is deliberately conservative in Phase 2A. Full structured
// extraction from Gazette pages is deferred to Phase 2B.
//
// Safety rules:
// - ingestFromFixture only places data in verified_facts if the field is present
//   and non-empty in the fixture. Empty fields are left to Companies House or the editor.
// - ingestFromUrl never places anything in verified_facts — the URL resolves, but
//   the content has not been parsed or verified.
// - Neither method treats absence of a field as evidence of anything.

const GAZETTE_BASE = "https://www.thegazette.co.uk";

const NOTICE_TYPE_MAP = {
  "appointment of administrator": "administration",
  "appointment of joint administrators": "administration",
  "appointment of liquidator": "creditors-voluntary-liquidation",
  "appointment of joint liquidators": "creditors-voluntary-liquidation",
  "winding-up order": "compulsory-liquidation",
  "appointment of receiver": "receivership",
  "appointment of administrative receiver": "administrative-receivership",
  "voluntary arrangement": "voluntary-arrangement",
};

function mapNoticeType(raw) {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(NOTICE_TYPE_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "unknown";
}

// Ingest from a manually curated Gazette fixture (JSON object).
// Returns { ingested, warning, updates, confidenceDelta }
export function ingestFromFixture(fixture) {
  if (!fixture || typeof fixture !== "object") {
    return {
      ingested: false,
      warning: "Gazette fixture is invalid — expected a JSON object.",
      updates: {},
      confidenceDelta: 0,
    };
  }

  const verifiedFacts = [];
  const updates = {};

  if (fixture.notice_url) {
    updates.primary_source_url = fixture.notice_url;
    verifiedFacts.push(`Gazette notice URL recorded: ${fixture.notice_url}`);
  }

  if (fixture.company_name) {
    updates.company_name = fixture.company_name;
    verifiedFacts.push(`Company name from Gazette notice: ${fixture.company_name}`);
  }

  if (fixture.company_number) {
    updates.company_number = fixture.company_number;
    verifiedFacts.push(`Company number from Gazette notice: ${fixture.company_number}`);
  }

  if (fixture.notice_date) {
    updates.insolvency_date = fixture.notice_date;
    verifiedFacts.push(`Notice date from Gazette: ${fixture.notice_date}`);
  }

  const rawType = fixture.notice_type;
  const mappedType = fixture.insolvency_type ?? mapNoticeType(rawType);
  if (mappedType && mappedType !== "unknown") {
    updates.insolvency_type = mappedType;
    verifiedFacts.push(
      `Insolvency type from Gazette: ${rawType ?? mappedType}`
    );
  }

  const practitioners = fixture.practitioners ?? [];
  if (practitioners.length > 0) {
    const names = practitioners
      .map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`)
      .join("; ");
    verifiedFacts.push(`Practitioners from Gazette notice: ${names}`);
  }

  if (verifiedFacts.length === 0) {
    return {
      ingested: false,
      warning:
        "Gazette fixture contained no usable fields. Check the fixture against gazette-notice.example.json.",
      updates: {},
      confidenceDelta: 0,
    };
  }

  updates.verified_facts = verifiedFacts;
  updates.company_status = updates.insolvency_type ? "in-administration" : undefined;

  // A manually curated, human-verified Gazette notice is the strongest signal we have.
  return { ingested: true, warning: null, updates, confidenceDelta: 10 };
}

// Attempt to verify a live Gazette notice URL.
// Does NOT parse HTML. Records the URL and confirms it resolves.
// Returns { ingested, warning, updates, confidenceDelta }
export async function ingestFromUrl(noticeUrl) {
  if (!noticeUrl) {
    return {
      ingested: false,
      warning: "No URL provided to Gazette adapter.",
      updates: {},
      confidenceDelta: 0,
    };
  }

  if (!noticeUrl.startsWith(GAZETTE_BASE)) {
    return {
      ingested: false,
      warning:
        `URL does not appear to be a Gazette notice (expected ${GAZETTE_BASE}...): ${noticeUrl}. ` +
        "Record as secondary_source_url if it is a news source.",
      updates: { primary_source_url: noticeUrl },
      confidenceDelta: 1,
    };
  }

  let status;
  try {
    const response = await fetch(noticeUrl, {
      method: "HEAD",
      headers: { "User-Agent": "section75help-hook-finder/2a (internal-tool)" },
    });
    status = response.status;
  } catch (err) {
    return {
      ingested: false,
      warning: `Could not reach Gazette URL (${noticeUrl}): ${err.message}`,
      updates: { primary_source_url: noticeUrl },
      confidenceDelta: 1,
    };
  }

  if (status === 404) {
    return {
      ingested: false,
      warning:
        `Gazette URL returned 404 — notice may not exist or the ID may be wrong: ${noticeUrl}`,
      updates: {},
      confidenceDelta: 0,
    };
  }

  if (status !== 200) {
    return {
      ingested: false,
      warning: `Gazette URL returned ${status}: ${noticeUrl}. Verify manually.`,
      updates: { primary_source_url: noticeUrl },
      confidenceDelta: 1,
    };
  }

  // URL confirmed (HTTP 200). Record it and add a modest confidence delta.
  // Content is not parsed — all details must be verified manually against the notice.
  return {
    ingested: true,
    warning:
      "Gazette URL confirmed (HTTP 200). Notice content was not parsed — verify company name, " +
      "number, insolvency type, and date manually against the original notice before drafting.",
    updates: {
      primary_source_url: noticeUrl,
      unverified_signals: [
        `Gazette notice URL confirmed live: ${noticeUrl} — details not yet extracted`,
      ],
    },
    confidenceDelta: 3,
  };
}
