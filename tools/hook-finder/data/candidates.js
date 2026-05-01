// Mock candidate data for Phase 1 testing.
// All fields that come from external sources (insolvency notices, search data)
// must be verified by a human before any hook page is published.
// Replace this file with live API output in Phase 2.
//
// Each candidate has three editorial fields instead of a flat notes string:
//   verified_facts    — confirmed against an official primary source
//   unverified_signals — signals observed but not yet officially confirmed; do not present as facts
//   editorial_cautions — warnings the editor must resolve before drafting

export const candidates = [
  // --- Strong B2C candidate: furniture retailer in confirmed administration ---
  {
    company_number: "09876543",
    company_name: "Home Furnishing Direct Ltd",
    trading_name: "Sofa & Bed Warehouse",
    website: "sofabedwarehouse.co.uk",
    company_status: "in-administration",
    insolvency_type: "administration",
    insolvency_date: "2026-04-25",
    primary_source_url: "https://www.thegazette.co.uk/notice/mock-example-1",
    secondary_source_url: "https://www.insolvency-service.gov.uk/notices/mock-example-1",
    source_confidence_score: 19,
    sector: "furniture-retail",
    b2c_fit_score: 24,
    consumer_loss_score: 23,
    search_demand_score: 17,
    commercial_fit_score: 9,
    verified_facts: [
      "Administration confirmed via Gazette notice (mock-example-1, dated 2026-04-25)",
      "Company registered at Companies House as Home Furnishing Direct Ltd, number 09876543",
      "Trading name Sofa & Bed Warehouse confirmed on company website",
      "Business type: furniture and beds retailer selling direct to consumers",
    ],
    unverified_signals: [
      "Approximately 3,000 customers may hold outstanding delivery orders — figure not yet confirmed by administrator",
      "Estimated consumer exposure of £2.5m — figure from press report, not confirmed by administrator",
      "Administrator reported in press as Smith & Associates — verify against Gazette notice before publishing",
    ],
    editorial_cautions: [
      "Do not state customer numbers or loss figures until confirmed by a named official source",
      "Do not name the administrator until verified against the Gazette notice",
      "Confirm that all payments were made directly to the retailer, not via a third-party marketplace",
    ],
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-01T08:00:00Z",
  },

  // --- Weak B2B candidate: enterprise software company ---
  {
    company_number: "07654321",
    company_name: "B2B Cloud Systems Ltd",
    trading_name: "B2B Cloud Systems",
    website: "b2bcloudsystems.co.uk",
    company_status: "in-liquidation",
    insolvency_type: "creditors-voluntary-liquidation",
    insolvency_date: "2026-04-20",
    primary_source_url: "https://www.thegazette.co.uk/notice/mock-example-2",
    secondary_source_url: null,
    source_confidence_score: 17,
    sector: "b2b-software",
    b2c_fit_score: 4,
    consumer_loss_score: 3,
    search_demand_score: 2,
    commercial_fit_score: 1,
    verified_facts: [
      "Creditors' voluntary liquidation confirmed via Gazette notice (mock-example-2, dated 2026-04-20)",
      "Company sold SaaS platform exclusively to SME businesses under annual contracts",
      "No consumer-facing product found on company website",
    ],
    unverified_signals: [],
    editorial_cautions: [
      "Section 75 does not apply to business-to-business transactions made on company cards",
      "No consumer credit exposure identified — not suitable for a hook page",
    ],
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-01T08:00:00Z",
  },

  // --- Unclear candidate: travel operator, ATOL complicates Section 75 relevance ---
  {
    company_number: "11223344",
    company_name: "UK Travel Experiences Ltd",
    trading_name: "Wander Holidays",
    website: "wanderholidays.co.uk",
    company_status: "in-administration",
    insolvency_type: "administration",
    insolvency_date: "2026-04-29",
    primary_source_url: "https://www.thegazette.co.uk/notice/mock-example-3",
    secondary_source_url: "https://www.caa.co.uk/notices/mock-example-3",
    source_confidence_score: 14,
    sector: "travel",
    b2c_fit_score: 20,
    consumer_loss_score: 18,
    search_demand_score: 13,
    commercial_fit_score: 7,
    verified_facts: [
      "Administration confirmed via Gazette notice (mock-example-3, dated 2026-04-29)",
      "CAA notice found referencing the company (mock-example-3)",
      "Company operated as a package holiday provider selling direct to consumers",
    ],
    unverified_signals: [
      "Number of affected customers not yet confirmed by administrator",
      "Administrator details not yet confirmed — pending Gazette notice verification",
      "ATOL protection status unknown — CAA notice found but ATOL certificate status not confirmed",
    ],
    editorial_cautions: [
      "Do not publish until administrator details are confirmed from the Gazette notice",
      "Confirm ATOL protection status before drafting — if customers are ATOL-protected, Section 75 may be secondary",
      "Do not state customer numbers or loss figures until confirmed by a named official source",
    ],
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-01T08:00:00Z",
  },

  // --- Low confidence: kitchen installer, distress signals but no official notice ---
  {
    company_number: "55667788",
    company_name: "Premier Kitchen Installations Ltd",
    trading_name: "Premier Kitchens",
    website: "premierkitchens.co.uk",
    company_status: "unknown",
    insolvency_type: "unknown",
    insolvency_date: null,
    primary_source_url: null,
    secondary_source_url: "https://uk.trustpilot.com/review/premierkitchens.co.uk",
    source_confidence_score: 5,
    sector: "kitchen-installation",
    b2c_fit_score: 22,
    consumer_loss_score: 21,
    search_demand_score: 14,
    commercial_fit_score: 8,
    verified_facts: [
      "Company registered as active at Companies House (number 55667788) — status not insolvency",
    ],
    unverified_signals: [
      "Multiple recent Trustpilot reviews report non-delivery of kitchens and refusal to refund — source is customer reviews only, not an official notice",
      "Companies House annual accounts are reported as nine months overdue — possible financial distress signal",
      "Company website and phone lines reported as unresponsive by reviewers",
    ],
    editorial_cautions: [
      "No Gazette notice found — do not publish any claim that this company has gone into administration or liquidation",
      "Companies House status shows active — do not describe this company as insolvent",
      "All current signals are from customer reviews and overdue filings only; these are not official insolvency evidence",
      "Monitor Gazette and Companies House daily; do not act until an official notice is found",
    ],
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-01T08:00:00Z",
  },
];
