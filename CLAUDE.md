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

## Domain

- **Production domain:** section75help.co.uk
- **Repository:** https://github.com/iWonderBangi/section75help

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

## The Content Funnel

This is the core commercial engine of the site. Every piece of content exists to serve this three-layer funnel:

**Layer 1 — Hook:** A trigger page published within 48 hours of a UK business failure, ranking for "[company name] refund" and "[company name] administration" searches before any competitor.

**Layer 2 — Value:** The page, the master guide, the eligibility checker, and the category pages collectively answer every question a confused consumer has. They leave knowing exactly what to do. This trust is the entire conversion mechanism.

**Layer 3 — Convert:** The £6.99 claim pack removes the final friction — writing the actual letter. Every page on the site points toward it at the moment of maximum motivation (when the user understands their situation and knows they have a valid claim).

### Trigger page brief

When given a company name and failure details, produce a complete trigger page MDX file at `src/content/trigger/[company-slug].mdx` that does ALL of the following:

**Opening (first 150 words):**

- Opens with the specific financial loss the customer is facing. Use a real number if known ("You paid a £3,000 deposit for a kitchen that will never be installed") or a realistic range if not.
- Names the company and the date of administration or closure.
- States immediately and clearly that Section 75 of the Consumer Credit Act 1974 may entitle them to a full refund from their credit card provider.
- No preamble. No "In this article we will explore." The user is stressed and looking for a lifeline — give it to them in the first sentence.

**Body sections (in this order):**

1. **What happened** — factual summary of the business failure, administrator name if known, what customers are owed.
2. **Does Section 75 apply here?** — walk through the specific criteria as they apply to THIS company's customers. Address the most common edge cases: deposit only, part payment on card, purchased through a third party, bought as a gift.
3. **What evidence to gather** — a specific checklist for this type of purchase (not a generic list — tailored to whether it's a kitchen, holiday, furniture, wedding venue, etc.).
4. **How to make the claim** — link to the master guide for the full process, summarise the three key steps here.
5. **What your bank will say** — the two or three most likely rejection reasons for this specific type of claim, and the exact rebuttal for each.
6. **If your bank refuses** — one paragraph on FOS escalation, link to the FOS escalation guide.
7. **The claim pack CTA** — one honest, low-pressure paragraph explaining that the £6.99 claim pack includes a pre-written letter with the correct legal citations, a follow-up letter, and a rejection rebuttal. Link to /claim-pack/. No exclamation marks. No "get your refund today." Just: here is the tool, here is what it contains, here is the price.

**Tone and style throughout:**

- British English, no em-dashes.
- Honest about timelines (banks take 4–8 weeks, FOS backlogs are real).
- Sceptical of banks without being inflammatory.
- Empowering but never promising outcomes.
- Cite legislation.gov.uk for Section 75 references.
- Cite the FOS decisions database if referencing similar upheld cases.

**Frontmatter:**

```
title: "[Company Name] administration: how to claim your refund via Section 75"
description: "[Company Name] has gone into administration. If you paid by credit card, Section 75 of the Consumer Credit Act may entitle you to a full refund. Here is exactly how to claim."
publishedAt: [today's date]
updatedAt: [today's date]
category: trigger
disclaimer: true
company: [company name]
failureDate: [date of administration]
```

**Internal links (mandatory):**

- At least two links to the master guide (/guide/)
- One link to the eligibility checker (/)
- One link to the claim pack (/claim-pack/)
- One link to the FOS escalation guide (/guide/financial-ombudsman/) if it exists

**Definition of done for a trigger page:**

1. Opens with the specific loss scenario, not a generic intro.
2. Addresses the company's specific product/service type throughout — not generic Section 75 copy.
3. Zero TODOs or placeholders — complete content only.
4. All internal links present.
5. Claim pack CTA present, honest, low-pressure.
6. Frontmatter complete.
7. Disclaimer block included.
8. British English throughout, no em-dashes.
9. No outcome promises.
10. No content that implies we handle claims on behalf of the user.

### Trigger page one-shot prompt

When a new UK business failure is identified, use this prompt structure:

> "[Company name] has gone into administration as of [date]. They were a [type of business — kitchen installer / travel operator / furniture retailer / wedding venue etc.]. Customers are reporting losses of approximately [£X range] typically. The administrator is [name if known]. Write a complete trigger page following the trigger page brief in CLAUDE.md."

### Category page brief

Category pages follow the same funnel logic but target evergreen searches rather than breaking news. They rank more slowly but generate steady baseline traffic indefinitely.

Target searches: "Section 75 wedding deposit," "Section 75 kitchen installation," "Section 75 holiday booking," "Section 75 car deposit."

Structure mirrors the trigger page but opens with the category failure scenario ("Your wedding venue has cancelled and is refusing to refund your £8,000 deposit") rather than a named company. Include three to four real-world example scenarios within the page. Link to any relevant trigger pages for specific companies in that category.

### The weekly content rhythm

- **Monday:** Check Insolvency Service notices and the Gazette for new consumer-facing failures. Write any trigger pages needed.
- **Wednesday:** Check Google Search Console for pages gaining impressions but not clicks — improve their title tags and meta descriptions.
- **Friday:** Draft the newsletter (one trigger event summary, one consumer rights tip, one claim pack mention).

### Conversion optimisation rules

- Every page links to the claim pack at the point of maximum user motivation — after they understand their situation, not before.
- The eligibility checker on the homepage is the primary lead capture mechanism. Users who complete it and get a "likely eligible" result are the highest-intent visitors on the site.
- Never add pop-ups, countdown timers, or artificial scarcity. The audience is sceptical UK consumers who will leave immediately if they smell a sales tactic.
- The claim pack CTA must always include what is in the pack (the specific letters), the price (£6.99), and nothing else. No testimonials until real ones exist. No "money back guarantee" unless you actually offer one via Stripe.

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
