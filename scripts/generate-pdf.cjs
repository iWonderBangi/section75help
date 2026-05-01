#!/usr/bin/env node
// scripts/generate-pdf.js
// Generates the Section 75 Claim Pack PDF.
// Run with: node scripts/generate-pdf.js
// Output: public/downloads/section-75-claim-pack.pdf

'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ── Page geometry (A4 in points: 1pt = 1/72 inch) ─────────────────────────
const W = 595.28;
const H = 841.89;
const ML = 62;   // left margin
const MR = 62;   // right margin
const MT = 62;   // top margin (below header)
const MB = 62;   // bottom margin (above footer)
const CW = W - ML - MR; // content width
const HEADER_Y = 24;
const FOOTER_Y = H - 34;

// ── Typography ─────────────────────────────────────────────────────────────
const F  = 'Helvetica';
const FB = 'Helvetica-Bold';
const FI = 'Helvetica-Oblique';

// ── Colours ────────────────────────────────────────────────────────────────
const C_TEXT   = '#111111';
const C_MUTED  = '#666666';
const C_RULE   = '#cccccc';
const C_HILIGHT= '#f5f5f5';
const C_HEADER = '#333333';

const FOOTER_TEXT =
  'This document is a template for personal use only. ' +
  'It does not constitute legal advice. Section75help.co.uk';

// ── Output path ────────────────────────────────────────────────────────────
const OUT_DIR = path.join(__dirname, '..', 'public', 'downloads');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = path.join(OUT_DIR, 'section-75-claim-pack.pdf');

// ── Document setup ─────────────────────────────────────────────────────────
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: MT + 24, bottom: MB + 24, left: ML, right: MR },
  bufferPages: true,
  info: {
    Title:   'Section 75 Claim Pack',
    Author:  'section75help.co.uk',
    Subject: 'Section 75 Consumer Credit Act 1974 — Template Letters',
    Creator: 'section75help.co.uk',
  },
});
doc.pipe(fs.createWriteStream(OUT_FILE));

// Track which document title belongs to each page (for headers)
const pageHeaders = []; // index = page number (0-based), value = { num, title }
let _currentHeader = { num: '', title: '' };

doc.on('pageAdded', () => {
  pageHeaders.push({ ..._currentHeader });
});
// Push for the very first page (no event fires for page 1)
pageHeaders.push({ ..._currentHeader });

// ── Helper: draw a horizontal rule ────────────────────────────────────────
function rule(y) {
  const ry = y !== undefined ? y : doc.y;
  doc.moveTo(ML, ry).lineTo(ML + CW, ry).lineWidth(0.4).strokeColor(C_RULE).stroke();
}

// ── Helper: render text with inline [PLACEHOLDER] in bold ─────────────────
function richText(text, opts = {}) {
  const parts = [];
  const rx = /(\[[^\]]+\])/g;
  let last = 0, m;
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index), bold: false });
    parts.push({ t: m[0], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: text.slice(last), bold: false });
  if (!parts.length) parts.push({ t: text, bold: false });

  parts.forEach((p, i) => {
    doc.font(p.bold ? FB : F).fillColor(C_TEXT);
    doc.text(p.t, { continued: i < parts.length - 1, ...opts });
  });
}

// ── Helper: simple paragraph ───────────────────────────────────────────────
function para(text, opts = {}) {
  richText(text, { width: CW, lineGap: 2, paragraphGap: 6, ...opts });
}

// ── Helper: bold heading ───────────────────────────────────────────────────
function h1(text) {
  doc.moveDown(0.3);
  doc.font(FB).fontSize(13).fillColor(C_TEXT).text(text, { width: CW });
  doc.font(F).fontSize(10);
  doc.moveDown(0.2);
}

function h2(text) {
  doc.moveDown(0.6);
  doc.font(FB).fontSize(10.5).fillColor(C_HEADER).text(text, { width: CW });
  rule();
  doc.moveDown(0.3);
  doc.font(F).fontSize(10).fillColor(C_TEXT);
}

// ── Helper: use-when notice box ────────────────────────────────────────────
function useWhen(text) {
  const boxY = doc.y;
  const textLines = doc.heightOfString(text, { width: CW - 24, fontSize: 9 });
  const boxH = textLines + 28;
  doc.rect(ML, boxY, CW, boxH).fillColor(C_HILIGHT).fill();
  doc.font(FB).fontSize(8).fillColor(C_MUTED)
    .text('USE THIS DOCUMENT WHEN:', ML + 10, boxY + 8, { width: CW - 20 });
  doc.font(F).fontSize(9).fillColor(C_TEXT)
    .text(text, ML + 10, boxY + 20, { width: CW - 20, lineGap: 1 });
  doc.y = boxY + boxH + 10;
}

// ── Helper: address block ──────────────────────────────────────────────────
function addressBlock(lines) {
  doc.font(F).fontSize(10).fillColor(C_TEXT);
  lines.forEach((line, i) => {
    const isLast = i === lines.length - 1;
    richText(line, { width: CW, lineGap: 1, paragraphGap: isLast ? 8 : 0 });
  });
}

// ── Helper: option box (choose one) ───────────────────────────────────────
function optionBox(label, bodyText) {
  doc.moveDown(0.3);
  const startY = doc.y;
  doc.rect(ML, startY, CW, 14).fillColor('#e8e8e8').fill();
  doc.font(FB).fontSize(8).fillColor(C_MUTED)
    .text(label, ML + 6, startY + 3, { width: CW - 12 });
  doc.font(F).fontSize(10).fillColor(C_TEXT);
  doc.y = startY + 16;
  const innerStart = doc.y;
  richText(bodyText, { width: CW - 12, indent: 6, lineGap: 2, paragraphGap: 4 });
  const innerEnd = doc.y;
  doc.rect(ML, startY, CW, innerEnd - startY + 6).lineWidth(0.4).strokeColor(C_RULE).stroke();
  doc.y = innerEnd + 8;
}

// ── Helper: delete note ────────────────────────────────────────────────────
function deleteNote(text) {
  doc.font(FI).fontSize(8.5).fillColor(C_MUTED)
    .text(text, { width: CW, lineGap: 1, paragraphGap: 6 });
  doc.font(F).fontSize(10).fillColor(C_TEXT);
}

// ── Helper: bullet list ────────────────────────────────────────────────────
function bullets(items) {
  items.forEach(item => {
    const x = doc.x;
    doc.font(F).fontSize(10).fillColor(C_TEXT)
      .text('•  ', { continued: true, width: 14 });
    richText(item, { width: CW - 14, lineGap: 2, paragraphGap: 3 });
  });
  doc.moveDown(0.3);
}

