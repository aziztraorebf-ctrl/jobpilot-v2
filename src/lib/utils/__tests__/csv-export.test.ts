import { describe, it, expect } from "vitest";
import { generateApplicationsCsv, generateJobsCsv } from "../csv-export";
import type { JobForExport } from "../csv-export";

const MOCK_APPLICATIONS = [
  {
    id: "1",
    status: "applied",
    created_at: "2026-01-15T10:00:00Z",
    updated_at: "2026-01-20T10:00:00Z",
    notes: "Sent via LinkedIn",
    job_listings: {
      title: "Full-Stack Developer",
      company_name: "Shopify",
      location: "Montreal, QC",
      source_url: "https://adzuna.ca/jobs/1",
      remote_type: "hybrid",
      description: null,
    },
  },
  {
    id: "2",
    status: "interview",
    created_at: "2026-01-10T10:00:00Z",
    updated_at: "2026-01-25T10:00:00Z",
    notes: null,
    job_listings: {
      title: "Data Analyst",
      company_name: "Desjardins",
      location: "Quebec, QC",
      source_url: "https://jsearch.example.com/2",
      remote_type: "onsite",
      description: null,
    },
  },
];

describe("generateApplicationsCsv", () => {
  it("generates CSV with correct headers", () => {
    const csv = generateApplicationsCsv(MOCK_APPLICATIONS);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "Titre,Entreprise,Localisation,Statut,Type,URL,Date candidature,Derniere MAJ,Notes"
    );
  });

  it("generates correct data rows", () => {
    const csv = generateApplicationsCsv(MOCK_APPLICATIONS);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3); // header + 2 rows
    expect(lines[1]).toContain("Full-Stack Developer");
    expect(lines[1]).toContain("Shopify");
    expect(lines[1]).toContain("applied");
  });

  it("escapes commas and quotes in values", () => {
    const apps = [
      {
        ...MOCK_APPLICATIONS[0],
        notes: 'Said "great fit", will follow up',
        job_listings: {
          ...MOCK_APPLICATIONS[0].job_listings,
          title: "Developer, Senior",
        },
      },
    ];
    const csv = generateApplicationsCsv(apps);
    expect(csv).toContain('"Developer, Senior"');
    expect(csv).toContain('"Said ""great fit"", will follow up"');
  });

  it("returns header only for empty array", () => {
    const csv = generateApplicationsCsv([]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(1);
  });

  it("handles null values gracefully", () => {
    const apps = [
      {
        ...MOCK_APPLICATIONS[0],
        notes: null,
        job_listings: {
          ...MOCK_APPLICATIONS[0].job_listings,
          location: null,
          company_name: null,
        },
      },
    ];
    const csv = generateApplicationsCsv(apps);
    expect(csv).not.toContain("null");
    expect(csv).not.toContain("undefined");
  });
});

describe("generateJobsCsv", () => {
  const mockJobs: JobForExport[] = [
    {
      id: "1",
      title: "Chef de projet",
      company_name: "Acme Corp",
      location: "Montreal, QC",
      source_url: "https://example.com/job/1",
      remote_type: "hybrid",
      description: "Description du poste",
      fetched_at: "2026-03-07T10:00:00.000Z",
      score: 85,
    },
    {
      id: "2",
      title: 'Job with "quotes", and commas',
      company_name: null,
      location: null,
      source_url: "https://example.com/job/2",
      remote_type: "onsite",
      description: null,
      fetched_at: "2026-03-06T10:00:00.000Z",
      score: 0,
    },
  ];

  it("generates CSV with BOM and headers", () => {
    const csv = generateJobsCsv(mockJobs);
    expect(csv).toContain("Titre,Entreprise");
    expect(csv).toContain("Chef de projet");
  });

  it("escapes special characters", () => {
    const csv = generateJobsCsv(mockJobs);
    expect(csv).toContain('"Job with ""quotes"", and commas"');
  });

  it("handles null fields gracefully", () => {
    const csv = generateJobsCsv(mockJobs);
    expect(csv).toContain("https://example.com/job/2");
  });
});
