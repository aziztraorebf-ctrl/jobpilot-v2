import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { createApplication, getJobById, getProfilesWithAutoSearch } from "@/lib/supabase/queries";
import { updateAgentStatus, updateAtsType } from "@/lib/supabase/queries/applications";
import {
  reconApplicationPage,
  decideApplyStrategy,
  executeApplication,
} from "@/lib/services/browser-apply";

const BodySchema = z.object({
  job_listing_id: z.string().uuid(),
  application_url: z.string().url(),
  resume_id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  try {
    const raw = await request.json();
    const body = BodySchema.parse(raw);

    const profiles = await getProfilesWithAutoSearch();
    if (profiles.length === 0) {
      return NextResponse.json({ error: "No profiles found" }, { status: 404 });
    }
    const userId = profiles[0].id;

    // Verify the job exists
    await getJobById(body.job_listing_id);

    // Create the application in "saved" status
    const application = await createApplication(userId, body.job_listing_id);

    // Phase 1: Reconnaissance
    let recon;
    try {
      recon = await reconApplicationPage(body.application_url);
      await updateAtsType(application.id, recon.atsType);
      await updateAgentStatus(application.id, "pending");
    } catch (err) {
      await updateAgentStatus(
        application.id,
        "failed",
        `Recon failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return NextResponse.json(
        {
          status: "failed",
          phase: "reconnaissance",
          applicationId: application.id,
          error: err instanceof Error ? err.message : String(err),
        },
        { status: 200 }
      );
    }

    // Phase 2: Decision
    const decision = decideApplyStrategy(recon);

    if (!decision.canAutomate) {
      await updateAgentStatus(
        application.id,
        "needs_review",
        `Cannot automate: ${decision.reason}. ATS: ${recon.atsType}. Fields: ${recon.formFields.join(", ")}`
      );
      return NextResponse.json(
        {
          status: "needs_review",
          phase: "decision",
          applicationId: application.id,
          atsType: recon.atsType,
          reason: decision.reason,
        },
        { status: 200 }
      );
    }

    // Phase 3: Execution
    if (!recon.scrapeId) {
      await updateAgentStatus(
        application.id,
        "failed",
        "No scrapeId available for interaction"
      );
      return NextResponse.json(
        {
          status: "failed",
          phase: "execution",
          applicationId: application.id,
          error: "No scrapeId for interact",
        },
        { status: 200 }
      );
    }

    const profile = profiles[0];
    const result = await executeApplication(recon.scrapeId, {
      name: profile.full_name || "Applicant",
      email: profile.email || "",
    });

    if (result.success) {
      await updateAgentStatus(application.id, "submitted", result.message);
      return NextResponse.json(
        {
          status: "submitted",
          phase: "execution",
          applicationId: application.id,
          message: result.message,
        },
        { status: 200 }
      );
    }

    await updateAgentStatus(application.id, "failed", result.message);
    return NextResponse.json(
      {
        status: "failed",
        phase: "execution",
        applicationId: application.id,
        error: result.message,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error, "cowork/browser-apply");
    }
    return apiError(error, "cowork/browser-apply");
  }
}