// ── Helper: numbered list ──────────────────────────────────────────────────
function numbered(items) {
  items.forEach((item, i) => {
    doc.font(FB).fontSize(10).fillColor(C_TEXT)
      .text(`${i + 1}.  `, { continued: true, width: 20 });
    richText(item, { width: CW - 20, lineGap: 2, paragraphGap: 3 });
  });
  doc.moveDown(0.3);
}

// ── Helper: sign-off block ─────────────────────────────────────────────────
function signOff() {
  doc.moveDown(0.8);
  doc.font(F).fontSize(10).fillColor(C_TEXT).text('Yours faithfully,', { width: CW });
  doc.moveDown(2.5);
  doc.moveTo(ML, doc.y).lineTo(ML + 160, doc.y).lineWidth(0.5).strokeColor('#999').stroke();
  doc.moveDown(0.3);
  richText('[YOUR FULL NAME — PRINTED]', { width: CW });
}

// ── Helper: legislation footer line ───────────────────────────────────────
function legRef(text) {
  doc.moveDown(0.8);
  rule();
  doc.moveDown(0.3);
  doc.font(F).fontSize(7.5).fillColor(C_MUTED).text(text, { width: CW, lineGap: 1 });
}

// ── Helper: two-col table ──────────────────────────────────────────────────
function twoColTable(rows, col1W) {
  const c2W = CW - col1W - 2;
  const rowH = 18;
  rows.forEach((row, i) => {
    const y = doc.y;
    if (i === 0) {
      doc.rect(ML, y, CW, rowH).fillColor('#e0e0e0').fill();
      doc.font(FB).fontSize(8.5).fillColor(C_TEXT);
    } else {
      doc.rect(ML, y, CW, rowH).fillColor(i % 2 === 0 ? C_HILIGHT : '#fff').fill();
      doc.font(F).fontSize(9).fillColor(C_TEXT);
    }
    doc.rect(ML, y, CW, rowH).lineWidth(0.3).strokeColor(C_RULE).stroke();
    const textY = y + 4;
    doc.text(row[0], ML + 4, textY, { width: col1W - 4 });
    doc.font(i === 0 ? FB : F).fontSize(i === 0 ? 8.5 : 9).fillColor(C_TEXT);
    richText(row[1], { x: ML + col1W + 4, y: textY, width: c2W - 4 });
    doc.y = y + rowH;
  });
  doc.moveDown(0.5);
  doc.font(F).fontSize(10).fillColor(C_TEXT);
}

// ── Helper: start a new document section ──────────────────────────────────
function startDoc(num, title, useWhenText) {
  _currentHeader = { num, title };
  if (pageHeaders.length > 0) {
    doc.addPage();
  }
  useWhen(useWhenText);
}

// ══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT 1 — COVER SHEET
// ══════════════════════════════════════════════════════════════════════════════
startDoc('01', 'Cover Sheet — Which Document to Use and When',
  'Read this first. It tells you which document to use in your situation and the correct order to use them.');

h1('Section 75 Claim Pack');
doc.font(F).fontSize(9.5).fillColor(C_MUTED)
  .text('Eight documents for making and pursuing a Section 75 claim under the Consumer Credit Act 1974.', { width: CW });
doc.moveDown(0.5);
rule();
doc.moveDown(0.5);

h2('Documents in this pack');

const docTable = [
  ['#', 'Document', 'When to use it'],
  ['1', 'Initial Claim Letter', 'Your first letter to your credit card provider. Send with Document 2 and your evidence.'],
  ['2', 'Evidence Cover Letter', 'Cover sheet listing the documents you are enclosing. Always send alongside Document 1.'],
  ['3', 'Plain English Process Guide', 'Read before you start. Sets out the process, realistic timelines, and what the bank is likely to say.'],
  ['4', 'Rejection Rebuttal — Standard', 'Bank rejected without a clear reason, or says you must pursue the retailer first.'],
  ['5', 'Rejection Rebuttal — Overseas', 'Bank says Section 75 does not apply because the purchase was made abroad.'],
  ['6', 'Rejection Rebuttal — Part Payment', 'Bank says it is only liable for the card portion, not the full amount.'],
  ['7', 'Rejection Rebuttal — Third Party', 'Bank says Section 75 does not apply because you paid an agent, not the supplier.'],
  ['8', 'FOS Complaint Letter', 'Bank has issued a final rejection. Refer to the Financial Ombudsman Service within six months.'],
];
const colW = [22, 140, CW - 22 - 140 - 2];
const rowHt = 22;
docTable.forEach((row, ri) => {
  const y = doc.y;
  doc.rect(ML, y, CW, rowHt)
    .fillColor(ri === 0 ? '#e0e0e0' : ri % 2 === 0 ? C_HILIGHT : '#fff').fill();
  doc.rect(ML, y, CW, rowHt).lineWidth(0.3).strokeColor(C_RULE).stroke();
  const font = ri === 0 ? FB : F;
  const sz   = ri === 0 ? 8.5 : 9;
  let xOff = ML + 4;
  row.forEach((cell, ci) => {
    doc.font(font).fontSize(sz).fillColor(C_TEXT)
       .text(cell, xOff, y + 5, { width: colW[ci] - 4 });
    xOff += colW[ci] + 2;
  });
  doc.y = y + rowHt;
});
doc.moveDown(0.6);

h2('Step-by-step — most common situation');
numbered([
  'Read Document 3 (Plain English Process Guide) before you do anything else.',
  'Gather your evidence: credit card statement, order confirmation or receipt, evidence of failure (administration notice, non-delivery confirmation, or photographs of fault), and any correspondence with the supplier.',
  'Complete Document 1 (Initial Claim Letter). Fill in every [PLACEHOLDER] in bold. Delete the option paragraphs you do not need.',
  'Complete Document 2 (Evidence Cover Letter). List each document you are enclosing.',
  'Send Documents 1 and 2 together with your evidence by recorded post or via secure messaging in online banking. Keep a full copy of everything and note the date sent.',
  'Wait up to eight weeks for a response.',
  'If they pay: done.',
  'If they reject: use the appropriate rebuttal (Documents 4, 5, 6 or 7 — see table below).',
  'If they reject again or do not respond within eight weeks: send Document 8 to the Financial Ombudsman Service within six months of their final response letter.',
]);

