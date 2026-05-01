// Generates a Markdown page brief for high-scoring candidates.
// A brief is an editorial planning document, not a draft page.
// It must be reviewed and fact-checked before any Astro page is created.

const SECTOR_SEARCH_QUERIES = {
  "furniture-retail": [
    "[company name] administration refund",
    "[company name] gone bust refund",
    "[company name] delivery not arrived refund",
    "section 75 furniture deposit refund",
    "[company name] credit card refund",
  ],
  "kitchen-installation": [
    "[company name] administration refund",
    "[company name] kitchen not installed refund",
    "section 75 kitchen deposit",
    "[company name] gone into administration",
    "credit card refund kitchen company collapsed",
  ],
  travel: [
    "[company name] administration holiday refund",
    "[company name] collapsed refund",
    "section 75 holiday booking refund",
    "[company name] ATOL protection",
    "credit card refund [company name]",
  ],
  "b2b-software": [],
  default: [
    "[company name] administration refund",
    "section 75 [company name]",
    "[company name] gone bust credit card refund",
  ],
};

const SECTOR_EVIDENCE = {
  "furniture-retail": [
    "Order confirmation email or receipt showing total purchase price",
    "Credit card statement showing the payment — Section 75 can apply even where only part of the price was paid by credit card, provided the total cash price was more than £100 and no more than £30,000 and the other criteria are met",
    "Any delivery estimate or contract provided by the retailer",
    "Screenshots of the company's website or any communications about delivery",
    "Administrator's name and contact details from the Gazette notice",
  ],
  "kitchen-installation": [
    "Signed installation contract showing total price and payment schedule",
    "Credit card statement showing deposit or stage payments",
    "Any design plans, order acknowledgements, or delivery estimates provided",
    "Photographs of current state of the property if installation started but was abandoned",
    "Administrator's name and contact details from the Gazette notice",
  ],
  travel: [
    "Booking confirmation showing total package price",
    "Credit card statement showing payment(s)",
    "ATOL certificate (if issued) — this affects which route to prioritise",
    "Any correspondence with the operator about the collapse",
    "CAA notice or administrator appointment details",
  ],
  default: [
    "Proof of purchase showing the total price",
    "Credit card statement showing the payment",
    "Any contract, order confirmation, or delivery promise from the company",
    "Administrator appointment notice from the Gazette or Companies House",
  ],
};

const SECTOR_BANK_REJECTIONS = {
  "furniture-retail": [
    {
      rejection: '"The goods were never ordered from us — your contract was with the retailer."',
      rebuttal:
        "Section 75 of the Consumer Credit Act 1974 makes the credit card provider jointly liable with the supplier. You do not need a direct contract with the card provider.",
    },
    {
      rejection: '"You only paid a deposit, not the full price, so Section 75 does not apply."',
      rebuttal:
        "Section 75 can apply even where only part of the price was paid by credit card, provided the total cash price was more than £100 and no more than £30,000 and the other criteria are met. A deposit payment may be sufficient to support a Section 75 claim, provided the other criteria are met.",
    },
  ],
  "kitchen-installation": [
    {
      rejection: '"The work was partially completed, so you have received some value."',
      rebuttal:
        "If the company has gone into administration and cannot complete the contract, you are entitled to claim for the full outstanding loss — not just the unstarted portion. Document the current state of the installation.",
    },
    {
      rejection: '"We need evidence that the company has formally gone into administration."',
      rebuttal:
        "Provide the Gazette notice reference and the administrator's name. If you do not have these, the FOS can obtain them.",
    },
  ],
  travel: [
    {
      rejection: '"You should claim through ATOL, not Section 75."',
      rebuttal:
        "If your booking is ATOL-protected, that is usually the faster route. However, if ATOL protection is absent or delayed, Section 75 remains valid and can be pursued simultaneously. The bank cannot instruct you which remedy to use first.",
    },
    {
      rejection: '"Your contract was with a third-party booking agent, not the principal supplier."',
      rebuttal:
        "If the credit card payment was made directly to the operator, the Section 75 chain applies. If it was made to a booking agent acting as agent for the operator, seek FOS guidance — outcomes vary.",
    },
  ],
  default: [
    {
      rejection: '"We need a final response from the retailer before we can investigate."',
      rebuttal:
        "The company is in administration and cannot provide a response. The FCA expects credit card providers to proceed with Section 75 investigations based on the available evidence.",
    },
  ],
};

