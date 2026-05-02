// Companies House API client.
// Enriches a candidate with official data from the Companies House public API.
//
// Authentication: HTTP Basic Auth — API key as username, empty password.
// Get a free key at https://developer.company-information.service.gov.uk/
//
// Set COMPANIES_HOUSE_API_KEY in your shell before running in live mode:
//   export COMPANIES_HOUSE_API_KEY=your_key_here   (macOS / Linux)
//   $env:COMPANIES_HOUSE_API_KEY="your_key_here"   (PowerShell)
//
// If the key is missing, this adapter fails with a clear message rather than
// silently skipping or degrading results.
//
// Important safety rules:
// - 404 on the company endpoint means the number is wrong or unregistered — not insolvency.
// - 404 on the insolvency endpoint means no insolvency record is filed yet.
//   Absence of an insolvency record does not confirm the company is solvent.
// - Only data returned directly from the API is placed in api_confirmed_facts.
// - Do not infer insolvency from company_status alone without the insolvency endpoint confirming it.

const BASE_URL = "https://api.company-information.service.gov.uk";

// Companies House status strings → our candidate model values.
const COMPANY_STATUS_MAP = {
  active: "active",
  dissolved: "dissolved",
  liquidation: "in-liquidation",
  receivership: "in-receivership",
  administration: "in-administration",
  "voluntary-arrangement": "voluntary-arrangement",
  "converted-closed": "closed",
  "insolvency-proceedings": "in-insolvency-proceedings",
};

// Companies House insolvency case types → our insolvency_type values.
const INSOLVENCY_TYPE_MAP = {
  "administration-order": "administration",
  "creditors-voluntary-liquidation": "creditors-voluntary-liquidation",
  "members-voluntary-liquidation": "members-voluntary-liquidation",
  receivership: "receivership",
  "administrative-receivership": "administrative-receivership",
  "voluntary-arrangement": "voluntary-arrangement",
  "court-order-winding-up": "compulsory-liquidation",
};

function requireApiKey() {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) {
    throw new Error(
      "COMPANIES_HOUSE_API_KEY is not set.\n" +
        "  macOS/Linux : export COMPANIES_HOUSE_API_KEY=your_key_here\n" +
        "  PowerShell  : $env:COMPANIES_HOUSE_API_KEY='your_key_here'\n" +
        "Get a free key at https://developer.company-information.service.gov.uk/"
    );
  }
  return key;
}

async function chFetch(path, apiKey) {
  const credentials = Buffer.from(`${apiKey}:`).toString("base64");
  const url = `${BASE_URL}${path}`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    throw new Error(`Network error reaching Companies House (${url}): ${err.message}`);
  }

  if (response.status === 404) return null;

  if (response.status === 401) {
    throw new Error(
      "Companies House API returned 401 Unauthorised. Check your COMPANIES_HOUSE_API_KEY is correct and active."
    );
  }

  if (response.status === 429) {
    throw new Error(
      "Companies House API rate limit reached (429). Wait a few seconds and try again."
    );
  }

  if (!response.ok) {
    throw new Error(
      `Companies House API returned ${response.status} for ${url}`
    );
  }

  return response.json();
}

function mapStatus(chStatus) {
  return COMPANY_STATUS_MAP[chStatus] ?? chStatus ?? "unknown";
}

function mapInsolvencyType(caseType) {
  return INSOLVENCY_TYPE_MAP[caseType] ?? caseType ?? "unknown";
}

// Search Companies House by company name.
// Used in RSS mode to find a company number from a Gazette notice title.
// Returns { company_number, company_name, sic_codes } or null.
// Returns null (does not throw) if the key is missing or the search fails.
export async function searchByName(name) {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) return null;

  const q = encodeURIComponent(name);
  let result;
  try {
    result = await chFetch(`/search/companies?q=${q}&items_per_page=5`, apiKey);
  } catch {
    return null;
  }

  if (!result || !Array.isArray(result.items) || result.items.length === 0) {
    return null;
  }

  // Prefer an exact normalised name match; fall back to the top result.
  const normalised = normaliseName(name);
  const match =
    result.items.find((item) => normaliseName(item.title ?? "") === normalised) ??
    result.items[0];

  return {
    company_number: match.company_number,
    company_name: match.title,
    sic_codes: match.sic_codes ?? [],
  };
}

