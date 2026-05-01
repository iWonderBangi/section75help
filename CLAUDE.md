# Section 75 Claim Helper — Project Context

## What this project is

A UK consumer-rights site that helps people determine whether they have a valid Section 75 claim against their credit card provider, walks them through the process, and sells a £6.99 templated claim pack. Affiliate revenue from UK credit card and financial product referrals layered on top.

**The core value proposition in one sentence:** Section 75 of the Consumer Credit Act 1974 makes credit card providers jointly liable with retailers for purchases between £100 and £30,000, even if only £1 was paid on the card — and most Brits don't know this or don't claim properly.

## What this project is NOT

- **Not a claims management company.** We do not handle claims on behalf of users, take contingent fees, or represent users to banks. Doing any of those things triggers FCA regulation under FSMA. We are an information service and template provider. This line must never be crossed in copy, product design, or feature scope.
- **Not legal advice.** Every page must carry a clear disclaimer that content is general information, not legal advice for the user's specific situation.
- **Not a competitor to MoneySavingExpert at the broad level.** We win on depth and timeliness in a single niche, not breadth.

## Audience

UK consumers, primarily 30–65, who have a specific problem: a retailer has gone bust, refused a refund, delivered something faulty, or otherwise failed them on a purchase paid (even partly) on a credit card. They are usually arriving via Google with a specific trigger event ("[company name] administration refund") or a category query ("Section 75 wedding deposit").

They are sceptical of anything that looks like a scam or a CMC. Tone must be plain, honest, slightly sceptical of banks, and confident about the law. British English throughout. No em-dashes. No marketing hype. No "unlock your refund today!" language. Think MoneySavingExpert's editorial voice, not a debt-help advert.

## House style

- **British English.** "Organisation," "favour," "specialised," "cheque." Sterling symbol, never $.
- **No em-dashes.** Use commas, semicolons, full stops, or parentheses.
- **No emoji.** Not in copy, not in headings, not in CTAs.
- **Specific numbers, not vague ones.** "£100 to £30,000" not "small to large purchases." "Six years in England and Wales, five in Scotland" not "several years."
- **Open with the failure scenario, not the product.** Articles start with the specific situation a user is in ("Your kitchen company has gone into administration and you've lost your £4,000 deposit") not with a product pitch or a generic intro.
- **Honest framing.** If banks routinely reject valid claims at first attempt, say so. If FOS escalation takes months, say so. Empowering but realistic.
- **Prices in GBP, real ones.** No "around £X" hedging when actual figures are knowable.

## Tech stack

- **Hosting:** Cloudflare Pages (free tier).
- **Framework:** Astro for the site (static-first, fast, good MDX support for content). Plain HTML+JS is acceptable for the eligibility tool if simpler.
- **Styling:** Tailwind. No component library. Keep visual design clean and trustworthy — the site needs to look like a serious resource, not a startup.
- **Payments:** Stripe Payment Links for the £6.99 claim pack initially. Move to Gumroad if Stripe onboarding stalls. Do not build a custom checkout.
- **Email capture:** Buttondown or Listmonk. Not Mailchimp (overkill, expensive at scale).
- **Analytics:** Plausible (paid, ~£9/month, GDPR-friendly) or Cloudflare Web Analytics (free). Do not use Google Analytics — adds cookie banner complexity for a UK audience and isn't worth it.
- **Search Console:** Google Search Console is mandatory. Bing Webmaster Tools as a secondary.
- **No JavaScript framework on content pages.** Article pages must be static HTML for speed and SEO. The eligibility checker can be a small island of JS (Astro islands or vanilla).

## Site structure

```
/                           → Homepage with eligibility checker tool
/guide/                     → Master Section 75 guide (3,000–4,000 words)
/guide/section-75-vs-chargeback/   → High-volume comparison page
/guide/financial-ombudsman/        → FOS escalation guide
/category/[topic]/          → Category pages (weddings, holidays, kitchens, etc.)
/trigger/[company-slug]/    → Trigger event pages for specific business failures
/claim-pack/                → Sales page for the £6.99 download
/about/                     → Who we are, what we do, what we don't do
/disclaimer/                → Legal disclaimers, affiliate disclosure
/contact/                   → Contact form (no phone number)
```

## Eligibility checker logic

A five-step decision tree. Plain JS, no backend needed.

1. **Did you pay at least £1 of the purchase on a credit card?** (Yes / No / Not sure)
- No → not eligible for Section 75, but may be eligible for chargeback (route to chargeback guide).
1. **Was the total purchase price between £100 and £30,000?**
- Under £100 → not eligible, route to chargeback.
- Over £30,000 → not eligible under Section 75, mention possible Section 75A for some loans.
1. **What went wrong?** (Multi-select: non-delivery / faulty / not as described / business closed / fraud / other)
1. **When did you make the purchase?**
- Over 6 years ago (England/Wales) or 5 years (Scotland) → likely time-barred, flag this.
1. **Was this a personal purchase, or for a business?**
- Business purchases via a sole trader's personal card are still eligible; limited company card purchases generally aren't.

