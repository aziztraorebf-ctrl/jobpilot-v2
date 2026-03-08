import { describe, it, expect } from "vitest";
import { generateJobsJson } from "./json-export";
import type { JobForExport } from "./csv-export";

describe("generateJobsJson", () => {
  const job: JobForExport = {
    id: "abc",
    title: "Dev Senior",
    company_name: "Acme",
    location: "Montréal",
    source_url: "https://example.com/job/1",
    remote_type: "hybrid",
    description: "Description avec\nsauts de ligne\net accents éàü",
    fetched_at: "2026-03-08T10:00:00Z",
    score: 82,
    profile_label: "securite",
  };

  it("génère un JSON valide parseable", () => {
    const json = generateJobsJson([job]);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("inclut tous les champs requis", () => {
    const json = generateJobsJson([job]);
    const parsed = JSON.parse(json);
    expect(parsed.offres).toHaveLength(1);
    const o = parsed.offres[0];
    expect(o.titre).toBe("Dev Senior");
    expect(o.entreprise).toBe("Acme");
    expect(o.score).toBe(82);
    expect(o.profil).toBe("securite");
    expect(o.description).toContain("sauts de ligne");
  });

  it("inclut les métadonnées d'export", () => {
    const json = generateJobsJson([job]);
    const parsed = JSON.parse(json);
    expect(parsed.meta.total).toBe(1);
    expect(parsed.meta.exporte_le).toBeDefined();
  });

  it("trie par score décroissant", () => {
    const job2 = { ...job, id: "xyz", score: 95 };
    const json = generateJobsJson([job, job2]);
    const parsed = JSON.parse(json);
    expect(parsed.offres[0].score).toBe(95);
    expect(parsed.offres[1].score).toBe(82);
  });

  it("gère un tableau vide", () => {
    const json = generateJobsJson([]);
    const parsed = JSON.parse(json);
    expect(parsed.offres).toHaveLength(0);
    expect(parsed.meta.total).toBe(0);
  });
});
