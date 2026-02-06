import { describe, it, expect } from "vitest";
import { searchAdzuna } from "@/lib/api/adzuna";
import { searchJSearch } from "@/lib/api/jsearch";
import { deduplicateJobs } from "@/lib/services/deduplicator";
import { scoreMatch } from "@/lib/services/match-scorer";
import { Resend } from "resend";
import type { UnifiedJob } from "@/lib/schemas/job";
import type { MatchScore } from "@/lib/schemas/ai-responses";

// Resend free plan: can only send to account email
const RESEND_TEST_EMAIL = "aziztraorebf@gmail.com";

// CV data for scoring
const CV_DATA = {
  skills: {
    technical: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Python", "Docker", "AWS"],
    soft: ["Problem solving", "Team leadership", "Agile/Scrum"],
    languages: ["French", "English"],
  },
  experience: [
    {
      title: "Senior Developer",
      company: "TechCorp Inc.",
      description: "Built SaaS platform with React and Next.js, CI/CD with Docker, mentored junior devs",
    },
    {
      title: "Full-Stack Developer",
      company: "StartupXYZ",
      description: "REST APIs with Node.js and Express, PostgreSQL database design, test coverage improvement",
    },
  ],
  summary: "Experienced full-stack developer with 5 years in web application development",
};

interface ScoredJob {
  job: UnifiedJob;
  score: MatchScore;
  tokensUsed: number;
}

