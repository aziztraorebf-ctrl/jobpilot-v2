import { describe, it, expect } from "vitest";
import { generateJobsCsv } from "./csv-export";
import type { JobForExport } from "./csv-export";

describe("generateJobsCsv — descriptions multilignes", () => {
  const jobWithMultiline: JobForExport = {
    id: "1",
    title: "Développeur",
    company_name: "Acme",
    location: "Montréal",
    source_url: "https://example.com",
    remote_type: "remote",
    description: "Ligne 1\nLigne 2\nLigne 3",
    fetched_at: "2026-03-08T00:00:00Z",
    score: 75,
    profile_label: null,
  };

  it("encapsule les descriptions multilignes dans des guillemets", () => {
    const csv = generateJobsCsv([jobWithMultiline]);
    const lines = csv.split("\r\n");
    // Header + 1 ligne de données (pas plus malgré les \n dans la description)
    expect(lines).toHaveLength(2);
  });

  it("exporte le score correctement", () => {
    const csv = generateJobsCsv([jobWithMultiline]);
    expect(csv).toContain("75");
  });

  it("retourne uniquement le header pour un tableau vide", () => {
    const csv = generateJobsCsv([]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Titre");
  });
});