h2('Choosing the right rebuttal');
twoColTable([
  ['What the bank said', 'Document to use'],
  ['Vague rejection or no specific reason', 'Document 4 — Standard'],
  ['"You must pursue the retailer first"', 'Document 4 — Standard'],
  ['"Section 75 does not apply abroad"', 'Document 5 — Overseas'],
  ['"We are only liable for the card portion"', 'Document 6 — Part Payment'],
  ['"You paid an agent, not the supplier"', 'Document 7 — Third Party'],
  ['Any final rejection received', 'Document 8 — FOS Complaint Letter'],
], 240);

h2('Important notes');
bullets([
  'Do not rely on telephone calls. All claims and rebuttals must be in writing to create a paper trail.',
  'Keep copies of everything you send and receive, including dates.',
  'You do not need a solicitor for a standard Section 75 claim. These templates are designed to be used directly.',
  'The Financial Ombudsman Service is free to use and its decisions are binding on the bank.',
  'Time limits matter. You have six months from the date of the bank\'s final response letter to refer to the FOS.',
]);

// ══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT 2 — INITIAL CLAIM LETTER
// ══════════════════════════════════════════════════════════════════════════════
startDoc('02', 'Initial Claim Letter',
  'Making your first Section 75 claim to your credit card provider. Send this with Document 2 (Evidence Cover Letter) and your supporting documents.');

addressBlock([
  '[YOUR FULL NAME]',
  '[YOUR ADDRESS LINE 1]',
  '[YOUR ADDRESS LINE 2]',
  '[YOUR TOWN OR CITY]',
  '[YOUR POSTCODE]',
]);
doc.moveDown(0.5);
para('[DATE]');
doc.moveDown(0.3);
addressBlock([
  'Section 75 Disputes Team',
  '[CREDIT CARD PROVIDER NAME]',
  '[CREDIT CARD PROVIDER ADDRESS LINE 1]',
  '[CREDIT CARD PROVIDER POSTCODE]',
]);
doc.font(FI).fontSize(9).fillColor(C_MUTED)
  .text('Account / card reference: ', { continued: true });
doc.font(FB).fontSize(9).fillColor(C_TEXT)
  .text('[YOUR ACCOUNT NUMBER OR LAST FOUR DIGITS OF CARD]', { width: CW });
doc.moveDown(0.3);
doc.font(FB).fontSize(11).fillColor(C_TEXT)
  .text('Section 75 Claim — Consumer Credit Act 1974', { width: CW });
doc.moveDown(0.4);
doc.font(F).fontSize(10).fillColor(C_TEXT);
para('Dear Sir or Madam,');
para('I am writing to make a formal claim under Section 75 of the Consumer Credit Act 1974 in connection with a purchase made on my credit card account ending [LAST FOUR DIGITS OF CARD].');

h2('Transaction details');
twoColTable([
  ['Field', 'Detail'],
  ['Supplier or company name', '[SUPPLIER OR COMPANY NAME]'],
  ['Date of purchase', '[DATE OF PURCHASE]'],
  ['Amount charged to credit card', '£[AMOUNT PAID ON CREDIT CARD]'],
  ['Total contract price', '£[TOTAL CONTRACT PRICE]'],
  ['Description of goods or services', '[BRIEF DESCRIPTION — e.g. "deposit for kitchen installation" / "sofa, order ref. 12345" / "holiday, booking ref. AB123"]'],
], 180);

h2('Grounds for claim');
deleteNote('Select the paragraph below that matches your situation. Delete the other options before sending.');
optionBox('OPTION A — Business failure or non-delivery',
  '[SUPPLIER OR COMPANY NAME] went into administration / ceased trading on [DATE OF ADMINISTRATION OR CLOSURE]. As a result, the goods or services for which I paid have not been delivered and will not be delivered. This constitutes a breach of contract.');
optionBox('OPTION B — Faulty goods',
  'The goods delivered by [SUPPLIER OR COMPANY NAME] on [DATE OF DELIVERY] are not of satisfactory quality and are not fit for purpose, in breach of Sections 9 and 10 of the Consumer Rights Act 2015. Specifically: [BRIEF DESCRIPTION OF THE FAULT]. I contacted the supplier on [DATE] and have been unable to obtain a remedy.');
optionBox('OPTION C — Goods or services not as described',
  'The goods or services provided by [SUPPLIER OR COMPANY NAME] are materially different from their description at the point of sale, in breach of Section 11 of the Consumer Rights Act 2015. Specifically: [BRIEF DESCRIPTION OF THE DISCREPANCY].');

h2('Your liability under Section 75');
para('Section 75(1) of the Consumer Credit Act 1974 provides that where a debtor has a claim against a supplier in connection with a transaction made under a debtor-creditor-supplier agreement, the creditor is jointly and severally liable with the supplier in respect of that claim.');
para('The conditions of Section 75(1) are satisfied in this case:');
bullets([
  'The purchase was made using a regulated consumer credit agreement (my personal credit card).',
  'The total purchase price is £[TOTAL CONTRACT PRICE], which is between £100 and £30,000.',
  'The supplier is in breach of contract as described above.',
]);
para('As a party that is jointly and severally liable, you are not entitled to require me to exhaust my remedies against the supplier before I pursue my claim against you.');

h2('Amount claimed');
para('I am claiming the sum of £[TOTAL AMOUNT CLAIMED], representing [all sums paid to the supplier / the full contract price of £[TOTAL CONTRACT PRICE] less a partial refund of £[AMOUNT ALREADY REFUNDED] already received — delete as applicable].');

h2('Evidence enclosed');
para('I enclose the following in support of this claim:');
bullets([
  'Credit card statement showing the transaction dated [DATE OF TRANSACTION]',
  'Order confirmation or receipt from [SUPPLIER OR COMPANY NAME]',
  '[EVIDENCE OF FAILURE — e.g. "Notice of administration dated [DATE]" / "Photographs of faulty goods" / "Screenshot of product description alongside delivered item"]',
  '[CORRESPONDENCE WITH SUPPLIER — e.g. "Copy of email to supplier dated [DATE], unanswered" — delete if not applicable]',
]);

h2('Response requested');
para('Please acknowledge receipt of this letter and provide a final response within eight weeks, as required under FCA rules (DISP 1.6.2R). If you require further information, contact me at [YOUR EMAIL ADDRESS].');
para('If I do not receive a satisfactory final response within eight weeks, I will refer this matter to the Financial Ombudsman Service.');
signOff();
doc.moveDown(0.4);
doc.font(FI).fontSize(9).fillColor(C_MUTED)
  .text('Enc: Evidence Cover Letter and supporting documents as listed above.', { width: CW });

