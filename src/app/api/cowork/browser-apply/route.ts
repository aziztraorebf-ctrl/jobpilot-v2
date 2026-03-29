import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { createApplication, getJobById, getProfilesWithAutoSearch } from "@/lib/supabase/queries";

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

    // Create the application in "saved" status so it's tracked
    const application = await createApplication(userId, body.job_listing_id);

    // Return 201: application created and tracked.
    // Browser automation (actual form submission) is not yet implemented.
    // The agent should proceed with manual application tracking.
    return NextResponse.json(
      {
        status: "saved",
        message: "Application created with status 'saved'. Browser automation pending.",
        applicationId: application.id,
        jobListingId: body.job_listing_id,
        applicationUrl: body.application_url,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error, "cowork/browser-apply");
    }
    return apiError(error, "cowork/browser-apply");
  }
}
