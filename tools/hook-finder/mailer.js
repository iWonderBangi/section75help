// Sends the daily Hook Finder report email via Resend (https://resend.com).
//
// Required env:
//   RESEND_API_KEY   — free at resend.com (3,000 emails/month, 100/day)
//   REPORT_EMAIL_TO  — recipient address (your inbox)
//
// Optional env:
//   REPORT_EMAIL_FROM — sender address; must be a verified Resend domain.
//                       Defaults to "Hook Finder <onboarding@resend.dev>",
//                       which works for testing without domain verification.
//                       For production use, verify section75help.co.uk in
//                       the Resend dashboard and set this to:
//                       "Hook Finder <hook-finder@section75help.co.uk>"
//
// If RESEND_API_KEY or REPORT_EMAIL_TO are not set, email is skipped and
// a warning is logged. The rest of the run continues normally.

const RESEND_API = "https://api.resend.com/emails";

export async function sendDailyReport({ scored, date, totalFetched, runUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, warning: "RESEND_API_KEY is not set — email skipped." };
  }

  const to = process.env.REPORT_EMAIL_TO;
  if (!to) {
    return {
      sent: false,
      warning: "REPORT_EMAIL_TO is not set — email skipped.",
    };
  }

  const from =
    process.env.REPORT_EMAIL_FROM ?? "Hook Finder <onboarding@resend.dev>";

  const actionable = scored.filter(
    (c) => c.status === "needs_review" || c.status === "monitoring"
  );

  const subject =
    actionable.length > 0
      ? `Hook Finder — ${actionable.length} notice${actionable.length !== 1 ? "s" : ""} worth reviewing — ${date}`
      : `Hook Finder — nothing consumer-facing today — ${date}`;

  const html = generateEmailHtml({ scored, date, totalFetched, runUrl });
  const text = generateEmailText({ scored, date, totalFetched, runUrl });

  let res;
  try {
    res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
  } catch (err) {
    return { sent: false, warning: `Email network error: ${err.message}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    return {
      sent: false,
      warning: `Resend API error ${res.status}: ${body}`,
    };
  }

  return { sent: true, warning: null };
}

// ─── HTML email ───────────────────────────────────────────────────────────────

function generateEmailHtml({ scored, date, totalFetched, runUrl }) {
  const needsReview = scored.filter((c) => c.status === "needs_review");
  const monitoring = scored.filter((c) => c.status === "monitoring");
  const rejected = scored.filter((c) => c.status === "rejected");

  const s = (n) => (n !== 1 ? "s" : "");

  const intro =
    needsReview.length + monitoring.length > 0
      ? `${totalFetched} insolvency notice${s(totalFetched)} in the last 24 hours. ${needsReview.length + monitoring.length} appear consumer-facing.`
      : `${totalFetched} insolvency notice${s(totalFetched)} in the last 24 hours — none appear consumer-facing.`;

  const artifactLine = runUrl
    ? `<p style="margin:0 0 16px"><a href="${escHtml(runUrl)}" style="color:#0070f3">View full report and briefs in GitHub Actions</a></p>`
    : "";

  const sections = [];

  if (needsReview.length > 0) {
    sections.push(`
      <h3 style="margin:24px 0 8px;color:#b91c1c;font-size:16px">Act now — needs review (${needsReview.length})</h3>
      ${needsReview.map((c) => candidateRow(c, "#fff3cd", "#92400e")).join("")}
    `);
  }

  if (monitoring.length > 0) {
    sections.push(`
      <h3 style="margin:24px 0 8px;color:#1e3a5f;font-size:16px">Monitor — check back in 48 hours (${monitoring.length})</h3>
      ${monitoring.map((c) => candidateRow(c, "#e0f0ff", "#1e3a5f")).join("")}
    `);
  }

  if (rejected.length > 0) {
    sections.push(`
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px">${rejected.length} company${s(rejected.length)} scored below threshold (likely B2B or insufficient evidence) — not shown.</p>
    `);
  }

  if (sections.length === 0) {
    sections.push(`
      <p style="color:#4b5563;margin:16px 0">No consumer-facing insolvencies identified today. The system is running normally.</p>
    `);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">

  <h2 style="margin:0 0 4px;font-size:20px;color:#111">Hook Finder</h2>
  <p style="margin:0 0 20px;color:#6b7280;font-size:14px">${escHtml(date)} · Gazette insolvency notices</p>

  <p style="margin:0 0 20px;font-size:15px">${escHtml(intro)}</p>

  ${sections.join("\n")}

  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
  ${artifactLine}
  <p style="margin:0;color:#9ca3af;font-size:12px">
    Hook Finder · Internal use only · Do not publish claims without verifying against official sources.
  </p>

</div>
</body>
</html>`;
}

function candidateRow(c, bgColor, textColor) {
  const name = escHtml(c.trading_name ?? c.company_name ?? "Unknown company");
  const sector = escHtml(c.sector ?? "—");
  const type = escHtml(c.insolvency_type ?? "insolvency");
  const date = escHtml(c.insolvency_date ?? "date unknown");
  const score = c.total_score;
  const sourceUrl = c.primary_source_url;

  const sourceLink = sourceUrl
    ? `<a href="${escHtml(sourceUrl)}" style="color:#0070f3;font-size:13px">Gazette notice</a>`
    : `<span style="color:#9ca3af;font-size:13px">No source URL</span>`;

  const ambigu = c.ambiguous_company
    ? `<span style="color:#92400e;font-size:12px"> — company identity uncertain</span>`
    : "";

  return `
    <div style="margin:0 0 8px;padding:12px 14px;background:${bgColor};border-radius:6px;border-left:4px solid ${textColor}">
      <div style="font-weight:bold;font-size:15px;color:#111">${name}${ambigu}</div>
      <div style="margin:4px 0;color:#374151;font-size:13px">
        ${type} &middot; ${sector} &middot; Score: <strong>${score}/100</strong> &middot; ${date}
      </div>
      <div>${sourceLink}</div>
    </div>`;
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Plain text fallback ──────────────────────────────────────────────────────

function generateEmailText({ scored, date, totalFetched, runUrl }) {
  const needsReview = scored.filter((c) => c.status === "needs_review");
  const monitoring = scored.filter((c) => c.status === "monitoring");
  const rejected = scored.filter((c) => c.status === "rejected");

  const lines = [];
  lines.push(`Hook Finder — ${date}`);
  lines.push(`${totalFetched} Gazette insolvency notice(s) in the last 24 hours.`);
  lines.push("");

  if (needsReview.length > 0) {
    lines.push(`ACT NOW — NEEDS REVIEW (${needsReview.length})`);
    needsReview.forEach((c) => {
      lines.push(`  ${c.trading_name ?? c.company_name} — ${c.insolvency_type} — Score: ${c.total_score}/100`);
      if (c.primary_source_url) lines.push(`  ${c.primary_source_url}`);
      lines.push("");
    });
  }

  if (monitoring.length > 0) {
    lines.push(`MONITOR (${monitoring.length})`);
    monitoring.forEach((c) => {
      lines.push(`  ${c.trading_name ?? c.company_name} — ${c.insolvency_type} — Score: ${c.total_score}/100`);
      if (c.primary_source_url) lines.push(`  ${c.primary_source_url}`);
      lines.push("");
    });
  }

  if (rejected.length > 0) {
    lines.push(`${rejected.length} company/companies scored below threshold (likely B2B) — not shown.`);
    lines.push("");
  }

  if (needsReview.length === 0 && monitoring.length === 0) {
    lines.push("No consumer-facing insolvencies identified today.");
    lines.push("");
  }

  if (runUrl) lines.push(`Full report: ${runUrl}`);
  lines.push("Internal use only. Do not publish without verifying against official sources.");

  return lines.join("\n");
}