// ══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT 3 — EVIDENCE COVER LETTER
// ══════════════════════════════════════════════════════════════════════════════
startDoc('03', 'Evidence Cover Letter',
  'Sending supporting documents to your credit card provider alongside the Initial Claim Letter. Complete the evidence list, then attach this as the first page of your enclosures.');

addressBlock(['[YOUR FULL NAME]', '[YOUR ADDRESS LINE 1]', '[YOUR ADDRESS LINE 2]', '[YOUR TOWN OR CITY]', '[YOUR POSTCODE]']);
doc.moveDown(0.5);
para('[DATE]');
doc.moveDown(0.3);
addressBlock(['Section 75 Disputes Team', '[CREDIT CARD PROVIDER NAME]', '[CREDIT CARD PROVIDER ADDRESS LINE 1]', '[CREDIT CARD PROVIDER POSTCODE]']);
doc.font(FI).fontSize(9).fillColor(C_MUTED)
  .text('Account / card reference: ', { continued: true });
doc.font(FB).fontSize(9).fillColor(C_TEXT)
  .text('[YOUR ACCOUNT NUMBER OR LAST FOUR DIGITS OF CARD]', { width: CW });
doc.moveDown(0.3);
doc.font(FB).fontSize(11).fillColor(C_TEXT)
  .text('Section 75 Claim — Supporting Evidence', { width: CW });
doc.moveDown(0.4);
doc.font(F).fontSize(10).fillColor(C_TEXT);
para('Dear Sir or Madam,');
para('I enclose the following documents in support of my Section 75 claim against [SUPPLIER OR COMPANY NAME], as set out in my accompanying claim letter dated [DATE OF CLAIM LETTER].');

h2('Enclosed documents');
deleteNote('List each document you are enclosing. Delete any rows that do not apply.');
const encRows = [
  ['#', 'Document description', 'Date', 'Pages'],
  ['1', 'Credit card statement showing the transaction', '[DATE]', '[N]'],
  ['2', 'Order confirmation or receipt from [SUPPLIER NAME]', '[DATE]', '[N]'],
  ['3', '[EVIDENCE OF FAILURE — e.g. notice of administration / delivery failure / photographs]', '[DATE]', '[N]'],
  ['4', '[CORRESPONDENCE WITH SUPPLIER — delete if not applicable]', '[DATE]', '[N]'],
  ['5', '[ANY ADDITIONAL DOCUMENT — delete if not applicable]', '[DATE]', '[N]'],
];
const encColW = [18, CW - 18 - 60 - 36 - 6, 60, 36];
const encRowH = 22;
encRows.forEach((row, ri) => {
  const y = doc.y;
  doc.rect(ML, y, CW, encRowH).fillColor(ri === 0 ? '#e0e0e0' : ri % 2 === 0 ? C_HILIGHT : '#fff').fill();
  doc.rect(ML, y, CW, encRowH).lineWidth(0.3).strokeColor(C_RULE).stroke();
  let xOff = ML + 4;
  row.forEach((cell, ci) => {
    const font = ri === 0 ? FB : F;
    doc.font(font).fontSize(ri === 0 ? 8 : 8.5).fillColor(C_TEXT)
       .text(cell, xOff, y + 5, { width: encColW[ci] - 4 });
    xOff += encColW[ci] + 2;
  });
  doc.y = y + encRowH;
});
doc.moveDown(0.5);
richText('Total pages enclosed: [TOTAL NUMBER OF PAGES] across [NUMBER] documents.', { width: CW, paragraphGap: 6 });

h2('Acknowledgement requested');
para('Please confirm in writing that you have received these documents and that my claim is being processed. If any document is missing or insufficient, please contact me at [YOUR EMAIL ADDRESS] so that I can supply a replacement promptly.');
signOff();
doc.moveDown(0.4);
doc.font(FI).fontSize(9).fillColor(C_MUTED).text('Enc: As listed above.', { width: CW });

// ══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT 4 — PLAIN ENGLISH PROCESS GUIDE
// ══════════════════════════════════════════════════════════════════════════════
startDoc('04', 'Plain English Process Guide',
  'Read before you start. This one-page guide explains the Section 75 process, timelines, and what the bank is likely to say. No placeholders to fill in.');

h1('Section 75: Plain English Guide');

h2('What Section 75 is');
para('Section 75 of the Consumer Credit Act 1974 makes your credit card provider jointly liable with a retailer if the retailer breaches their contract with you or misrepresents what they are selling. You can claim against your card provider directly, even if the retailer has gone into administration, refused to engage, or cannot be traced.');
para('This applies as long as: (1) you paid at least £1 of the purchase on your personal credit card; (2) the total purchase price was between £100 and £30,000; and (3) the supplier failed to deliver what was promised.');

h2('The process, step by step');
twoColTable([
  ['Step', 'What to do', 'Timescale'],
  ['1', 'Send Documents 1 and 2 with your evidence to the Section 75 disputes team. Use recorded post or secure messaging. Keep copies.', 'As soon as possible'],
  ['2', 'Wait for the card provider to respond. FCA rules (DISP 1.6.2R) require a final response within eight weeks. Many cases resolve in four to six weeks.', '4–8 weeks'],
  ['3a', 'If they pay: your claim is resolved.', '—'],
  ['3b', 'If they reject: use the appropriate rebuttal (Documents 4, 5, 6 or 7). Reply in writing only.', 'Reply within 14 days'],
  ['4', 'If they reject again, or if eight weeks pass without a final response: send Document 8 to the FOS within six months of the final response date.', 'FOS: typically several months'],
].map(r => r.length === 3 ? r : r), CW / 3);

h2('What the bank is likely to say — and what the law says');
twoColTable([
  ['What the bank says', 'What the law actually says'],
  ['"You must pursue the retailer first."', 'Incorrect. Section 75 creates joint and several liability. You may pursue either party independently.'],
  ['"We are only liable for the amount on the card."', 'Incorrect. Section 75 covers the full contract value, not just the card payment.'],
  ['"Section 75 does not apply to purchases abroad."', 'Incorrect. OFT v Lloyds TSB [2007] UKHL 48 confirmed Section 75 applies to UK credit card purchases made overseas.'],
  ['"You paid an agent, not the supplier."', 'Requires examination. If the agent contracted as principal, the debtor-creditor-supplier link is satisfied. See Document 7.'],
  ['"Your claim is out of time."', 'The six-year limit runs from when the failure occurred, not from when you paid. Check your dates.'],
], 200);

