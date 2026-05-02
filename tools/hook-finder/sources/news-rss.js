// Monitors UK business news RSS feeds for insolvency/distress signals.
// Returns notice-shaped objects compatible with buildCandidateFromNotice.
//
// Runs alongside the Gazette source in RSS mode — does NOT replace it.
// News breaks hours or days before the Gazette publishes formal notices,
// giving earlier signal on high-volume, household-name events.
//
// Source confidence is lower than Gazette (6 vs 8) — news reports can be
// inaccurate or premature. CH enrichment will validate and confirm.

const NEWS_FEEDS = [
  {
    name: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    format: "rss",
  },
  {
    name: "Guardian Business",
    url: "https://www.theguardian.com/uk/business/rss",
    format: "atom",
  },
  {
    name: "Sky News Business",
    url: "https://feeds.skynews.com/feeds/rss/business.xml",
    format: "rss",
  },
];

// Must appear in the headline (case-insensitive) to trigger extraction.
const DISTRESS_KEYWORDS = [
  "administration",
  "liquidation",
  "administrators",
  "receivers appointed",
  "went bust",
  "gone bust",
  "ceased trading",
  "insolvency",
  "insolvent",
  "winding up",
  "wound up",
  "creditors voluntary",
  "collapsed into",
];

// Patterns to extract the company name from a headline.
// Applied in order — first match wins.
// Group 1 is always the company name, except where noted.
const HEADLINE_PATTERNS = [
  // "Wilko enters/entered administration/liquidation"
  /^(.+?)\s+(?:enters?|entered|has entered)\s+(?:into\s+)?(?:administration|liquidation|receivership)/i,
  // "Paperchase collapses into administration"
  /^(.+?)\s+(?:collapses?|collapsed|has collapsed)\s+(?:into\s+)?(?:administration|liquidation)/i,
  // "Ted Baker goes/went into administration"
  /^(.+?)\s+(?:goes?|went|going)\s+(?:into\s+)?(?:administration|liquidation)/i,
  // "Wilko calls/called in administrators"
  /^(.+?)\s+(?:calls?|called|has called)\s+in\s+(?:administrators?|receivers?)/i,
  // "Joules appoints/appointed administrators"
  /^(.+?)\s+(?:appoints?|appointed|has appointed)\s+(?:new\s+)?(?:administrators?|receivers?)/i,
  // "Body Shop to enter administration"
  /^(.+?)\s+to\s+(?:enter|go\s+into)\s+(?:administration|liquidation)/i,
  // "Administrators appointed at/to/for Debenhams"
  /^(?:administrators?|receivers?)\s+appointed\s+(?:at|to|for)\s+(.+?)(?:\s+(?:as|after|with|amid)|[,–-]|$)/i,
  // "Wilko administrator appointed"
  /^(.+?)\s+administrators?\s+appointed/i,
  // "HMV goes bust"
  /^(.+?)\s+(?:goes?|went)\s+bust/i,
  // "Caffè Nero ceases trading"
  /^(.+?)\s+(?:ceases?|ceased)\s+trading/i,
];

// Noise words that sometimes prefix the company name in headlines.
// e.g. "Retailer Wilko enters administration" → strip "Retailer "
const NOISE_PREFIX = /^(?:retailer|fashion\s+brand|high\s+street\s+(?:chain|retailer|brand)|coffee\s+chain|restaurant\s+chain|gym\s+chain|holiday\s+firm|travel\s+(?:firm|company|operator)|estate\s+agent(?:s)?|car\s+dealer(?:s)?|furniture\s+(?:retailer|chain)|clothing\s+(?:brand|chain)|jeweller[sy]?|bookmaker[s]?|pharmacy\s+chain)\s+/i;

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchNewsAlerts({ lookbackHours = 48 } = {}) {
  const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000;
  const alerts = [];

  for (const feed of NEWS_FEEDS) {
    let items;
    try {
      items = await fetchFeed(feed, cutoff);
    } catch (err) {
      console.warn(`  [news] ${feed.name}: ${err.message}`);
      continue;
    }
    if (items.length > 0) {
      console.log(`  ${feed.name}: ${items.length} alert(s)`);
    }
    alerts.push(...items);
  }

  return alerts;
}

