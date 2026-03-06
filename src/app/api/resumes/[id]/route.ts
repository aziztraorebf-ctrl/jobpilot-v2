import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";
import { getResumeById, deleteResume } from "@/lib/supabase/queries";
import { requireUser } from "@/lib/supabase/get-user";
import { apiError } from "@/lib/api/error-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Resume ID is required" },
        { status: 400 }
      );
    }

    // Validate UUID format to prevent injection
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid resume ID format" },
        { status: 400 }
      );
    }

    // Get resume from DB to retrieve storage path
    const resume = await getResumeById(user.id, id);
    if (!resume) {
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    // Delete file from Supabase Storage
    const supabase = getSupabase();
    const { error: storageError } = await supabase.storage
      .from("resumes")
      .remove([resume.file_path]);

    if (storageError) {
      console.error(
        "[API] Storage delete error (continuing with DB delete):",
        storageError.message
      );
      // Continue with DB deletion even if storage fails
      // The file might have been manually deleted already
    }

    // Delete record from DB
    await deleteResume(user.id, id);

    revalidatePath("/", "layout");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "DELETE /api/resumes/[id]");
  }
}
