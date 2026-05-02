// Fetches and parses the Gazette insolvency Atom feed.
// Returns candidate-shaped objects ready for the scoring pipeline.
//
// Only initial appointment notices are included — progress reports, proposals,
// and petitions are excluded. Notices older than lookbackHours are dropped.
//
// No Companies House calls here — that is handled by companies-house.js.
// SIC-based sector classification uses the chSearchResult passed to buildCandidate().

const GAZETTE_FEED_URL = "https://www.thegazette.co.uk/insolvency/data.feed";

// Gazette category terms for initial insolvency appointments only.
// These are the exact human-readable strings the feed uses in <category term="...">.
// Progress reports, proposals, and petitions are excluded.
// Bankruptcy Orders are excluded — they refer to individuals, not companies.
const APPOINTMENT_TERMS = new Set([
  "Appointment of Administrators",
  "Appointment of Administrative Receivers",
  "Appointment of Liquidators",
  "Appointment of Receivers",
  "Resolutions for Winding-up",
  "Winding-Up Orders",
]);

// Map Gazette category terms to our insolvency_type values.
const TERM_TO_INSOLVENCY_TYPE = {
  "Appointment of Administrators": "administration",
  "Appointment of Administrative Receivers": "administrative-receivership",
  "Appointment of Liquidators": "liquidation",
  "Appointment of Receivers": "receivership",
  "Resolutions for Winding-up": "creditors-voluntary-liquidation",
  "Winding-Up Orders": "compulsory-liquidation",
};

// SIC code prefix → sector + initial B2C/loss scores.
// First matching prefix wins. Order from most specific to least specific.
const SIC_MAP = [
  // Furniture / home goods retail
  { prefix: "4759", sector: "furniture-retail",      b2c: 22, loss: 20 },
  { prefix: "4751", sector: "furniture-retail",      b2c: 20, loss: 18 },
  { prefix: "4752", sector: "furniture-retail",      b2c: 18, loss: 16 },
  // General retail
  { prefix: "47",   sector: "general-retail",        b2c: 20, loss: 18 },
  // Travel
  { prefix: "7911", sector: "travel",                b2c: 22, loss: 22 },
  { prefix: "7912", sector: "travel",                b2c: 22, loss: 22 },
  { prefix: "7990", sector: "travel",                b2c: 18, loss: 18 },
  { prefix: "79",   sector: "travel",                b2c: 18, loss: 18 },
  // Kitchen / home installation
  { prefix: "4321", sector: "kitchen-installation",  b2c: 18, loss: 20 },
  { prefix: "4322", sector: "kitchen-installation",  b2c: 18, loss: 20 },
  { prefix: "4329", sector: "kitchen-installation",  b2c: 16, loss: 18 },
  { prefix: "43",   sector: "home-improvement",      b2c: 16, loss: 18 },
  // Hospitality / food
  { prefix: "561",  sector: "hospitality",           b2c: 14, loss: 10 },
  { prefix: "563",  sector: "hospitality",           b2c: 14, loss: 12 },
  { prefix: "56",   sector: "hospitality",           b2c: 14, loss: 10 },
  // Education
  { prefix: "855",  sector: "education",             b2c: 16, loss: 16 },
  { prefix: "85",   sector: "education",             b2c: 12, loss: 12 },
  // Leisure / entertainment
  { prefix: "931",  sector: "leisure",               b2c: 14, loss: 12 },
  { prefix: "93",   sector: "leisure",               b2c: 12, loss: 10 },
  // Health / beauty (gyms, spas, clinics)
  { prefix: "861",  sector: "health-services",       b2c: 16, loss: 14 },
  { prefix: "869",  sector: "health-services",       b2c: 14, loss: 12 },
  { prefix: "960",  sector: "personal-services",     b2c: 14, loss: 10 },
  { prefix: "96",   sector: "personal-services",     b2c: 12, loss: 10 },
  // B2B — low B2C fit
  { prefix: "62",   sector: "b2b-software",          b2c: 2,  loss: 2  },
  { prefix: "63",   sector: "b2b-software",          b2c: 2,  loss: 2  },
  { prefix: "64",   sector: "b2b-financial",         b2c: 3,  loss: 3  },
  { prefix: "65",   sector: "b2b-financial",         b2c: 3,  loss: 3  },
  { prefix: "66",   sector: "b2b-financial",         b2c: 3,  loss: 3  },
  { prefix: "69",   sector: "b2b-professional",      b2c: 2,  loss: 3  },
  { prefix: "70",   sector: "b2b-professional",      b2c: 2,  loss: 3  },
  { prefix: "71",   sector: "b2b-professional",      b2c: 3,  loss: 3  },
  { prefix: "72",   sector: "b2b-professional",      b2c: 2,  loss: 2  },
  { prefix: "73",   sector: "b2b-professional",      b2c: 3,  loss: 3  },
  { prefix: "74",   sector: "b2b-professional",      b2c: 3,  loss: 3  },
  // Manufacturing — generally B2B
  { prefix: "10",   sector: "manufacturing",         b2c: 4,  loss: 4  },
  { prefix: "25",   sector: "manufacturing",         b2c: 4,  loss: 4  },
  { prefix: "26",   sector: "manufacturing",         b2c: 4,  loss: 4  },
  { prefix: "28",   sector: "manufacturing",         b2c: 4,  loss: 4  },
  { prefix: "29",   sector: "manufacturing",         b2c: 4,  loss: 4  },
];

// ─── Feed fetching ────────────────────────────────────────────────────────────