h2('Key contacts');
bullets([
  'Your card provider\'s Section 75 disputes team: check your card provider\'s website. Do not use general customer services.',
  'Financial Ombudsman Service: Exchange Tower, London, E14 9SR | 0800 023 4567 | financial-ombudsman.org.uk',
  'Section 75 legislation: legislation.gov.uk/ukpga/1974/39/section/75',
]);

h2('Honest notes on timelines');
para('Banks take four to eight weeks for most claims. The Financial Ombudsman Service faces significant backlogs; cases referred to the FOS typically take several months to resolve. Making a well-evidenced claim from the start reduces the risk of rejection and the need to escalate.');

// ══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT 5 — REJECTION REBUTTAL: STANDARD
// ══════════════════════════════════════════════════════════════════════════════
startDoc('05', 'Rejection Rebuttal — Standard Version',
  'Your credit card provider has rejected your Section 75 claim with a vague reason, told you to pursue the retailer first, said there is insufficient evidence, or disputed whether your purchase qualifies. Choose the option that matches their stated reason.');

addressBlock(['[YOUR FULL NAME]', '[YOUR ADDRESS LINE 1]', '[YOUR ADDRESS LINE 2]', '[YOUR TOWN OR CITY]', '[YOUR POSTCODE]']);
doc.moveDown(0.5);
para('[DATE]');
doc.moveDown(0.3);
addressBlock(['Section 75 Disputes Team', '[CREDIT CARD PROVIDER NAME]', '[CREDIT CARD PROVIDER ADDRESS LINE 1]', '[CREDIT CARD PROVIDER POSTCODE]']);
doc.font(FI).fontSize(9).fillColor(C_MUTED).text('Account / card reference: ', { continued: true });
doc.font(FB).fontSize(9).fillColor(C_TEXT).text('[YOUR ACCOUNT NUMBER OR LAST FOUR DIGITS OF CARD]', { width: CW });
doc.moveDown(0.3);
doc.font(FB).fontSize(11).fillColor(C_TEXT).text('Formal Rebuttal — Section 75 Claim — Consumer Credit Act 1974', { width: CW });
doc.moveDown(0.4);
doc.font(F).fontSize(10).fillColor(C_TEXT);
para('Dear Sir or Madam,');
richText('I refer to your letter dated [DATE OF REJECTION LETTER] in which you rejected my Section 75 claim concerning a purchase from [SUPPLIER OR COMPANY NAME] made on [DATE OF PURCHASE] for a total contract price of £[TOTAL CONTRACT PRICE]. I do not accept your determination and write to ask you to reconsider.', { width: CW, paragraphGap: 6 });

h2('Grounds for rebuttal');
deleteNote('Select the option below that matches the bank\'s stated reason. Delete the other options before sending.');

optionBox('OPTION A — "You must pursue the retailer first" or no specific reason given',
  'Section 75(1) of the Consumer Credit Act 1974 imposes joint and several liability on the creditor. Under joint and several liability, a claimant may pursue any jointly liable party independently, in any order, without first exhausting remedies against the others. There is no provision in the Consumer Credit Act 1974, nor in any decided case, that requires a Section 75 claimant to pursue the supplier before the creditor. This is particularly so where the supplier has [gone into administration / ceased trading / refused to engage] and pursuit of the supplier is not a realistic remedy.');

optionBox('OPTION B — "There is insufficient evidence"',
  'I refer you to the documents submitted with my original claim letter dated [DATE OF ORIGINAL CLAIM], which include: [LIST KEY DOCUMENTS — e.g. "credit card statement, order confirmation, notice of administration"]. These establish: (a) that the transaction was made on my credit card; (b) the total purchase price; (c) the supplier\'s breach; and (d) my loss. If you require a specific additional document, please identify what is needed and I will provide it within 14 days. A general assertion of insufficient evidence without specifying what is lacking is not adequate grounds for rejection.');

optionBox('OPTION C — "The purchase does not qualify"',
  'The qualifying conditions under Section 75(1) of the Consumer Credit Act 1974 are: (1) the purchase was made under a regulated debtor-creditor-supplier agreement; (2) the cash price was more than £100 and did not exceed £30,000; and (3) the supplier was in breach of contract or guilty of misrepresentation. All three conditions are met: [BRIEFLY EXPLAIN — e.g. "the purchase was made on my personal credit card; the total price of £[AMOUNT] falls within the statutory range; [SUPPLIER NAME] has failed to deliver as described in my original letter."]');

optionBox('OPTION D — No reasoned response provided',
  'Your letter does not provide specific grounds for rejecting my claim. The FCA\'s Dispute Resolution sourcebook (DISP 1.6.4R) requires you to provide a reasoned final response. Please provide specific grounds within 14 days. If you do not, I will treat your letter as a final rejection and refer this matter to the Financial Ombudsman Service.');

h2('My position');
para('My Section 75 claim is valid. I am claiming £[TOTAL AMOUNT CLAIMED]. Please issue a revised final response within 14 days.');
para('If you maintain your rejection, I will refer this matter to the Financial Ombudsman Service without further notice. The FOS\'s determinations are binding on your organisation under DISP 3.6.');
signOff();

// ══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT 6 — REJECTION REBUTTAL: OVERSEAS PURCHASE
// ══════════════════════════════════════════════════════════════════════════════
startDoc('06', 'Rejection Rebuttal — Overseas Purchase',
  'Your credit card provider has rejected your claim on the basis that the purchase was made abroad or with an overseas supplier. This rebuttal cites OFT v Lloyds TSB Bank plc [2007] UKHL 48, in which the House of Lords confirmed that Section 75 applies to overseas transactions on UK credit cards.');

addressBlock(['[YOUR FULL NAME]', '[YOUR ADDRESS LINE 1]', '[YOUR ADDRESS LINE 2]', '[YOUR TOWN OR CITY]', '[YOUR POSTCODE]']);
doc.moveDown(0.5);
para('[DATE]');
doc.moveDown(0.3);
addressBlock(['Section 75 Disputes Team', '[CREDIT CARD PROVIDER NAME]', '[CREDIT CARD PROVIDER ADDRESS LINE 1]', '[CREDIT CARD PROVIDER POSTCODE]']);
doc.font(FI).fontSize(9).fillColor(C_MUTED).text('Account / card reference: ', { continued: true });
doc.font(FB).fontSize(9).fillColor(C_TEXT).text('[YOUR ACCOUNT NUMBER OR LAST FOUR DIGITS OF CARD]', { width: CW });
doc.moveDown(0.3);
doc.font(FB).fontSize(11).fillColor(C_TEXT).text('Formal Rebuttal — Section 75 Claim — Overseas Purchase — Consumer Credit Act 1974', { width: CW });
doc.moveDown(0.4);
doc.font(F).fontSize(10).fillColor(C_TEXT);
para('Dear Sir or Madam,');
richText('I refer to your letter dated [DATE OF REJECTION LETTER] rejecting my Section 75 claim for a purchase from [SUPPLIER OR COMPANY NAME], located in [COUNTRY OF SUPPLIER], made on [DATE OF PURCHASE] for a total of £[TOTAL CONTRACT PRICE]. You rejected my claim on the basis that [SUMMARISE THE BANK\'S STATED REASON — e.g. "Section 75 does not apply to purchases made outside the United Kingdom"]. I do not accept this determination.', { width: CW, paragraphGap: 6 });

