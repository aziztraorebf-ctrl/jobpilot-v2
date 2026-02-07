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
    expect(text).toContain("85%");
    expect(text).toContain("Montreal");
    expect(html).toContain("https://example.com");
    expect(text).toContain("1");
    expect(text).toContain("offre");
  });

  it("renders multiple jobs with score badges", async () => {
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
    expect(text).toContain("90%");
    expect(text).toContain("75%");
    expect(text).toContain("offres");
  });

  it("renders job with null location without location text", async () => {
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
    expect(text).toContain("Acme");
    expect(text).not.toContain("Montreal");
  });

  it("renders empty jobs list", async () => {
    const html = await render(
      NewJobsAlert({ jobs: [], threshold: 60, date: "2026-02-06" })
    );
    const text = stripHtml(html);
    expect(text).toContain("Offres correspondantes");
    expect(text).toContain("Conseils");
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

  it("renders branded header", async () => {
    const html = await render(
      NewJobsAlert({ jobs: [], threshold: 60, date: "2026-02-06" })
    );
    const text = stripHtml(html);
    expect(text).toContain("JobPilot");
    expect(text).toContain("Alerte nouvelles offres");
  });

  it("includes view button for each job", async () => {
    const html = await render(
      NewJobsAlert({
        jobs: [
          {
            title: "Dev",
            company: "Acme",
            location: "Montreal",
            score: 85,
            sourceUrl: "https://example.com/job1",
          },
        ],
        threshold: 60,
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(html).toContain("Voir l");
    expect(html).toContain("offre");
    expect(html).toContain("https://example.com/job1");
  });

  it("renders job description when provided", async () => {
    const html = await render(
      NewJobsAlert({
        jobs: [
          {
            title: "Dev",
            company: "Acme",
            location: "Montreal",
            score: 85,
            sourceUrl: "https://example.com",
            description: "We are looking for a talented developer to join our team and build amazing products.",
          },
        ],
        threshold: 60,
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("talented developer");
  });

  it("renders keywords context when provided", async () => {
    const html = await render(
      NewJobsAlert({
        jobs: [],
        threshold: 60,
        date: "2026-02-06",
        keywords: ["React", "TypeScript", "Node.js"],
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("React, TypeScript, Node.js");
    expect(text).toContain("criteres de recherche");
  });

  it("truncates long descriptions", async () => {
    const longDesc = "A".repeat(300);
    const html = await render(
      NewJobsAlert({
        jobs: [
          {
            title: "Dev",
            company: "Acme",
            location: null,
            score: 80,
            sourceUrl: "https://example.com",
            description: longDesc,
          },
        ],
        threshold: 60,
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("...");
    expect(text).not.toContain(longDesc);
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
    expect(text).toContain("15");
    expect(text).toContain("Nouvelles offres");
    expect(text).toContain("3");
    expect(text).toContain("Candidatures");
    expect(text).toContain("1");
    expect(text).toContain("Entrevues");
    expect(text).toContain("72%");
    expect(text).toContain("Score moyen");
    expect(text).toContain("Analyst");
    expect(text).toContain("BigCo");
    expect(text).toContain("90%");
    expect(text).toContain("2026-02-03");
  });

  it("renders empty state message when no top jobs", async () => {
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
    expect(text).toContain("5");
    expect(text).toContain("60%");
    expect(text).not.toContain("Top offres de la semaine");
    expect(text).toContain("Aucune offre avec un score eleve");
  });

  it("renders multiple top jobs with rankings", async () => {
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

  it("renders branded header", async () => {
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
    const text = stripHtml(html);
    expect(text).toContain("JobPilot");
    expect(text).toContain("Resume hebdomadaire");
  });

  it("renders top job descriptions when provided", async () => {
    const html = await render(
      WeeklySummary({
        weekOf: "2026-02-03",
        newJobsCount: 10,
        appliedCount: 2,
        interviewCount: 1,
        avgScore: 75,
        topJobs: [
          {
            title: "Dev",
            company: "Acme",
            score: 90,
            description: "Join our engineering team to build scalable cloud services.",
          },
        ],
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("scalable cloud services");
  });
});

describe("FollowUpReminder template", () => {
  it("renders stale applications with status labels", async () => {
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
    expect(text).toContain("14j");
    expect(text).toContain("Postule");
    expect(text).toContain("2026-02-06");
    expect(text).toContain("candidature");
  });

  it("renders multiple stale applications with urgency badges", async () => {
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
            appliedDaysAgo: 35,
            status: "interview",
          },
        ],
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("Dev");
    expect(text).toContain("Designer");
    expect(text).toContain("14j");
    expect(text).toContain("35j");
    expect(text).toContain("candidatures");
    expect(text).toContain("Urgent");
  });

  it("renders empty applications list", async () => {
    const html = await render(
      FollowUpReminder({
        applications: [],
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("Candidatures a relancer");
    expect(text).toContain("Rappel de suivi");
  });

  it("renders follow-up tips section", async () => {
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
    expect(text).toContain("Conseils de relance");
    expect(text).toContain("Mentionnez le poste");
    expect(text).toContain("Restez bref");
    expect(text).toContain("interet pour le poste");
  });

  it("shows urgent count for 30+ day applications", async () => {
    const html = await render(
      FollowUpReminder({
        applications: [
          {
            jobTitle: "Dev",
            company: "Acme",
            appliedDaysAgo: 32,
            status: "applied",
          },
          {
            jobTitle: "PM",
            company: "Corp",
            appliedDaysAgo: 45,
            status: "applied",
          },
        ],
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("2 urgentes");
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

  it("renders branded header", async () => {
    const html = await render(
      FollowUpReminder({
        applications: [],
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("JobPilot");
    expect(text).toContain("Rappel de suivi");
  });

  it("renders application description when provided", async () => {
    const html = await render(
      FollowUpReminder({
        applications: [
          {
            jobTitle: "Dev",
            company: "Acme",
            appliedDaysAgo: 14,
            status: "applied",
            description: "Full-stack developer position working on e-commerce platform.",
          },
        ],
        date: "2026-02-06",
      })
    );
    const text = stripHtml(html);
    expect(text).toContain("e-commerce platform");
  });
});
