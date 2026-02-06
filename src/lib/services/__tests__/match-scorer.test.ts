import { describe, it, expect } from "vitest";
import { buildMatchPrompt } from "../match-scorer";

describe("buildMatchPrompt", () => {
  it("includes CV skills and job description in prompt", () => {
    const cvData = {
      skills: { technical: ["Python", "SQL"], soft: ["Communication"], languages: ["FR"] },
      experience: [{ title: "Analyst", company: "X", description: "Did analysis" }],
      summary: "Experienced analyst",
    };
    const jobDescription = "Looking for Python developer with SQL experience";

    const prompt = buildMatchPrompt(cvData, jobDescription);
    expect(prompt).toContain("Python");
    expect(prompt).toContain("SQL");
    expect(prompt).toContain("Looking for Python developer");
  });

  it("handles missing skills gracefully", () => {
    const cvData = {
      skills: { technical: [], soft: [], languages: [] },
      experience: [],
      summary: "",
    };
    const prompt = buildMatchPrompt(cvData, "Some job");
    expect(prompt).toBeDefined();
    expect(prompt.length).toBeGreaterThan(0);
  });
});
