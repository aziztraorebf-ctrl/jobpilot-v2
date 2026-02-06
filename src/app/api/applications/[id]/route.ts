import { NextResponse } from "next/server";
import { z } from "zod";
import {
  updateApplicationStatus,
  deleteApplication,
  APPLICATION_STATUSES,
} from "@/lib/supabase/queries";
import { requireUser } from "@/lib/supabase/get-user";
import { apiError } from "@/lib/api/error-response";

const UpdateStatusBody = z.object({
  status: z.enum(APPLICATION_STATUSES),
  interview_at: z.string().datetime().optional(),
  notes: z.string().optional(),
  salary_offered: z.number().nonnegative().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Application ID is required" },
        { status: 400 }
      );
    }

    const raw = await request.json();
    const body = UpdateStatusBody.parse(raw);

    const { status, interview_at, notes, salary_offered } = body;

    const extra: {
      interview_at?: string;
      notes?: string;
      salary_offered?: number;
    } = {};

    if (interview_at !== undefined) extra.interview_at = interview_at;
    if (notes !== undefined) extra.notes = notes;
    if (salary_offered !== undefined) extra.salary_offered = salary_offered;

    const application = await updateApplicationStatus(
      user.id,
      id,
      status,
      Object.keys(extra).length > 0 ? extra : undefined
    );

    return NextResponse.json(application);
  } catch (error: unknown) {
    return apiError(error, "PATCH /api/applications/[id]");
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Application ID is required" },
        { status: 400 }
      );
    }

    await deleteApplication(user.id, id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "DELETE /api/applications/[id]");
  }
}