h2('Section 75 applies to overseas purchases on UK credit cards');
para('The question of whether Section 75 of the Consumer Credit Act 1974 applies to overseas transactions made on UK-issued credit cards was conclusively determined by the House of Lords in Office of Fair Trading v Lloyds TSB Bank plc [2007] UKHL 48.');
para('In that case, the banks argued that the debtor-creditor-supplier link required by Section 12(b) of the Act could not be established for overseas transactions. The House of Lords rejected this argument. Their Lordships held that the debtor-creditor-supplier agreement exists by virtue of the arrangements between the card issuer and the card scheme (Visa, Mastercard, etc.), which enables cardholders to purchase from any participating supplier worldwide. The three-party link is established at the time the card is issued, not at the time of any individual transaction.');
para('The consequence is that Section 75 applies to any purchase made on a UK-regulated credit card, regardless of whether the supplier is located in the United Kingdom or abroad.');

h2('Application to my claim');
richText('My credit card is a UK-regulated consumer credit agreement issued by your organisation. The purchase from [SUPPLIER OR COMPANY NAME] in [COUNTRY] was made on this card. The total purchase price was £[TOTAL CONTRACT PRICE], which falls within the statutory range of more than £100 and not exceeding £30,000. The supplier has breached their contract with me as set out in my original claim letter dated [DATE OF ORIGINAL CLAIM].', { width: CW, paragraphGap: 6 });
para('All conditions of Section 75(1) of the Consumer Credit Act 1974 are satisfied. The overseas nature of the transaction is not a bar to my claim.');

h2('My position');
richText('I ask that you reconsider your determination in light of Office of Fair Trading v Lloyds TSB Bank plc [2007] UKHL 48 and issue a revised final response upholding my claim for £[TOTAL AMOUNT CLAIMED] within 14 days of this letter.', { width: CW, paragraphGap: 6 });
para('If you maintain your rejection, I will refer this matter to the Financial Ombudsman Service and draw to their attention your reliance on a ground that the House of Lords has expressly rejected.');
signOff();
legRef('Case reference: Office of Fair Trading v Lloyds TSB Bank plc [2007] UKHL 48.\nLegislation: Consumer Credit Act 1974, Sections 12 and 75: legislation.gov.uk/ukpga/1974/39/section/75');

// ══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT 7 — REJECTION REBUTTAL: PART PAYMENT
// ══════════════════════════════════════════════════════════════════════════════
startDoc('07', 'Rejection Rebuttal — Part Payment on Card',
  'Your credit card provider has rejected your claim on the basis that only part of the purchase price was paid by credit card and their liability is limited to that portion only. This rebuttal explains that Section 75 covers the full contract value.');

addressBlock(['[YOUR FULL NAME]', '[YOUR ADDRESS LINE 1]', '[YOUR ADDRESS LINE 2]', '[YOUR TOWN OR CITY]', '[YOUR POSTCODE]']);
doc.moveDown(0.5);
para('[DATE]');
doc.moveDown(0.3);
addressBlock(['Section 75 Disputes Team', '[CREDIT CARD PROVIDER NAME]', '[CREDIT CARD PROVIDER ADDRESS LINE 1]', '[CREDIT CARD PROVIDER POSTCODE]']);
doc.font(FI).fontSize(9).fillColor(C_MUTED).text('Account / card reference: ', { continued: true });
doc.font(FB).fontSize(9).fillColor(C_TEXT).text('[YOUR ACCOUNT NUMBER OR LAST FOUR DIGITS OF CARD]', { width: CW });
doc.moveDown(0.3);
doc.font(FB).fontSize(11).fillColor(C_TEXT).text('Formal Rebuttal — Section 75 Claim — Full Contract Value — Consumer Credit Act 1974', { width: CW });
doc.moveDown(0.4);
doc.font(F).fontSize(10).fillColor(C_TEXT);
para('Dear Sir or Madam,');
richText('I refer to your letter dated [DATE OF REJECTION LETTER] concerning my Section 75 claim for a purchase from [SUPPLIER OR COMPANY NAME] dated [DATE OF PURCHASE]. The total purchase price was £[TOTAL CONTRACT PRICE], of which £[AMOUNT PAID ON CREDIT CARD] was charged to my credit card and £[AMOUNT PAID BY OTHER MEANS] was paid by [OTHER PAYMENT METHOD]. You have stated that [SUMMARISE THE BANK\'S POSITION — e.g. "your liability is limited to the amount of £[AMOUNT] charged to the credit card"]. This is not a correct statement of the law.', { width: CW, paragraphGap: 6 });

h2('Section 75 covers the full contract value');
para('Section 75(1) of the Consumer Credit Act 1974 provides that the creditor is "jointly and severally liable" with the supplier in respect of a "like claim" to that which the debtor has against the supplier. My claim against the supplier is for the full purchase price of £[TOTAL CONTRACT PRICE] — that is, the full value of the contract that has been breached. This is the "like claim" to which I am entitled against you as the jointly liable creditor.');
para('The requirement that a credit card is used is a qualifying condition for liability, not a cap on the amount of that liability. Section 75(3)(b) makes clear that the qualifying threshold relates to the cash price of the goods or services, not the amount financed by credit. The statute requires only that the credit card was used for part of the transaction. The card provider\'s liability extends to the full contract value.');
para('The Financial Ombudsman Service routinely awards the full contract value in Section 75 claims where only part of the price was paid by credit card, on the basis that Section 75 creates liability for the full breach, not merely a proportionate share.');

h2('The threshold condition is met');
richText('The relevant threshold under Section 75(3)(b) is that the cash price of the goods or services exceeds £100 and does not exceed £30,000. The cash price here is £[TOTAL CONTRACT PRICE], which satisfies this condition. The threshold applies to the total price of the item, not to the amount charged to the card.', { width: CW, paragraphGap: 6 });