function buildEmailHtml(
  scoredJobs: ScoredJob[],
  stats: {
    totalJSearch: number;
    totalAdzuna: number;
    deduplicated: number;
    scored: number;
    totalTokens: number;
    errors: string[];
  }
): string {
  const jobRows = scoredJobs
    .sort((a, b) => b.score.overall_score - a.score.overall_score)
    .map(
      (sj) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">
          <a href="${sj.job.source_url}" style="color: #2563eb; text-decoration: none;">${sj.job.title}</a>
        </td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${sj.job.company_name || "N/A"}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${sj.job.location || "N/A"}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">
          <span style="
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: bold;
            color: white;
            background: ${sj.score.overall_score >= 70 ? "#16a34a" : sj.score.overall_score >= 50 ? "#ca8a04" : "#dc2626"};
          ">${sj.score.overall_score}/100</span>
        </td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 12px;">${sj.score.matching_skills.slice(0, 5).join(", ")}</td>
      </tr>`
    )
    .join("");

  const errorSection =
    stats.errors.length > 0
      ? `<div style="background: #fef2f2; padding: 12px; border-radius: 8px; margin-top: 16px;">
          <strong style="color: #dc2626;">Erreurs:</strong>
          <ul>${stats.errors.map((e) => `<li>${e}</li>`).join("")}</ul>
        </div>`
      : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1e293b; border-bottom: 3px solid #2563eb; padding-bottom: 12px;">
        JobPilot - Rapport de test d'integration
      </h1>

      <div style="display: flex; gap: 16px; margin: 16px 0;">
        <div style="flex: 1; background: #f0f9ff; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${stats.totalJSearch}</div>
          <div style="color: #64748b; font-size: 12px;">JSearch</div>
        </div>
        <div style="flex: 1; background: #f0fdf4; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${stats.totalAdzuna}</div>
          <div style="color: #64748b; font-size: 12px;">Adzuna</div>
        </div>
        <div style="flex: 1; background: #faf5ff; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #7c3aed;">${stats.deduplicated}</div>
          <div style="color: #64748b; font-size: 12px;">Apres dedup</div>
        </div>
        <div style="flex: 1; background: #fffbeb; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #ca8a04;">${stats.totalTokens}</div>
          <div style="color: #64748b; font-size: 12px;">Tokens OpenAI</div>
        </div>
      </div>

      <h2 style="color: #1e293b; margin-top: 24px;">Top offres scorees (${stats.scored} analysees)</h2>

      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0;">Poste</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0;">Entreprise</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0;">Lieu</th>
            <th style="padding: 8px; text-align: center; border: 1px solid #e2e8f0;">Score</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0;">Skills</th>
          </tr>
        </thead>
        <tbody>
          ${jobRows}
        </tbody>
      </table>

      ${errorSection}

      <p style="color: #94a3b8; font-size: 11px; margin-top: 24px; text-align: center;">
        Genere automatiquement par les tests d'integration JobPilot | ${new Date().toISOString()}
      </p>
    </div>
  `;
}

describe("Full Pipeline - Integration", () => {
  it("should search -> deduplicate -> score -> email summary", async () => {
    const keyword = "full stack developer";
    const location = "Montreal";

    // ---- Step 1: Search both APIs ----
    console.log("\n--- STEP 1: Searching jobs ---");
    const [jsearchResult, adzunaResult] = await Promise.allSettled([
      searchJSearch({ query: `${keyword} in ${location}`, country: "ca" }),
      searchAdzuna({ keywords: keyword, location, resultsPerPage: 5 }),
    ]);

    const errors: string[] = [];
    let jsearchJobs: UnifiedJob[] = [];
    let adzunaJobs: UnifiedJob[] = [];
    let totalJSearch = 0;
    let totalAdzuna = 0;

    if (jsearchResult.status === "fulfilled") {
      jsearchJobs = jsearchResult.value.jobs;
      totalJSearch = jsearchResult.value.total;
      console.log(`[Pipeline] JSearch: ${jsearchJobs.length} jobs`);
    } else {
      errors.push(`JSearch: ${jsearchResult.reason}`);
      console.log(`[Pipeline] JSearch FAILED: ${jsearchResult.reason}`);
    }

    if (adzunaResult.status === "fulfilled") {
      adzunaJobs = adzunaResult.value.jobs;
      totalAdzuna = adzunaResult.value.total;
      console.log(`[Pipeline] Adzuna: ${adzunaJobs.length} jobs (total: ${totalAdzuna})`);
    } else {
      errors.push(`Adzuna: ${adzunaResult.reason}`);
      console.log(`[Pipeline] Adzuna FAILED: ${adzunaResult.reason}`);
    }

    // At least one source should work
    const allJobs = [...jsearchJobs, ...adzunaJobs];
    expect(allJobs.length).toBeGreaterThan(0);

    // ---- Step 2: Deduplicate ----
    console.log("\n--- STEP 2: Deduplicating ---");
    const deduplicated = deduplicateJobs(allJobs);
    console.log(`[Pipeline] Before dedup: ${allJobs.length}, After: ${deduplicated.length}`);

    // ---- Step 3: Score top 3 jobs with OpenAI ----
    console.log("\n--- STEP 3: Scoring with OpenAI ---");
    const toScore = deduplicated.slice(0, 3);
    const scoredJobs: ScoredJob[] = [];
    let totalTokens = 0;

    for (const job of toScore) {
      const jobDesc = [
        job.title,
        job.company_name ? `Company: ${job.company_name}` : "",
        job.location ? `Location: ${job.location}` : "",
        job.description || "",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const result = await scoreMatch(CV_DATA, jobDesc);
        scoredJobs.push({ job, score: result.score, tokensUsed: result.tokensUsed });
        totalTokens += result.tokensUsed;

        console.log(`[Pipeline] "${job.title}" -> Score: ${result.score.overall_score}/100 (${result.tokensUsed} tokens)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Scoring "${job.title}": ${msg}`);
        console.log(`[Pipeline] Scoring FAILED for "${job.title}": ${msg}`);
      }
    }

    expect(scoredJobs.length).toBeGreaterThan(0);

    // ---- Step 4: Send email summary ----
    console.log("\n--- STEP 4: Sending email summary ---");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const html = buildEmailHtml(scoredJobs, {
      totalJSearch,
      totalAdzuna,
      deduplicated: deduplicated.length,
      scored: scoredJobs.length,
      totalTokens,
      errors,
    });

    const { data, error } = await resend.emails.send({
      from: "JobPilot <onboarding@resend.dev>",
      to: RESEND_TEST_EMAIL,
      subject: `[JobPilot] Rapport d'integration - ${scoredJobs.length} offres analysees`,
      html,
    });

    if (error) {
      console.error(`[Pipeline] Email error: ${error.name} - ${error.message}`);
    }

    expect(error).toBeNull();
    expect(data?.id).toBeDefined();

    console.log(`\n[Pipeline] Email sent! ID: ${data?.id}`);
    console.log(`[Pipeline] RESUME:`);
    console.log(`  - JSearch: ${totalJSearch} resultats, ${jsearchJobs.length} retournes`);
    console.log(`  - Adzuna: ${totalAdzuna} resultats, ${adzunaJobs.length} retournes`);
    console.log(`  - Apres dedup: ${deduplicated.length} offres uniques`);
    console.log(`  - Scorees: ${scoredJobs.length} offres`);
    console.log(`  - Tokens OpenAI: ${totalTokens}`);
    console.log(`  - Erreurs: ${errors.length}`);

    if (errors.length > 0) {
      console.log(`  - Detail erreurs: ${errors.join("; ")}`);
    }
  }, 120000); // 2 min timeout for full pipeline
});
