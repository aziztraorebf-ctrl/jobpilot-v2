import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api/tavily", () => ({
  getTavilyClient: vi.fn(),
}));

import { normalizeTavilyResults } from "@/lib/api/tavily-jobs";

describe("normalizeTavilyResults — enriched extraction", () => {
  it("extracts salary_min from snippet with X$/h pattern", () => {
    const jobs = normalizeTavilyResults([{
      title: "Agent de sécurité | Garda",
      url: "https://www.jobillico.com/fr/offre-emploi/123",
      content: "Poste temps plein à Montréal. Salaire 23$/h. Postulez maintenant.",
    }]);
    expect(jobs[0].salary_min).toBe(23);
    expect(jobs[0].salary_currency).toBe("CAD");
  });

  it("extracts salary range from snippet with X-Y$/h pattern", () => {
    const jobs = normalizeTavilyResults([{
      title: "Coordonnateur | STM",
      url: "https://www.jobboom.com/emploi/456",
      content: "Salaire 20-25$/h. Montréal.",
    }]);
    expect(jobs[0].salary_min).toBe(20);
    expect(jobs[0].salary_max).toBe(25);
  });

  it("extracts contract_type 'permanent' from snippet", () => {
    const jobs = normalizeTavilyResults([{
      title: "Coordonnateur sécurité | CIUSSS",
      url: "https://www.emploiquebec.gouv.qc.ca/jobs/456",
      content: "Poste permanent temps plein. Montréal.",
    }]);
    expect(jobs[0].contract_type).toBe("permanent");
  });

  it("extracts contract_type 'full_time' from 'temps plein'", () => {
    const jobs = normalizeTavilyResults([{
      title: "Commis | Metro",
      url: "https://www.jobillico.com/emploi/789",
      content: "Poste temps plein disponible immédiatement.",
    }]);
    expect(jobs[0].contract_type).toBe("full_time");
  });

  it("cleans title — strips site name suffix after pipe", () => {
    const jobs = normalizeTavilyResults([{
      title: "Emplois – Commis d'entrepôt | Jobillico.com",
      url: "https://www.jobillico.com/recherche-emploi/commis-d-entrepot",
      content: "Montréal, Laval. Temps plein.",
    }]);
    expect(jobs[0].title).not.toContain("Jobillico");
  });

  it("detects remote_type 'remote' from télétravail keyword", () => {
    const jobs = normalizeTavilyResults([{
      title: "Analyste | ACME",
      url: "https://www.jobboom.com/emploi/999",
      content: "Poste en télétravail complet. Québec.",
    }]);
    expect(jobs[0].remote_type).toBe("remote");
  });

  it("returns remote_type 'unknown' when no remote keyword", () => {
    const jobs = normalizeTavilyResults([{
      title: "Technicien | ACME",
      url: "https://www.jobboom.com/emploi/888",
      content: "Poste en présentiel. Laval.",
    }]);
    expect(jobs[0].remote_type).toBe("unknown");
  });
});