h2('My position');
richText('I am entitled to claim the full contract value of £[TOTAL CONTRACT PRICE] under Section 75 of the Consumer Credit Act 1974, less any amounts already recovered. My outstanding claim is for £[TOTAL AMOUNT CLAIMED]. Please issue a revised determination within 14 days.', { width: CW, paragraphGap: 6 });
para('If you maintain the position that Section 75 limits your liability to the card portion only, I will refer this matter to the Financial Ombudsman Service.');
signOff();
legRef('Legislation: Consumer Credit Act 1974, Sections 75(1) and 75(3)(b): legislation.gov.uk/ukpga/1974/39/section/75');

// ══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT 8 — REJECTION REBUTTAL: THIRD PARTY / BOOKING AGENT
// ══════════════════════════════════════════════════════════════════════════════
startDoc('08', 'Rejection Rebuttal — Third Party / Booking Agent',
  'Your credit card provider has rejected your claim on the basis that you paid a booking agent or intermediary rather than the ultimate supplier. This rebuttal addresses the debtor-creditor-supplier link and the distinction between an agent acting as principal and one acting as a disclosed agent.');

addressBlock(['[YOUR FULL NAME]', '[YOUR ADDRESS LINE 1]', '[YOUR ADDRESS LINE 2]', '[YOUR TOWN OR CITY]', '[YOUR POSTCODE]']);
doc.moveDown(0.5);
para('[DATE]');
doc.moveDown(0.3);
addressBlock(['Section 75 Disputes Team', '[CREDIT CARD PROVIDER NAME]', '[CREDIT CARD PROVIDER ADDRESS LINE 1]', '[CREDIT CARD PROVIDER POSTCODE]']);
doc.font(FI).fontSize(9).fillColor(C_MUTED).text('Account / card reference: ', { continued: true });
doc.font(FB).fontSize(9).fillColor(C_TEXT).text('[YOUR ACCOUNT NUMBER OR LAST FOUR DIGITS OF CARD]', { width: CW });
doc.moveDown(0.3);
doc.font(FB).fontSize(11).fillColor(C_TEXT).text('Formal Rebuttal — Section 75 Claim — Debtor-Creditor-Supplier Link — Consumer Credit Act 1974', { width: CW });
doc.moveDown(0.4);
doc.font(F).fontSize(10).fillColor(C_TEXT);
para('Dear Sir or Madam,');
richText('I refer to your letter dated [DATE OF REJECTION LETTER] rejecting my Section 75 claim for a purchase from [SUPPLIER OR BOOKING AGENT NAME] dated [DATE OF PURCHASE] for a total of £[TOTAL CONTRACT PRICE]. You have stated that [SUMMARISE THE BANK\'S POSITION — e.g. "Section 75 does not apply because you contracted with [AGENT NAME] rather than the underlying supplier"]. I set out below why this rejection is not well-founded on the facts of my transaction.', { width: CW, paragraphGap: 6 });

h2('The debtor-creditor-supplier link');
para('Section 75 requires a "debtor-creditor-supplier agreement" as defined in Section 12 of the Consumer Credit Act 1974. Where a booking agent or platform contracts with a consumer as a principal — selling the product or service in its own name and bearing contractual liability for delivery — it is the supplier for Section 75 purposes, regardless of whether it sources the underlying goods or services from a third party.');
para('Where an agent acts in a disclosed agency capacity — making clear that it is merely facilitating a contract between the consumer and a named third party — the position is more nuanced, and the answer depends on the specific contractual structure.');

h2('My transaction');
deleteNote('Use the first option below if the agent sold in its own name. Use the second if it acted as a disclosed agent. Delete the option that does not apply.');

optionBox('OPTION A — Agent acted as principal (most common)',
  '[BOOKING AGENT OR INTERMEDIARY NAME] contracted with me as a principal. My contract was with [BOOKING AGENT NAME], not with any disclosed third party. Evidence: [DESCRIBE THE EVIDENCE — e.g. "my booking confirmation is issued by [AGENT NAME] and bears their company number and address" / "the terms and conditions state that the contract is between me and [AGENT NAME]" / "no named third-party principal is disclosed anywhere in the booking documentation"]. As [BOOKING AGENT NAME] was the contracting party and received the credit card payment, the debtor-creditor-supplier link under Section 12(b) of the Consumer Credit Act 1974 is satisfied.');

optionBox('OPTION B — Agent acted for a named underlying supplier',
  'Even if [BOOKING AGENT NAME] acted as a disclosed agent for [UNDERLYING SUPPLIER NAME], the debtor-creditor-supplier link may still be established. Where credit-card payments made to an agent are passed to the underlying supplier in settlement of the consumer\'s obligation, the economic substance of the transaction is that the credit financed the purchase from that underlying supplier. The Financial Ombudsman Service has upheld Section 75 claims in analogous circumstances where the economic reality of the transaction establishes the required link, even if the formal contractual structure involves an agent.');

h2('My position');
richText('The debtor-creditor-supplier link is established on the facts of this transaction. I am entitled to claim £[TOTAL AMOUNT CLAIMED] under Section 75 of the Consumer Credit Act 1974. Please issue a revised determination within 14 days.', { width: CW, paragraphGap: 6 });
para('If you maintain your rejection, I will refer this matter to the Financial Ombudsman Service and draw to their attention the specific grounds on which you have relied.');
signOff();
legRef('Legislation: Consumer Credit Act 1974, Sections 12 and 75: legislation.gov.uk/ukpga/1974/39/section/75 | legislation.gov.uk/ukpga/1974/39/section/12');

// ══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT 9 — FOS COMPLAINT LETTER
// ══════════════════════════════════════════════════════════════════════════════
startDoc('09', 'Financial Ombudsman Service Complaint Letter',
  'Your credit card provider has issued a final rejection of your Section 75 claim, or has not responded within eight weeks. Send this to the Financial Ombudsman Service within six months of the date on the bank\'s final response letter. The FOS service is free and its decisions are binding on the bank.');

addressBlock(['[YOUR FULL NAME]', '[YOUR ADDRESS LINE 1]', '[YOUR ADDRESS LINE 2]', '[YOUR TOWN OR CITY]', '[YOUR POSTCODE]', '[YOUR EMAIL ADDRESS]', '[YOUR PHONE NUMBER]']);
doc.moveDown(0.5);
para('[DATE]');
doc.moveDown(0.3);
addressBlock(['Financial Ombudsman Service', 'Exchange Tower', 'London', 'E14 9SR']);
doc.moveDown(0.3);
doc.font(FB).fontSize(11).fillColor(C_TEXT)
  .text('Complaint Against [CREDIT CARD PROVIDER NAME] — Refusal of Section 75 Claim', { width: CW });
