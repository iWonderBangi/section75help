# section75help.co.uk

UK consumer rights information and template service for Section 75 claims under the Consumer Credit Act 1974. The site helps people understand whether they have a valid Section 75 claim against their credit card provider, walks them through the process, and sells a £6.99 template claim pack.

**This is a private commercial project. It is not open source.**

## Site

[section75help.co.uk](https://section75help.co.uk)

## Built with

- [Astro](https://astro.build) — static site generator
- [Tailwind CSS v4](https://tailwindcss.com) — styling via `@tailwindcss/vite`
- [Cloudflare Pages](https://pages.cloudflare.com) — hosting and deployment
- [Stripe Payment Links](https://stripe.com/gb/payments/payment-links) — claim pack payments
- [Formspree](https://formspree.io) — contact form

## Folder structure

```
src/
  components/       Astro components (EligibilityChecker, Disclaimer)
  content/
    guide/          Long-form guide pages (MDX)
    trigger/        Company-specific failure pages (MDX)
    category/       Category pages — weddings, holidays, kitchens, etc. (MDX)
  layouts/          BaseLayout.astro
  pages/            File-based routes
  styles/           global.css (Tailwind entry point)
  templates/        HTML source files for the nine claim pack documents
scripts/
  generate-pdf.cjs  Builds the claim pack PDF from the HTML templates (pdfkit)
public/
  downloads/        Built PDF served at /downloads/section-75-claim-pack.pdf
```

## Running locally

```sh
npm install
npm run dev
```

Dev server runs at `http://localhost:4321`.

To regenerate the claim pack PDF after editing the HTML templates:

```sh
node scripts/generate-pdf.cjs
```

Output is written to `public/downloads/section-75-claim-pack.pdf`.

## Deployment

Push to `main` on GitHub. Cloudflare Pages picks up the change automatically, runs `npm run build`, and deploys the `dist/` output. No manual steps required.

Build command: `npm run build`  
Output directory: `dist`
