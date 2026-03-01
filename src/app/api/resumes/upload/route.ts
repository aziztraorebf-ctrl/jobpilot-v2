import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";
import { requireUser } from "@/lib/supabase/get-user";
import { createResume } from "@/lib/supabase/queries";
import { apiError } from "@/lib/api/error-response";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES: Record<string, "pdf" | "docx" | "txt"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/plain": "txt",
};

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided or invalid file field" },
        { status: 400 }
      );
    }

    // Validate file type
    const fileType = ALLOWED_TYPES[file.type];
    if (!fileType) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Allowed: PDF, DOCX, TXT`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum: 10 MB`,
        },
        { status: 400 }
      );
    }

    // Validate file size is not zero
    if (file.size === 0) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    // Sanitize filename: keep only alphanumeric, dots, hyphens, underscores
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const storagePath = `${user.id}/${timestamp}-${sanitizedName}`;

    // Extract raw text for TXT files only.
    // PDF text extraction happens on-demand via /api/ai/analyze-cv
    // to avoid bundling native Node modules (@napi-rs/canvas) in the upload route.
    let rawText: string | null = null;
    if (fileType === "txt") {
      rawText = await file.text();
    }

    // Upload to Supabase Storage
    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("[API] Storage upload error:", uploadError.message);
      return NextResponse.json(
        { error: "Storage upload failed. Please try again." },
        { status: 500 }
      );
    }

    // Insert record in DB
    const resume = await createResume(user.id, {
      file_name: file.name,
      file_path: storagePath,
      file_type: fileType,
      raw_text: rawText,
      is_primary: false,
    });

    revalidatePath("/[locale]/(app)/settings", "page");
    return NextResponse.json(resume, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, "POST /api/resumes/upload");
  }
}
