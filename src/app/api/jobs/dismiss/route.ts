import { NextResponse } from "next/server";
import { z } from "zod";
import { dismissJob } from "@/lib/supabase/queries";
import { requireUser } from "@/lib/supabase/get-user";
import { apiError } from "@/lib/api/error-response";

const DismissBodySchema = z.object({
  jobListingId: z.string().uuid("jobListingId must be a valid UUID"),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const raw = await request.json();
    const body = DismissBodySchema.parse(raw);

    await dismissJob(user.id, body.jobListingId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "POST /api/jobs/dismiss");
  }
}