function getSectorQueries(sector, tradingName) {
  const queries = SECTOR_SEARCH_QUERIES[sector] ?? SECTOR_SEARCH_QUERIES.default;
  return queries.map((q) => q.replace(/\[company name\]/gi, tradingName));
}

export function getSectorEvidence(sector) {
  return SECTOR_EVIDENCE[sector] ?? SECTOR_EVIDENCE.default;
}

export function getSectorRejections(sector) {
  return SECTOR_BANK_REJECTIONS[sector] ?? SECTOR_BANK_REJECTIONS.default;
}

export function generateBrief(candidate) {
  const name = candidate.trading_name ?? candidate.company_name;
  const queries = getSectorQueries(candidate.sector, name);
  const evidence = getSectorEvidence(candidate.sector);
  const rejections = getSectorRejections(candidate.sector);

  const lines = [];

  lines.push(`# Hook Page Brief: ${name}`);
  lines.push("");
  lines.push("> **INTERNAL DOCUMENT — NOT FOR PUBLICATION**");
  lines.push("> Verify every fact in the 'Verified facts' section against the primary source before");
  lines.push("> passing this brief to a writer. Do not include any fact marked 'Unverified' in the");
  lines.push("> published page.");
  lines.push("");
  lines.push(`**Score:** ${candidate.total_score} / 100 | **Status:** ${candidate.status.toUpperCase()} | **Risk:** ${candidate.risk_level}`);
  lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## Suggested Hook Page Title");
  lines.push("");
  lines.push(`\`${name} administration: can customers claim a refund under Section 75?\``);
  lines.push("");
  lines.push("*Adjust if the company is in liquidation rather than administration — use the correct insolvency type in the title. The 'can customers claim' framing is preferred over 'how to claim your refund' because it does not imply the refund is guaranteed.*");
  lines.push("");

  lines.push("## Target Search Queries");
  lines.push("");
  queries.forEach((q) => lines.push(`- ${q}`));
  lines.push("");

  lines.push("## Verified Facts");
  lines.push("");
  lines.push("Tick each fact only after confirming it against the primary source.");
  lines.push("");
  lines.push(`- [ ] Company legal name: **${candidate.company_name}**`);
  lines.push(`- [ ] Company number: **${candidate.company_number}**`);
  lines.push(`- [ ] Insolvency type: **${candidate.insolvency_type}**`);
  lines.push(`- [ ] Insolvency date: **${candidate.insolvency_date ?? "NOT CONFIRMED — do not publish until confirmed"}**`);
  lines.push(`- [ ] Primary source: ${candidate.primary_source_url ?? "NOT FOUND — mandatory before publishing"}`);
  if (candidate.secondary_source_url) {
    lines.push(`- [ ] Secondary source: ${candidate.secondary_source_url}`);
  }
  lines.push(`- [ ] Administrator name and firm: **[Verify from Gazette notice — do not guess]**`);
  lines.push(`- [ ] Approximate number of affected consumers: **[Verify — do not estimate publicly]**`);
  lines.push("");

  lines.push("## Facts Not to Mention Unless Verified");
  lines.push("");
  lines.push(
    "These are plausible claims but must not appear in the published page unless confirmed by a named primary source."
  );
  lines.push("");
  lines.push("- Total value of consumer losses (do not state a figure unless confirmed by the administrator or press release)");
  lines.push("- Reasons for the company's failure (do not speculate)");
  lines.push("- Whether the company's directors are under investigation");
  lines.push("- Predicted outcomes or refund success rates — never promise a result");
  lines.push("- Bank-specific acceptance rates for this type of claim");
  lines.push("");

  lines.push("## Suggested Page Outline");
  lines.push("");
  lines.push("Follow the standard trigger-page structure used by this project. If CLAUDE.md is available, check it before drafting. Sections in order:");
  lines.push("");
  lines.push("1. **Opening (first 150 words):** Specific loss scenario, company name, date, and the Section 75 lifeline — no preamble.");
  lines.push("2. **What happened:** Factual summary of the failure. Administrator name. What customers are owed.");
  lines.push("3. **Does Section 75 apply?** Walk through the criteria for this company's specific customers. Address deposits, part-payment, and third-party purchases.");
  lines.push("4. **Evidence to gather:**");
  lines.push("");
  evidence.forEach((item) => lines.push(`   - ${item}`));
  lines.push("");
  lines.push("5. **How to make the claim:** Three key steps. Link to /guide/ for the full process.");
  lines.push("6. **What your bank will say:**");
  lines.push("");
  rejections.forEach(({ rejection, rebuttal }) => {
    lines.push(`   - *Bank says:* ${rejection}`);
    lines.push(`     *Rebuttal:* ${rebuttal}`);
    lines.push("");
  });
  lines.push("7. **If your bank refuses:** One paragraph on FOS escalation. Link to /guide/financial-ombudsman/.");
  lines.push("8. **Claim pack CTA:** Low-pressure, factual. See safety wording below.");
  lines.push("");

  lines.push("## Safety Wording");
  lines.push("");
  lines.push("Every page must include these elements — do not omit or soften them.");
  lines.push("");
  lines.push("**Disclaimer block (place near the top and foot of the page):**");
  lines.push("");
  lines.push("> This page provides general information about Section 75 of the Consumer Credit Act 1974.");
  lines.push("> It is not legal advice for your specific situation. We do not act for you, represent you to");
  lines.push("> your bank, or handle claims on your behalf. For advice tailored to your circumstances,");
  lines.push("> contact a solicitor or the Citizens Advice consumer helpline.");
  lines.push("");
  lines.push("**Outcome framing:** Never write 'you will get a refund' or 'banks must pay.' Write");
  lines.push("'Section 75 *may* entitle you to a refund' and 'if your claim meets the criteria.'");
  lines.push("");
  lines.push("**No CMC framing:** Do not write anything that implies we will handle, submit, or");
  lines.push("escalate the claim on the reader's behalf.");
  lines.push("");

  lines.push("## Do Not Publish If");
  lines.push("");
  lines.push(
    "Before this brief is passed to a writer, confirm that none of the following apply. If any do, do not proceed until they are resolved."
  );
  lines.push("");
  lines.push("- [ ] No official source has confirmed the insolvency event (Gazette notice, Companies House filing, or Insolvency Service announcement).");
  lines.push("- [ ] The company name is ambiguous — there are multiple companies trading under the same or a similar name.");
  lines.push("- [ ] The page would rely solely on customer reviews, social media posts, or press rumour, with no official primary source.");
  lines.push("- [ ] Customer numbers or consumer loss figures have not been verified against a named, citable source.");
  lines.push("- [ ] Any draft copy implies guaranteed refunds, specific recovery amounts, or claims-management services.");
  lines.push("");

  lines.push("## Recommended CTA to Claim Pack");
  lines.push("");
  lines.push("Use this wording (or a close variant). Do not add exclamation marks, urgency language, or testimonials.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`**Writing the letter yourself?**`);
  lines.push("");
  lines.push(
    `The Section 75 claim pack (£6.99) includes a pre-written claim letter with the correct legal citations under the Consumer Credit Act 1974, a follow-up letter for use if your bank is slow to respond, and a rejection rebuttal for use if your bank declines. The templates are designed for ${candidate.sector.replace(/-/g, " ")} claims and cover common Section 75 disputes, including non-delivery, faulty goods, goods not as described, and business failure.`
  );
  lines.push("");
  lines.push("[Get the claim pack — £6.99](/claim-pack/)");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("**Internal links required on the published page:**");
  lines.push("");
  lines.push("- At least two links to /guide/");
  lines.push("- One link to / (eligibility checker)");
  lines.push("- One link to /claim-pack/");
  lines.push("- One link to /guide/financial-ombudsman/");
  lines.push(`- One link to the relevant category page for ${candidate.sector} (if it exists)`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*This brief was generated by tools/hook-finder — Phase 1 prototype.*");
  lines.push("*All facts must be independently verified before a page is drafted.*");

  return lines.join("\n");
}
