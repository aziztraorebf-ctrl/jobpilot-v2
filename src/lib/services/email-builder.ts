/**
 * HTML email builders for Cowork notification endpoints.
 * These are simple HTML templates used when react-email is not needed.
 */

export interface ScoredJobSummary {
  title: string;
  company: string | null;
  location: string | null;
  sourceUrl: string;
  overallScore: number;
  matchingSkills: string[];
}

/**
 * Build an HTML email showing newly matched jobs.
 */
export function buildMatchNotificationHtml(
  jobs: ScoredJobSummary[],
  meta: { totalFetched: number; totalScored: number; errors: string[] }
): string {
  const rows = jobs
    .map(
      (j) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">
        <a href="${j.sourceUrl}" style="color:#2563eb;text-decoration:none;font-weight:600">${j.title}</a>
        <br><span style="color:#6b7280;font-size:13px">${j.company ?? "Unknown"} · ${j.location ?? "Remote"}</span>
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:${j.overallScore >= 75 ? "#16a34a" : j.overallScore >= 50 ? "#d97706" : "#ef4444"}">${j.overallScore}%</td>
      <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;color:#6b7280">${j.matchingSkills.slice(0, 5).join(", ")}</td>
    </tr>`
    )
    .join("");

  const errorSection =
    meta.errors.length > 0
      ? `<p style="color:#ef4444;font-size:13px">Warnings: ${meta.errors.join("; ")}</p>`
      : "";

  return `
<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:16px">
  <h2 style="color:#1e293b">🎯 ${jobs.length} New Match(es)</h2>
  <p style="color:#6b7280">Fetched ${meta.totalFetched} jobs, scored ${meta.totalScored}.</p>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#f8fafc">
        <th style="padding:8px;text-align:left">Job</th>
        <th style="padding:8px;text-align:center">Score</th>
        <th style="padding:8px;text-align:left">Skills</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${errorSection}
  <p style="color:#9ca3af;font-size:12px;margin-top:24px">Sent by JobPilot Cowork</p>
</body></html>`;
}

/**
 * Build an HTML email for stale application reminders.
 */
export function buildStaleReminderHtml(
  applications: {
    id: string;
    status: string;
    updated_at: string;
    job_listings: { title: string; company_name: string | null; source_url: string } | null;
  }[]
): string {
  const rows = applications
    .map((app) => {
      const job = app.job_listings;
      const daysSince = Math.floor(
        (Date.now() - new Date(app.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">
        ${job ? `<a href="${job.source_url}" style="color:#2563eb;text-decoration:none">${job.title}</a>` : "Unknown job"}
        <br><span style="color:#6b7280;font-size:13px">${job?.company_name ?? "Unknown"}</span>
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${app.status}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#d97706">${daysSince}d ago</td>
    </tr>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:16px">
  <h2 style="color:#1e293b">⏰ ${applications.length} Stale Application(s)</h2>
  <p style="color:#6b7280">These applications haven't been updated recently.</p>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#f8fafc">
        <th style="padding:8px;text-align:left">Job</th>
        <th style="padding:8px;text-align:center">Status</th>
        <th style="padding:8px;text-align:center">Last Update</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px">Sent by JobPilot Cowork</p>
</body></html>`;
}
