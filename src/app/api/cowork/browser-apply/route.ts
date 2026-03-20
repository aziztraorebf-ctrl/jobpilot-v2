import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { createApplication, getJobById } from "@/lib/supabase/queries";
import { USER_ID } from "@/lib/supabase/constants";

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

    // Verify the job exists
    await getJobById(body.job_listing_id);

    // Create the application in "saved" status so it's tracked
    const application = await createApplication(USER_ID, body.job_listing_id);

    // Browser automation is not yet implemented.
    // This endpoint is ready for future Playwright / Web MCP integration.
    return NextResponse.json(
      {
        status: "not_implemented",
        message:
          "Browser MCP integration pending. Application created with status 'saved' for tracking.",
        applicationId: application.id,
        jobListingId: body.job_listing_id,
        applicationUrl: body.application_url,
      },
      { status: 501 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error, "cowork/browser-apply");
    }
    return apiError(error, "cowork/browser-apply");
  }
}
