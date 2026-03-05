import { describe, it, expect } from "vitest";
import { KeywordSuggestionsSchema, KeywordSuggestionsRequestSchema } from "../keyword-suggestions";

describe("KeywordSuggestionsSchema", () => {
  it("validates a valid response", () => {
    const valid = {
      keywords: ["Chef de projet", "Coordinateur logistique"],
      locations: ["Montréal, QC"],
      remote_preference: "hybrid",
      rationale: "Based on your experience as a project manager..."
    };
    expect(() => KeywordSuggestionsSchema.parse(valid)).not.toThrow();
  });

  it("accepts empty locations array", () => {
    const valid = {
      keywords: ["Manager"],
      locations: [],
      remote_preference: "any",
      rationale: "..."
    };
    expect(() => KeywordSuggestionsSchema.parse(valid)).not.toThrow();
  });

  it("requires at least 1 keyword", () => {
    const invalid = {
      keywords: [],
      locations: [],
      remote_preference: "any",
      rationale: ""
    };
    expect(() => KeywordSuggestionsSchema.parse(invalid)).toThrow();
  });
});

describe("KeywordSuggestionsRequestSchema", () => {
  it("validates a valid UUID resumeId", () => {
    const valid = { resumeId: "550e8400-e29b-41d4-a716-446655440000" };
    expect(() => KeywordSuggestionsRequestSchema.parse(valid)).not.toThrow();
  });

  it("rejects a non-UUID resumeId", () => {
    const invalid = { resumeId: "not-a-uuid" };
    expect(() => KeywordSuggestionsRequestSchema.parse(invalid)).toThrow();
  });
});
