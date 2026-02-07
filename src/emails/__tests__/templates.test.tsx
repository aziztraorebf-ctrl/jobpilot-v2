import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { NewJobsAlert } from "../new-jobs-alert";
import { WeeklySummary } from "../weekly-summary";
import { FollowUpReminder } from "../follow-up-reminder";

/**
 * Strip HTML tags and React SSR comments (<!-- -->) so we can assert
 * on the visible text content produced by each template.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("NewJobsAlert template", () => {
  it("renders with jobs above threshold", async () => {
    const html = await render(
      NewJobsAlert({
        jobs: [
          {
            title: "Dev",
            company: "Acme",
            location: "Montreal",
            score: 85,
            sourceUrl: "https://example.com",
          },
        ],
        threshold: 60,
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("Dev");
    expect(text).toContain("Acme");
    expect(text).toContain("Score: 85%");
    expect(text).toContain("Montreal");
    expect(html).toContain("https://example.com");
    expect(text).toContain("1 offre(s)");
  });

  it("renders multiple jobs", async () => {
    const html = await render(
      NewJobsAlert({
        jobs: [
          {
            title: "Frontend Dev",
            company: "Acme",
            location: "Montreal",
            score: 90,
            sourceUrl: "https://example.com/1",
          },
          {
            title: "Backend Dev",
            company: "BigCo",
            location: null,
            score: 75,
            sourceUrl: "https://example.com/2",
          },
        ],
        threshold: 70,
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("Frontend Dev");
    expect(text).toContain("Backend Dev");
    expect(text).toContain("Acme");
    expect(text).toContain("BigCo");
    expect(text).toContain("2 offre(s)");
  });

  it("renders job with null location without dash separator", async () => {
    const html = await render(
      NewJobsAlert({
        jobs: [
          {
            title: "Dev",
            company: "Acme",
            location: null,
            score: 80,
            sourceUrl: "https://example.com",
          },
        ],
        threshold: 60,
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    // With null location the template should NOT produce "Acme - "
    expect(text).toContain("Acme");
    expect(text).not.toMatch(/Acme\s*-\s*Score/);
  });

  it("renders empty jobs list", async () => {
    const html = await render(
      NewJobsAlert({ jobs: [], threshold: 60, date: "2026-02-06" })
    );
    const text = stripHtml(html);
    expect(text).toContain("0 offre(s)");
    expect(text).toContain("Nouvelles offres correspondantes");
  });

  it("contains the correct date", async () => {
    const html = await render(
      NewJobsAlert({ jobs: [], threshold: 60, date: "2026-02-06" })
    );
    const text = stripHtml(html);
    expect(text).toContain("2026-02-06");
  });

  it("sets lang attribute to fr", async () => {
    const html = await render(
      NewJobsAlert({ jobs: [], threshold: 60, date: "2026-02-06" })
    );
    expect(html).toContain('lang="fr"');
  });
});

describe("WeeklySummary template", () => {
  it("renders stats and top jobs", async () => {
    const html = await render(
      WeeklySummary({
        weekOf: "2026-02-03",
        newJobsCount: 15,
        appliedCount: 3,
        interviewCount: 1,
        avgScore: 72,
        topJobs: [{ title: "Analyst", company: "BigCo", score: 90 }],
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("15 nouvelles offres");
    expect(text).toContain("3 candidatures");
    expect(text).toContain("1 entrevues");
    expect(text).toContain("Score moyen: 72%");
    expect(text).toContain("Analyst");
    expect(text).toContain("BigCo");
    expect(text).toContain("90%");
    expect(text).toContain("2026-02-03");
  });

  it("renders without top jobs section when list is empty", async () => {
    const html = await render(
      WeeklySummary({
        weekOf: "2026-02-03",
        newJobsCount: 5,
        appliedCount: 0,
        interviewCount: 0,
        avgScore: 60,
        topJobs: [],
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("5 nouvelles offres");
    expect(text).toContain("Score moyen: 60%");
    expect(text).not.toContain("Top offres de la semaine");
  });

  it("renders multiple top jobs", async () => {
    const html = await render(
      WeeklySummary({
        weekOf: "2026-02-03",
        newJobsCount: 20,
        appliedCount: 5,
        interviewCount: 2,
        avgScore: 80,
        topJobs: [
          { title: "Dev Senior", company: "StartupX", score: 95 },
          { title: "Architecte", company: "CorpY", score: 88 },
        ],
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("Dev Senior");
    expect(text).toContain("StartupX");
    expect(text).toContain("95%");
    expect(text).toContain("Architecte");
    expect(text).toContain("CorpY");
    expect(text).toContain("88%");
    expect(text).toContain("Top offres de la semaine");
  });

  it("sets lang attribute to fr", async () => {
    const html = await render(
      WeeklySummary({
        weekOf: "2026-02-03",
        newJobsCount: 0,
        appliedCount: 0,
        interviewCount: 0,
        avgScore: 0,
        topJobs: [],
      })
    );
    expect(html).toContain('lang="fr"');
  });
});

describe("FollowUpReminder template", () => {
  it("renders stale applications", async () => {
    const html = await render(
      FollowUpReminder({
        applications: [
          {
            jobTitle: "Dev",
            company: "Acme",
            appliedDaysAgo: 14,
            status: "applied",
          },
        ],
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("Dev");
    expect(text).toContain("Acme");
    expect(text).toContain("14 jours");
    expect(text).toContain("applied");
    expect(text).toContain("2026-02-06");
    expect(text).toContain("1 candidature(s)");
  });

  it("renders multiple stale applications", async () => {
    const html = await render(
      FollowUpReminder({
        applications: [
          {
            jobTitle: "Dev",
            company: "Acme",
            appliedDaysAgo: 14,
            status: "applied",
          },
          {
            jobTitle: "Designer",
            company: "BigCo",
            appliedDaysAgo: 21,
            status: "interviewing",
          },
        ],
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("Dev");
    expect(text).toContain("Designer");
    expect(text).toContain("14 jours");
    expect(text).toContain("21 jours");
    expect(text).toContain("2 candidature(s)");
  });

  it("renders empty applications list", async () => {
    const html = await render(
      FollowUpReminder({
        applications: [],
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("0 candidature(s)");
    expect(text).toContain("Rappel de suivi");
  });

  it("sets lang attribute to fr", async () => {
    const html = await render(
      FollowUpReminder({
        applications: [],
        date: "2026-02-06",
      })
    );
    expect(html).toContain('lang="fr"');
  });
});
