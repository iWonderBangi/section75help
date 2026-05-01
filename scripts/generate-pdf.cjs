'use strict';
// scripts/generate-pdf.cjs
// Run with: node scripts/generate-pdf.cjs
// Output: public/downloads/section-75-claim-pack.pdf

const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const TEMPLATES_DIR = path.join(__dirname, '..', 'src', 'templates');
const OUT_DIR = path.join(__dirname, '..', 'public', 'downloads');
const OUT_FILE = path.join(OUT_DIR, 'section-75-claim-pack.pdf');

const DOCS = [
  { file: '01-cover-sheet.html',                    title: 'Cover Sheet and Decision Guide' },
  { file: '02-initial-claim-letter.html',            title: 'Initial Claim Letter' },
  { file: '03-evidence-cover-letter.html',           title: 'Evidence Cover Letter' },
  { file: '04-process-guide.html',                   title: 'Plain English Process Guide' },
  { file: '05-rejection-rebuttal-standard.html',     title: 'Rejection Rebuttal — Standard' },
  { file: '06-rejection-rebuttal-overseas.html',     title: 'Rejection Rebuttal — Overseas Purchase' },
  { file: '07-rejection-rebuttal-part-payment.html', title: 'Rejection Rebuttal — Part Payment on Card' },
  { file: '08-rejection-rebuttal-third-party.html',  title: 'Rejection Rebuttal — Third Party / Booking Agent' },
  { file: '09-fos-complaint-letter.html',            title: 'Financial Ombudsman Service Complaint Letter' },
];

// PDF options for document pages — running footer in the bottom margin
const DOC_PDF_OPTIONS = {
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="
      font-family: Arial, sans-serif; font-size: 7pt; color: #9ca3af;
      width: 100%; padding: 5px 2.5cm 0; box-sizing: border-box;
      border-top: 0.5px solid #e5e7eb;
      display: flex; justify-content: space-between; align-items: center;
    ">
      <span>Template for personal use only. Not legal advice. section75help.co.uk</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  `,
  margin: { top: '2.5cm', bottom: '2.5cm', left: '2.5cm', right: '2.5cm' },
};

// PDF options for the cover page — no running footer, margins handled by HTML
const COVER_PDF_OPTIONS = {
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: false,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
};

// ── Cover page HTML ────────────────────────────────────────────────────────

function buildCoverHtml(pageNumbers) {
  const rows = DOCS.map((doc, i) => `
    <tr>
      <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:9pt;width:10%;">${i + 1}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:9.5pt;">${doc.title}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:9pt;text-align:right;width:12%;">${pageNumbers[i]}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,600;0,700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'Inter', Arial, sans-serif;
      background: #fff; color: #1f2937;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    body { padding: 2.5cm; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
  </style>
</head>
<body>
  <div>
    <!-- Eyebrow -->
    <div style="font-size:8.5pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">
      section75help.co.uk
    </div>

    <!-- Title block -->
    <div style="border-bottom:3px solid #1e3a5f;padding-bottom:24px;margin-bottom:32px;">
      <h1 style="font-size:34pt;font-weight:700;color:#111827;margin:0 0 14px;line-height:1.1;">
        Section 75<br>Claim Pack
      </h1>
      <p style="font-size:13pt;color:#4b5563;margin:0;font-weight:300;line-height:1.45;">
        Your complete toolkit for claiming a refund<br>from your credit card provider
      </p>
    </div>

    <!-- Contents table -->
    <div style="margin-bottom:32px;">
      <div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#6b7280;margin-bottom:10px;">
        Contents
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <thead>
          <tr style="background:#1e3a5f;">
            <th style="padding:9px 14px;color:#fff;font-size:8pt;font-weight:600;text-align:left;width:10%;">#</th>
            <th style="padding:9px 14px;color:#fff;font-size:8pt;font-weight:600;text-align:left;">Document</th>
            <th style="padding:9px 14px;color:#fff;font-size:8pt;font-weight:600;text-align:right;width:12%;">Page</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <!-- How to use box -->
    <div style="background:#eff6ff;border-left:4px solid #2563eb;border-radius:0 4px 4px 0;padding:13px 16px;font-size:9.5pt;color:#1e3a5f;">
      <strong style="display:block;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1d4ed8;margin-bottom:5px;">
        How to use this pack
      </strong>
      Start with Document 1 (Cover Sheet) to determine which documents apply to your situation. Send Documents 2 and 3 as your initial claim. If rejected, use Documents 5 to 8 to choose the correct rebuttal. If the bank issues a final rejection, send Document 9 to the Financial Ombudsman Service within six months.
    </div>

    <!-- Footer -->
    <div style="margin-top:auto;padding-top:24px;border-top:1px solid #e5e7eb;margin-top:36px;font-size:7.5pt;color:#9ca3af;">
      Template for personal use only. Not legal advice. section75help.co.uk
    </div>
  </div>
</body>
</html>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function renderFile(page, filePath) {
  const url = pathToFileURL(filePath).href;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  return page.pdf(DOC_PDF_OPTIONS);
}

async function renderHtml(page, html) {
  const tmp = path.join(os.tmpdir(), '_s75_cover_tmp.html');
  fs.writeFileSync(tmp, html, 'utf-8');
  try {
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle0', timeout: 60000 });
    return page.pdf(COVER_PDF_OPTIONS);
  } finally {
    fs.unlinkSync(tmp);
  }
}

async function pageCount(buffer) {
  const pdf = await PDFDocument.load(buffer);
  return pdf.getPageCount();
}

async function merge(buffers) {
  const out = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p => out.addPage(p));
  }
  return out.save();
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Launching Chromium...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const tab = await browser.newPage();

    // Pass 1: render each document, record page counts
    console.log('\nRendering documents:');
    const docBuffers = [];
    const counts = [];

    for (const doc of DOCS) {
      process.stdout.write(`  ${doc.title}...`);
      const buf = await renderFile(tab, path.join(TEMPLATES_DIR, doc.file));
      const n = await pageCount(buf);
      docBuffers.push(buf);
      counts.push(n);
      console.log(` ${n}p`);
    }

    // Calculate TOC page numbers (cover = p.1, docs start at p.2)
    const pageNumbers = [];
    let cursor = 2;
    for (const n of counts) {
      pageNumbers.push(cursor);
      cursor += n;
    }

    // Pass 2: render cover page with accurate page numbers
    console.log('\nRendering cover page...');
    const coverBuf = await renderHtml(tab, buildCoverHtml(pageNumbers));
    await tab.close();

    // Merge: cover first, then documents in order
    console.log('Merging...');
    const finalBytes = await merge([coverBuf, ...docBuffers]);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, finalBytes);

    const totalPages = 1 + counts.reduce((a, b) => a + b, 0);
    const sizeKb = Math.round(fs.statSync(OUT_FILE).size / 1024);
    console.log(`\nDone — ${totalPages} pages, ${sizeKb} KB`);
    console.log(`Output: ${OUT_FILE}`);

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