// ─── Feed fetching ────────────────────────────────────────────────────────────

async function fetchFeed(feed, cutoff) {
  const res = await fetch(feed.url, {
    headers: {
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  const items =
    feed.format === "atom" ? parseAtom(xml) : parseRss(xml);

  const matches = [];
  for (const item of items) {
    if (item.publishedAt && new Date(item.publishedAt).getTime() < cutoff)
      continue;

    const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();
    const hasKeyword = DISTRESS_KEYWORDS.some((kw) => text.includes(kw));
    if (!hasKeyword) continue;

    const company = extractCompany(item.title);
    if (!company) continue;

    matches.push({
      companyName: company,
      term: "news-alert",
      insolvencyType: inferType(item.title),
      noticeUrl: item.link,
      publishedAt: item.publishedAt,
      sourceName: feed.name,
    });
  }

  return matches;
}

// ─── XML parsers ──────────────────────────────────────────────────────────────

function parseRss(xml) {
  const items = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = extractTag(block, "title");
    if (!title) continue;
    const link =
      extractTag(block, "link") ?? extractLinkHref(block);
    const pub =
      extractTag(block, "pubDate") ?? extractTag(block, "dc:date");
    const summary = extractTag(block, "description");
    items.push({
      title: cleanText(title),
      link,
      publishedAt: pub ? new Date(pub).toISOString() : null,
      summary: summary ? cleanText(summary) : null,
    });
  }
  return items;
}

function parseAtom(xml) {
  const items = [];
  const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = extractTag(block, "title");
    if (!title) continue;
    const link = extractLinkHref(block);
    const pub =
      extractTag(block, "published") ?? extractTag(block, "updated");
    const summary =
      extractTag(block, "summary") ?? extractTag(block, "content");
    items.push({
      title: cleanText(title),
      link,
      publishedAt: pub ?? null,
      summary: summary ? cleanText(summary) : null,
    });
  }
  return items;
}

// ─── Extraction helpers ───────────────────────────────────────────────────────

function extractCompany(title) {
  for (const pattern of HEADLINE_PATTERNS) {
    const m = pattern.exec(title);
    if (!m) continue;

    let name = m[1].trim();

    // Strip noise prefixes ("Retailer X" → "X")
    name = name.replace(NOISE_PREFIX, "").trim();

    // Strip trailing punctuation
    name = name.replace(/[,:;.!?]+$/, "").trim();

    // Sanity checks: too short, too long, or just generic words
    if (name.length < 2) continue;
    if (name.split(/\s+/).length > 8) continue;
    if (/^(?:the|a|an)$/i.test(name)) continue;

    return name;
  }
  return null;
}

function inferType(title) {
  const t = title.toLowerCase();
  if (t.includes("administration")) return "administration";
  if (t.includes("liquidation")) return "liquidation";
  if (t.includes("receivership") || t.includes("receiver")) return "receivership";
  if (t.includes("winding up") || t.includes("wound up"))
    return "compulsory-liquidation";
  return "insolvency";
}

function extractTag(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(
    `<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`,
    "i"
  ).exec(xml);
  return m ? decodeEntities(m[1].trim()) : null;
}

function extractLinkHref(xml) {
  const alt = /<link[^>]+rel="alternate"[^>]+href="([^"]+)"/.exec(xml);
  if (alt) return alt[1];
  const any = /<link[^>]+href="([^"]+)"/.exec(xml);
  return any ? any[1] : null;
}

function cleanText(str) {
  return decodeEntities(str.replace(/<[^>]+>/g, "").trim());
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
