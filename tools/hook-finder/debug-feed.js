#!/usr/bin/env node
// Fetches the Gazette insolvency feed and prints raw entry data.
// Use this to inspect what terms and title formats the feed actually uses.
//
// Usage:
//   node tools/hook-finder/debug-feed.js
//   node tools/hook-finder/debug-feed.js --hours 72   (look back 72 hours instead of 25)

const GAZETTE_FEED_URL = "https://www.thegazette.co.uk/insolvency/data.feed";

function parseArgs(argv) {
  const args = argv.slice(2);
  let hours = 72; // wider window for debugging
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--hours" && args[i + 1]) hours = Number(args[++i]);
  }
  return { hours };
}

async function run() {
  const { hours } = parseArgs(process.argv);

  console.log(`\nFetching: ${GAZETTE_FEED_URL}`);
  console.log(`Lookback: ${hours} hours\n`);

  let xml;
  try {
    const res = await fetch(GAZETTE_FEED_URL, {
      headers: { Accept: "application/atom+xml, application/xml, text/xml, */*" },
    });
    console.log(`HTTP status: ${res.status} ${res.statusText}`);
    console.log(`Content-Type: ${res.headers.get("content-type")}\n`);
    if (!res.ok) {
      console.error("Feed returned an error status. Exiting.");
      process.exit(1);
    }
    xml = await res.text();
  } catch (err) {
    console.error(`Fetch failed: ${err.message}`);
    process.exit(1);
  }

  console.log(`Feed size: ${xml.length} bytes`);
  console.log(`Contains <entry>: ${xml.includes("<entry>") || xml.includes("<entry ")}`);
  console.log(`Contains <feed>:  ${xml.includes("<feed")}\n`);

  // Print the first 1,000 chars of the raw XML so we can see the structure.
  console.log("=== First 1,000 chars of raw XML ===");
  console.log(xml.slice(0, 1000));
  console.log("\n=== End of sample ===\n");

  // Extract all entries.
  const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/g;
  const entries = [];
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    entries.push(match[1]);
  }
  console.log(`Total <entry> blocks found: ${entries.length}\n`);

  if (entries.length === 0) {
    console.log("No entries found — the feed may use a different XML format.");
    console.log("Check the raw XML above for the actual structure.");
    return;
  }

  const cutoff = Date.now() - hours * 60 * 60 * 1000;

  // Print details of every entry.
  entries.forEach((entry, i) => {
    const title = extractTag(entry, "title") ?? "(no title)";
    const link = extractLinkHref(entry) ?? "(no link)";
    const published = extractTag(entry, "published") ?? extractTag(entry, "updated") ?? "(no date)";
    const term = extractCategoryTerm(entry) ?? "(no category term)";
    const label = extractCategoryLabel(entry) ?? "(no category label)";

    const age = published !== "(no date)"
      ? Math.round((Date.now() - new Date(published).getTime()) / 3600000) + "h ago"
      : "unknown age";

    const withinWindow = published !== "(no date)" && new Date(published).getTime() >= cutoff;

    console.log(`--- Entry ${i + 1} ---`);
    console.log(`  Title:     ${title}`);
    console.log(`  Term:      ${term}`);
    console.log(`  Label:     ${label}`);
    console.log(`  Published: ${published} (${age})`);
    console.log(`  In window: ${withinWindow}`);
    console.log(`  Link:      ${link}`);
    console.log("");
  });
}

function extractTag(xml, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  if (!m) return null;
  return m[1].trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function extractLinkHref(xml) {
  const alt = /<link[^>]+rel="alternate"[^>]+href="([^"]+)"/.exec(xml);
  if (alt) return alt[1];
  const any = /<link[^>]+href="([^"]+)"/.exec(xml);
  return any ? any[1] : null;
}

function extractCategoryTerm(xml) {
  const m = /<category[^>]+term="([^"]+)"/.exec(xml);
  return m ? m[1] : null;
}

function extractCategoryLabel(xml) {
  const m = /<category[^>]+label="([^"]+)"/.exec(xml);
  return m ? m[1] : null;
}

run();