doc.moveDown(0.4);
doc.font(F).fontSize(10).fillColor(C_TEXT);
para('Dear Sir or Madam,');
richText('I write to refer a complaint to the Financial Ombudsman Service against [CREDIT CARD PROVIDER NAME] (FCA firm reference number: [CREDIT CARD PROVIDER FCA FRN — find this at register.fca.org.uk]) in respect of their refusal of my Section 75 claim under the Consumer Credit Act 1974.', { width: CW, paragraphGap: 6 });

h2('Summary of the complaint');
richText('On [DATE OF ORIGINAL PURCHASE], I purchased [DESCRIPTION OF GOODS OR SERVICES] from [SUPPLIER OR COMPANY NAME] for a total price of £[TOTAL CONTRACT PRICE]. I paid £[AMOUNT CHARGED TO CREDIT CARD] on my [CREDIT CARD PROVIDER NAME] credit card, account ending [LAST FOUR DIGITS].', { width: CW, paragraphGap: 6 });
richText('The supplier subsequently [DESCRIBE THE FAILURE — e.g. "went into administration on [DATE] and failed to deliver the goods or services" / "delivered goods that were not of satisfactory quality" / "delivered goods materially different from their description"]. This constitutes a breach of contract.', { width: CW, paragraphGap: 6 });

h2('My claim and the bank\'s response');
richText('I made a formal Section 75 claim to [CREDIT CARD PROVIDER NAME] on [DATE OF ORIGINAL CLAIM LETTER], claiming £[TOTAL AMOUNT CLAIMED].', { width: CW, paragraphGap: 6 });
richText('[CREDIT CARD PROVIDER NAME] issued their final response on [DATE OF FINAL RESPONSE LETTER], rejecting my claim on the following grounds: [SUMMARISE THE BANK\'S STATED REASONS].', { width: CW, paragraphGap: 6 });
deleteNote('If you sent a rebuttal and received a second rejection, add: "I responded with a written rebuttal on [DATE]. The bank maintained their rejection by letter dated [DATE]." — otherwise delete this note.');

h2('Why the bank\'s decision is wrong');
para('The conditions of Section 75(1) of the Consumer Credit Act 1974 are satisfied:');
bullets([
  'The purchase was made using a regulated consumer credit agreement (my personal credit card).',
  'The total purchase price of £[TOTAL CONTRACT PRICE] is between £100 and £30,000 (Section 75(3)(b)).',
  'The supplier is in breach of contract as described above.',
]);
richText('[CREDIT CARD PROVIDER NAME] is jointly and severally liable with the supplier. Their stated reason for rejection is wrong because: [EXPLAIN BRIEFLY — e.g. "joint and several liability does not require me to pursue the supplier first" / "Section 75 covers the full contract value, not just the card portion" / "OFT v Lloyds TSB [2007] UKHL 48 confirms Section 75 applies to overseas purchases"].', { width: CW, paragraphGap: 6 });

h2('What I am asking the FOS to do');
para('I ask the Financial Ombudsman Service to investigate my complaint and direct [CREDIT CARD PROVIDER NAME] to pay me £[TOTAL AMOUNT CLAIMED] in full settlement of my Section 75 claim.');

h2('Confirmation of eligibility to complain');
bullets([
  'I am the named account holder.',
  'The bank\'s final response letter is dated [DATE OF FINAL RESPONSE]. I am referring this complaint within six months of that date (DISP 2.8.2R).',
  'I have not previously referred this complaint to the FOS.',
  'I have not commenced legal proceedings against [CREDIT CARD PROVIDER NAME] in respect of this matter.',
]);

h2('Documents enclosed');
bullets([
  'Copy of my original Section 75 claim letter dated [DATE]',
  'Copy of [CREDIT CARD PROVIDER NAME]\'s final response letter dated [DATE]',
  '[Copy of my rebuttal letter dated [DATE] — delete if not applicable]',
  '[Copy of the bank\'s response to my rebuttal dated [DATE] — delete if not applicable]',
  'Credit card statement showing the transaction',
  'Order confirmation or receipt from [SUPPLIER NAME]',
  '[Any further evidence — delete if not applicable]',
]);
para('I am happy to provide any further information the FOS requires. Please contact me at the email address above.');
signOff();
legRef('FOS: Exchange Tower, London, E14 9SR | 0800 023 4567 | financial-ombudsman.org.uk\nLegislation: Consumer Credit Act 1974, Section 75: legislation.gov.uk/ukpga/1974/39/section/75');

// ══════════════════════════════════════════════════════════════════════════════
//  POST-PROCESSING: headers and footers on all pages
// ══════════════════════════════════════════════════════════════════════════════
const range = doc.bufferedPageRange();

for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);

  const info = pageHeaders[i - range.start] || pageHeaders[pageHeaders.length - 1];
  const headerLabel = info.num ? `${info.num}. ${info.title}` : info.title;

  // Header: document title (left) + site (right)
  doc.font(FB).fontSize(8).fillColor(C_HEADER)
    .text(headerLabel, ML, HEADER_Y, { width: CW - 120 });
  doc.font(F).fontSize(8).fillColor(C_MUTED)
    .text('section75help.co.uk', ML, HEADER_Y, { width: CW, align: 'right' });

  // Thin rule below header
  doc.moveTo(ML, HEADER_Y + 10).lineTo(ML + CW, HEADER_Y + 10).lineWidth(0.3).strokeColor(C_RULE).stroke();

  // Footer: disclaimer (centre) + page number (right)
  const pageNum = (i - range.start + 1).toString();
  doc.font(F).fontSize(7).fillColor(C_MUTED)
    .text(FOOTER_TEXT, ML, FOOTER_Y, { width: CW - 30, lineGap: 0 });
  doc.font(F).fontSize(7).fillColor(C_MUTED)
    .text(pageNum, ML, FOOTER_Y, { width: CW, align: 'right' });

  // Thin rule above footer
  doc.moveTo(ML, FOOTER_Y - 4).lineTo(ML + CW, FOOTER_Y - 4).lineWidth(0.3).strokeColor(C_RULE).stroke();
}

doc.flushPages();
doc.end();

console.log(`\nSection 75 Claim Pack PDF generated successfully.`);
console.log(`Output: ${OUT_FILE}`);
console.log(`Pages:  ${range.count}`);
