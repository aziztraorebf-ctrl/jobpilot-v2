import { getFirecrawlClient } from "@/lib/api/firecrawl";
import type { AtsType } from "@/lib/supabase/queries/applications";

export interface ReconResult {
  atsType: AtsType;
  hasSimpleForm: boolean;
  requiresAuth: boolean;
  formFields: string[];
  scrapeId: string | null;
}

export interface ApplyDecision {
  canAutomate: boolean;
  reason: string;
}

export interface ApplyResult {
  success: boolean;
  message: string;
}

// Phase 1: Reconnaissance
export async function reconApplicationPage(url: string): Promise<ReconResult> {
  const client = getFirecrawlClient();

  const RECON_SCHEMA: Record<string, unknown> = {
    type: "object",
    properties: {
      ats_system: { type: "string" },
      has_form: { type: "boolean" },
      requires_auth: { type: "boolean" },
      form_fields: { type: "array", items: { type: "string" } },
    },
  };

  const doc = await client.scrape(url, {
    formats: [
      "markdown",
      {
        type: "json",
        schema: RECON_SCHEMA,
        prompt:
          "Analyze this job application page. Identify: 1) What ATS system is this (LinkedIn, Indeed, Workday, Greenhouse, Lever, or other)? 2) Is there a simple application form visible on this page? 3) Does it require login/authentication to apply? 4) What form fields are visible (name, email, resume upload, cover letter, phone, etc)?",
      },
    ],
  });

  const json = (doc.json || {}) as {
    ats_system?: string;
    has_form?: boolean;
    requires_auth?: boolean;
    form_fields?: string[];
  };

  const atsType = classifyAts(json.ats_system || "", url);

  return {
    atsType,
    hasSimpleForm: Boolean(json.has_form),
    requiresAuth: Boolean(json.requires_auth),
    formFields: json.form_fields || [],
    scrapeId: doc.metadata?.scrapeId || null,
  };
}

function classifyAts(detected: string, url: string): AtsType {
  const lower = detected.toLowerCase();
  const urlLower = url.toLowerCase();

  if (lower.includes("linkedin") || urlLower.includes("linkedin.com"))
    return "linkedin";
  if (lower.includes("indeed") || urlLower.includes("indeed.com"))
    return "indeed";
  if (lower.includes("workday") || urlLower.includes("myworkday"))
    return "workday";
  if (lower.includes("greenhouse") || urlLower.includes("greenhouse.io"))
    return "greenhouse";
  if (lower.includes("lever") || urlLower.includes("lever.co"))
    return "lever";
  return "other";
}

// Phase 2: Decision
export function decideApplyStrategy(recon: ReconResult): ApplyDecision {
  if (recon.atsType === "linkedin" || recon.atsType === "indeed") {
    return {
      canAutomate: false,
      reason: `${recon.atsType} requires authentication and complex multi-step flow`,
    };
  }

  if (recon.requiresAuth) {
    return {
      canAutomate: false,
      reason: "Application page requires authentication",
    };
  }

  if (!recon.hasSimpleForm) {
    return {
      canAutomate: false,
      reason: "No simple application form detected",
    };
  }

  if (recon.atsType === "workday") {
    return {
      canAutomate: false,
      reason: "Workday forms are multi-step and require authentication",
    };
  }

  return { canAutomate: true, reason: "Simple form detected, no auth required" };
}

// Phase 3: Execution
export async function executeApplication(
  scrapeId: string,
  profile: { name: string; email: string; phone?: string }
): Promise<ApplyResult> {
  const client = getFirecrawlClient();

  const result = await client.interact(scrapeId, {
    prompt: [
      "Fill out this job application form with the following information:",
      `- Full Name: ${profile.name}`,
      `- Email: ${profile.email}`,
      profile.phone ? `- Phone: ${profile.phone}` : "",
      "After filling the form, click the Submit or Apply button.",
    ]
      .filter(Boolean)
      .join("\n"),
    timeout: 60,
  });

  if (!result.success) {
    return {
      success: false,
      message: `Interact failed: ${result.error || "unknown"}`,
    };
  }

  return {
    success: true,
    message: `Application submitted. Output: ${result.output || result.result || "no output"}`,
  };
}
