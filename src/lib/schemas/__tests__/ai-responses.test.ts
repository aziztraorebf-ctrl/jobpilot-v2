import { describe, it, expect } from "vitest";
import { MatchScoreSchema, ParsedResumeSchema, CoverLetterResponseSchema } from "../ai-responses";

describe("MatchScoreSchema", () => {
  it("validates a valid match score", () => {
    const data = {
      overall_score: 75,
      skill_match_score: 80,
      experience_match_score: 70,
      education_match_score: 60,
      explanation: "Good match for the role",
      matching_skills: ["Python", "SQL"],
      missing_skills: ["Tableau"],
      strengths: ["Strong analytics background"],
      concerns: ["No experience with specific tool"],
    };
    expect(MatchScoreSchema.safeParse(data).success).toBe(true);
  });

  it("rejects score out of range", () => {
    const data = {
      overall_score: 150,
      skill_match_score: 80,
      experience_match_score: 70,
      education_match_score: 60,
      explanation: "Test",
      matching_skills: [],
      missing_skills: [],
      strengths: [],
      concerns: [],
    };
    expect(MatchScoreSchema.safeParse(data).success).toBe(false);
  });
});

describe("ParsedResumeSchema", () => {
  it("validates a valid parsed resume", () => {
    const data = {
      personal: { name: "Aziz", email: null, phone: null, location: "Montreal, QC", linkedin: null },
      summary: "Experienced analyst",
      skills: {
        technical: ["Python", "SQL", "Excel"],
        soft: ["Communication", "Leadership"],
        languages: ["Francais", "English"],
      },
      experience: [
        {
          title: "Data Analyst",
          company: "ABC Corp",
          start_date: "2022-01",
          end_date: "2025-06",
          description: "Analyzed data",
          achievements: ["Improved reports"],
        },
      ],
      education: [
        {
          degree: "BSc Computer Science",
          institution: "Universite de Montreal",
          year: "2022",
          field: "CS",
        },
      ],
      certifications: ["AWS Certified"],
    };
    expect(ParsedResumeSchema.safeParse(data).success).toBe(true);
  });
});

describe("CoverLetterResponseSchema", () => {
  it("validates a valid cover letter response", () => {
    const data = {
      subject: "Application for Data Analyst",
      greeting: "Dear Hiring Manager,",
      body: "I am writing to express my interest...",
      closing: "Sincerely, Aziz",
      full_text: "Dear Hiring Manager, I am writing...",
    };
    expect(CoverLetterResponseSchema.safeParse(data).success).toBe(true);
  });
});