export async function fetchGazetteNotices({ lookbackHours = 25 } = {}) {
  let xml;
  try {
    const res = await fetch(GAZETTE_FEED_URL, {
      headers: { Accept: "application/atom+xml, application/xml, text/xml, */*" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from Gazette feed`);
    }
    xml = await res.text();
  } catch (err) {
    throw new Error(`Could not fetch Gazette insolvency feed: ${err.message}`);
  }

  if (!xml.includes("<entry>") && !xml.includes("<entry ")) {
    throw new Error(
      "Gazette feed returned unexpected content — no <entry> elements found. " +
        "The feed URL may have changed or the service may be temporarily unavailable."
    );
  }

  const entries = parseAtomFeed(xml);
  const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000;

  return entries.filter((e) => {
    if (!APPOINTMENT_TERMS.has(e.term)) return false;
    if (e.publishedAt && new Date(e.publishedAt).getTime() < cutoff) return false;
    return true;
  });
}

// ─── Atom XML parser ──────────────────────────────────────────────────────────

function parseAtomFeed(xml) {
  const entries = [];
  const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = parseEntry(match[1]);
    if (entry) entries.push(entry);
  }
  return entries;
}

function parseEntry(xml) {
  const rawTitle = extractTag(xml, "title");
  const link = extractLinkHref(xml);
  const published =
    extractTag(xml, "published") ?? extractTag(xml, "updated");
  const term = extractCategoryTerm(xml);

  if (!rawTitle || !link) return null;

  const companyName = extractCompanyName(rawTitle);
  if (!companyName) return null;

  return {
    companyName,
    term: term ?? "",
    insolvencyType: TERM_TO_INSOLVENCY_TYPE[term] ?? "unknown",
    noticeUrl: link,
    publishedAt: published,
  };
}

function extractTag(xml, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  if (!m) return null;
  return decodeHtmlEntities(m[1].trim());
}

function extractLinkHref(xml) {
  // Prefer rel="alternate" or the first link with an href
  const alt = /<link[^>]+rel="alternate"[^>]+href="([^"]+)"/.exec(xml);
  if (alt) return alt[1];
  const any = /<link[^>]+href="([^"]+)"/.exec(xml);
  return any ? any[1] : null;
}

function extractCategoryTerm(xml) {
  const m = /<category[^>]+term="([^"]+)"/.exec(xml);
  return m ? m[1] : null;
}

function extractCompanyName(title) {
  // Primary format: "COMPANY NAME LTD: Appointment of Administrator"
  const colonIdx = title.indexOf(":");
  if (colonIdx > 0) {
    const raw = title.slice(0, colonIdx).replace(/<[^>]+>/g, "").trim();
    return raw ? toTitleCase(raw) : null;
  }
  // Fallback: use full title stripped of HTML
  const stripped = title.replace(/<[^>]+>/g, "").trim();
  return stripped || null;
}

function toTitleCase(str) {
  const alwaysLower = new Set(["and", "or", "the", "of", "in", "for", "a", "an", "at", "by", "to"]);
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) =>
      i === 0 || !alwaysLower.has(word)
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word
    )
    .join(" ");
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// ─── Sector classification ────────────────────────────────────────────────────

export function classifyBySic(sicCodes) {
  if (!sicCodes || sicCodes.length === 0) {
    return { sector: "unknown", b2c_fit_score: 10, consumer_loss_score: 12 };
  }
  for (const code of sicCodes) {
    const str = String(code).replace(/\s/g, "");
    for (const entry of SIC_MAP) {
      if (str.startsWith(entry.prefix)) {
        return {
          sector: entry.sector,
          b2c_fit_score: entry.b2c,
          consumer_loss_score: entry.loss,
        };
      }
    }
  }
  return { sector: "general", b2c_fit_score: 10, consumer_loss_score: 12 };
}

// ─── Candidate builder ────────────────────────────────────────────────────────

// Build a scoreable candidate from a Gazette notice + optional CH search result.
// chSearchResult: { company_number, company_name, sic_codes } | null
export function buildCandidateFromNotice(notice, chSearchResult) {
  const { sector, b2c_fit_score, consumer_loss_score } = chSearchResult?.sic_codes
    ? classifyBySic(chSearchResult.sic_codes)
    : { sector: "unknown", b2c_fit_score: 10, consumer_loss_score: 12 };

  const companyName = chSearchResult?.company_name ?? notice.companyName;
  const insolvencyLabel = notice.insolvencyType !== "unknown"
    ? notice.insolvencyType
    : "insolvency";
  const dateStr = notice.publishedAt ? notice.publishedAt.slice(0, 10) : "unknown date";

  return {
    company_name: companyName,
    trading_name: null,
    company_number: chSearchResult?.company_number ?? null,
    sector,
    insolvency_type: notice.insolvencyType,
    insolvency_date: notice.publishedAt ? notice.publishedAt.slice(0, 10) : null,
    primary_source_url: notice.noticeUrl,
    company_status: "unknown",

    // Source confidence starts at 8 — Gazette is an official primary source.
    // Companies House enrichment will add further via _confidence_delta.
    source_confidence_score: 8,
    b2c_fit_score,
    consumer_loss_score,
    search_demand_score: 8,
    commercial_fit_score: 7,

    verified_facts: [],
    api_confirmed_facts: [],
    unverified_signals: [
      `${companyName} entered ${insolvencyLabel} — notice published in the Gazette on ${dateStr}.`,
    ],
    editorial_cautions: [
      "Auto-discovered from Gazette RSS feed — verify all details against the official notice before drafting.",
    ],
  };
}