function normaliseName(name) {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|plc|llp|lp|inc|corp|corporation)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Enrich a candidate with Companies House data.
// Returns { enriched: boolean, warning: string|null, updates: object }
// where `updates` is a partial candidate object to be merged by the caller.
export async function enrichFromCompaniesHouse(candidate) {
  const apiKey = requireApiKey();
  const { company_number } = candidate;

  if (!company_number) {
    return {
      enriched: false,
      warning: "No company_number on candidate — Companies House lookup skipped.",
      updates: {},
    };
  }

  // --- Core company record ---
  let company;
  try {
    company = await chFetch(`/company/${company_number}`, apiKey);
  } catch (err) {
    return {
      enriched: false,
      warning: `Companies House fetch failed for ${company_number}: ${err.message}`,
      updates: {},
    };
  }

  if (!company) {
    return {
      enriched: false,
      warning:
        `No record found at Companies House for company number ${company_number}. ` +
        "Verify the number is correct before treating the candidate as a valid lead.",
      updates: {},
    };
  }

  const newApiConfirmedFacts = [
    `Company name confirmed via Companies House API: ${company.company_name}`,
    `Company status via Companies House: ${company.company_status}`,
  ];

  const addr = company.registered_office_address;
  if (addr) {
    const addrStr = [addr.address_line_1, addr.locality, addr.postal_code]
      .filter(Boolean)
      .join(", ");
    if (addrStr) newApiConfirmedFacts.push(`Registered address (Companies House): ${addrStr}`);
  }

  const updates = {
    company_name: company.company_name,
    company_status: mapStatus(company.company_status),
    // Confirmed company record adds 6 to source_confidence_score (capped at 20 by index.js).
    _confidence_delta: 6,
    api_confirmed_facts: newApiConfirmedFacts,
    unverified_signals: [],
    editorial_cautions: [],
  };

  // --- Insolvency record ---
  let insolvency;
  try {
    insolvency = await chFetch(`/company/${company_number}/insolvency`, apiKey);
  } catch (err) {
    updates.editorial_cautions.push(
      `Companies House insolvency endpoint error: ${err.message}. Verify insolvency status manually before drafting.`
    );
    return { enriched: true, warning: null, updates };
  }

  if (!insolvency || !insolvency.cases?.length) {
    // Absence of an insolvency record at Companies House does not confirm the company is
    // solvent — the filing may not yet have appeared. Treat as an unverified signal only.
    updates.unverified_signals.push(
      "No insolvency case found at Companies House. The record may not yet be filed. " +
        "Do not treat absence as confirmation in either direction."
    );
    return { enriched: true, warning: null, updates };
  }

  // Use the first (most recent) case.
  const latestCase = insolvency.cases[0];
  updates.insolvency_type = mapInsolvencyType(latestCase.type);

  const practitioners = latestCase.practitioners ?? [];
  if (practitioners.length > 0) {
    const names = practitioners
      .map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`)
      .join("; ");
    updates.api_confirmed_facts.push(
      `Insolvency practitioners from Companies House: ${names}`
    );
  }

  // Appointment date from the earliest practitioner entry.
  const withDate = practitioners.filter((p) => p.appointed_on);
  if (withDate.length > 0) {
    const earliest = withDate.reduce((a, b) =>
      a.appointed_on <= b.appointed_on ? a : b
    );
    updates.insolvency_date = earliest.appointed_on;
    updates.api_confirmed_facts.push(
      `Insolvency appointment date from Companies House: ${earliest.appointed_on}`
    );
  }

  // Confirmed insolvency record adds a further 8 to source_confidence_score.
  updates._confidence_delta = (updates._confidence_delta ?? 0) + 8;

  return { enriched: true, warning: null, updates };
}
