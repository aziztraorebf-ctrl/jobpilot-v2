import { describe, it, expect } from "vitest";
import { callStructured } from "@/lib/api/openai";
import { parseCvText } from "@/lib/services/cv-parser";
import { scoreMatch } from "@/lib/services/match-scorer";
import { MatchScoreSchema, ParsedResumeSchema } from "@/lib/schemas/ai-responses";
import { z } from "zod";

// Minimal CV text for testing (avoids burning excessive tokens)
const SAMPLE_CV = `
Aziz Trabelsi
Software Developer
Montreal, QC | aziz@example.com

SUMMARY
Experienced full-stack developer with 5 years of experience building web applications
using React, TypeScript, Node.js, and PostgreSQL. Passionate about clean code and
automated testing.

SKILLS
Technical: TypeScript, React, Next.js, Node.js, PostgreSQL, Python, Docker, AWS, Git
Soft: Problem solving, Team leadership, Agile/Scrum
Languages: French (native), English (fluent), Arabic (conversational)

EXPERIENCE
Senior Developer - TechCorp Inc. (2022-Present)
- Built a SaaS platform serving 10,000 users with React and Next.js
- Implemented CI/CD pipelines with GitHub Actions and Docker
- Mentored 3 junior developers

Full-Stack Developer - StartupXYZ (2019-2022)
- Developed REST APIs with Node.js and Express
- Designed PostgreSQL database schemas
- Increased test coverage from 30% to 85%

EDUCATION
Bachelor in Computer Science - Universite de Montreal (2019)
`.trim();

const SAMPLE_JOB_DESCRIPTION = `
Senior Full-Stack Developer - Remote (Canada)

We are looking for an experienced full-stack developer to join our team.

Requirements:
- 4+ years experience with React and TypeScript
- Experience with Node.js and PostgreSQL
- Knowledge of CI/CD pipelines
- Familiarity with cloud services (AWS or GCP)
- Strong communication skills in English and French

Nice to have:
- Experience with Next.js
- Knowledge of Docker and Kubernetes
- Experience mentoring junior developers
`.trim();

describe("OpenAI API - Integration", () => {
  it("should make a basic structured call", async () => {
    const TestSchema = z.object({
      answer: z.string(),
      confidence: z.number().min(0).max(100),
    });

    const result = await callStructured({
      systemPrompt: "You are a helpful assistant. Answer briefly.",
      userPrompt: "What is 2+2? Provide the answer and your confidence level.",
      schema: TestSchema,
      schemaName: "simple_answer",
    });

    expect(result.data).toBeDefined();
    expect(result.data.answer).toBeDefined();
    expect(result.data.confidence).toBeGreaterThan(0);
    expect(result.tokensInput).toBeGreaterThan(0);
    expect(result.tokensOutput).toBeGreaterThan(0);

    console.log(`[OpenAI Basic] Answer: ${result.data.answer}`);
    console.log(`[OpenAI Basic] Confidence: ${result.data.confidence}`);
    console.log(`[OpenAI Basic] Tokens: in=${result.tokensInput}, out=${result.tokensOutput}`);
  });

  it("should parse a CV into structured data", async () => {
    const result = await parseCvText(SAMPLE_CV);

    expect(result.parsed).toBeDefined();
    expect(result.tokensUsed).toBeGreaterThan(0);

    const { parsed } = result;
    expect(parsed.personal.name).toBeDefined();
    expect(parsed.summary).toBeDefined();
    expect(parsed.skills.technical.length).toBeGreaterThan(0);
    expect(parsed.experience.length).toBeGreaterThan(0);
    expect(parsed.education.length).toBeGreaterThan(0);

    // Validate with schema
    const validation = ParsedResumeSchema.safeParse(parsed);
    expect(validation.success).toBe(true);

    console.log(`[OpenAI CV] Name: ${parsed.personal.name}`);
    console.log(`[OpenAI CV] Technical skills: ${parsed.skills.technical.join(", ")}`);
    console.log(`[OpenAI CV] Experience entries: ${parsed.experience.length}`);
    console.log(`[OpenAI CV] Tokens used: ${result.tokensUsed}`);
  });

  it("should score a CV against a job description", async () => {
    const cvData = {
      skills: {
        technical: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Docker", "AWS"],
        soft: ["Problem solving", "Team leadership"],
        languages: ["French", "English"],
      },
      experience: [
        {
          title: "Senior Developer",
          company: "TechCorp Inc.",
          description: "Built SaaS platform with React and Next.js, CI/CD with Docker",
        },
        {
          title: "Full-Stack Developer",
          company: "StartupXYZ",
          description: "REST APIs with Node.js, PostgreSQL schemas, increased test coverage",
        },
      ],
      summary: "Experienced full-stack developer with 5 years of experience",
    };

    const result = await scoreMatch(cvData, SAMPLE_JOB_DESCRIPTION);

    expect(result.score).toBeDefined();
    expect(result.tokensUsed).toBeGreaterThan(0);

    const { score } = result;
    expect(score.overall_score).toBeGreaterThanOrEqual(0);
    expect(score.overall_score).toBeLessThanOrEqual(100);
    expect(score.skill_match_score).toBeGreaterThanOrEqual(0);
    expect(score.matching_skills.length).toBeGreaterThan(0);
    expect(score.explanation).toBeDefined();

    // Validate with schema
    const validation = MatchScoreSchema.safeParse(score);
    expect(validation.success).toBe(true);

    // This CV should score reasonably well against this job
    expect(score.overall_score).toBeGreaterThan(50);

    console.log(`[OpenAI Score] Overall: ${score.overall_score}/100`);
    console.log(`[OpenAI Score] Skills: ${score.skill_match_score}/100`);
    console.log(`[OpenAI Score] Experience: ${score.experience_match_score}/100`);
    console.log(`[OpenAI Score] Matching: ${score.matching_skills.join(", ")}`);
    console.log(`[OpenAI Score] Missing: ${score.missing_skills.join(", ")}`);
    console.log(`[OpenAI Score] Tokens used: ${result.tokensUsed}`);
  });

  it("should reject empty CV text", async () => {
    await expect(parseCvText("")).rejects.toThrow("CV text is empty");
    await expect(parseCvText("   ")).rejects.toThrow("CV text is empty");
  });
});