Output: a clear yes/likely/maybe/no with one paragraph of reasoning, and a CTA to the claim pack if eligible.

## Content priorities

In rough order of SEO value:

1. **Master guide** — the anchor page. Updated quarterly.
1. **Section 75 vs chargeback** — high search volume, common confusion.
1. **Trigger event pages** — written within 48 hours of any consumer-facing UK business failure. Source: Insolvency Service notices, the Gazette, trade press.
1. **Category pages** — wedding deposits, kitchen installations, holiday bookings, car deposits, gym memberships, furniture, building work.
1. **Bank-specific pages** — "How [Bank] handles Section 75 claims" for the major UK banks. Be honest about which ones are difficult.
1. **FOS escalation guide** — for when the bank rejects.

Each trigger and category page follows the same template: failure scenario → why Section 75 applies → specific evidence to gather → claim letter pointer → expected timeline → FOS escalation note.

## Monetisation

- **Primary:** £6.99 claim pack (Stripe/Gumroad). This is the £1/day floor.
- **Secondary:** Awin affiliate links to UK credit cards. Recommend on the basis of genuine Section 75 user experience, not commission rate. Disclose clearly.
- **Tertiary (later):** £3/month newsletter tier with early access to new trigger templates and a Q&A thread.

No display ads. No CMC referrals (conflict with our positioning). No "free" trial subscriptions that auto-bill.

## Legal and compliance constraints

These are non-negotiable. Anything that risks crossing them gets flagged to the human before shipping.

- **No claims handling.** We never act for the user.
- **No contingent fees.** Flat price for templates only.
- **Clear affiliate disclosure** at the top of any page with affiliate links, per ASA CAP Code.
- **GDPR.** Email capture requires a clear opt-in. No pre-ticked boxes. Privacy policy must list what we collect and why.
- **No misleading claims** about success rates or refund amounts. Use ranges sourced from FOS published data.
- **No trademark issues.** Don't run paid ads on bank or retailer trademarks. Don't use bank logos beyond fair-dealing editorial use.
- **No scraped content** from MSE, Which?, Citizens Advice, or the FOS. Original writing only, with citations to primary sources (legislation.gov.uk, FOS decisions database, gov.uk).

## SEO approach

- **Long-tail first.** "[Company] administration refund Section 75" beats "Section 75" for the first six months.
- **Internal linking.** Every trigger page links to the master guide, the relevant category page, and the claim pack.
- **Schema markup.** FAQPage schema on the master guide. Article schema on trigger pages.
- **No AI-generated content shipped without a heavy editorial pass.** Helpful Content updates penalise template-feel pages. Every page needs at least one specific, original detail a generic AI write-up wouldn't include.
- **Page speed matters.** Static pages, lazy-loaded images, no heavy JS on content pages. Lighthouse score 95+ on mobile.

## Workflows Claude Code should help with

- Writing new trigger event pages on a tight 48-hour turnaround when a UK business fails.
- Updating the master guide when there's a relevant FOS ruling or law change.
- Building and maintaining the eligibility checker.
- Writing category pages following the established template.
- Drafting the claim pack letter templates (these need careful legal language — flag for human review before shipping).
- Producing the weekly Friday newsletter draft.
- Improving SEO on existing pages based on Search Console data.

## What to flag rather than do

- Anything that drifts toward representing the user to the bank.
- Any copy that promises a specific refund outcome.
- Any content that quotes more than a sentence or two from MSE, Which?, or other competitor sites.
- Any affiliate placement that prioritises commission over genuine user fit.
- Any change to the claim pack templates that affects legal language without human review.

## File and folder conventions

- Content in MDX under `src/content/`.
- Trigger pages under `src/content/trigger/`, slug = company name in kebab case.
- Category pages under `src/content/category/`.
- Components in `src/components/`, PascalCase.
- Eligibility checker as a self-contained Astro island in `src/components/EligibilityChecker.astro`.
- All content frontmatter includes: `title`, `description`, `publishedAt`, `updatedAt`, `category`, `disclaimer: true`.

## Performance targets

- Lighthouse mobile: 95+ across the board.
- Largest Contentful Paint under 1.5s on 4G.
- No layout shift on the eligibility checker.
- Static HTML for all content pages.

## Definition of done for a new content page

1. British English, house style, no em-dashes.
1. Opens with a specific failure scenario.
1. Cites primary sources (legislation, FOS, gov.uk) where claims of fact are made.
1. Internal links to master guide, relevant category, and claim pack.
1. Disclaimer block included.
1. Frontmatter complete.
1. Affiliate disclosure visible if affiliate links present.
1. Schema markup where applicable.
1. Mobile-readable (no walls of text, sensible heading hierarchy).
1. Reviewed for any drift toward "we'll handle your claim" framing.
