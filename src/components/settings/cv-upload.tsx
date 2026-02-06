"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResumeRow } from "@/lib/supabase/queries";

interface CVUploadProps {
  resumes?: ResumeRow[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function CVUpload({ resumes: initialResumes = [] }: CVUploadProps) {
  const t = useTranslations("settings");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumes, setResumes] = useState<ResumeRow[]>(initialResumes);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setError(null);

    // Client-side validation
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (!validTypes.includes(file.type)) {
      setError(t("unsupportedFileType"));
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      setError(t("fileTooLarge"));
      return;
    }

    if (file.size === 0) {
      setError(t("fileEmpty"));
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const msg = body?.error || `Upload failed (${response.status})`;
        setError(msg);
        return;
      }

      const created: ResumeRow = await response.json();
      setResumes((prev) => [created, ...prev]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [t]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload]
  );

  const handleDelete = useCallback(async (id: string) => {
    setError(null);
    setDeletingId(id);

    try {
      const response = await fetch(`/api/resumes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const msg = body?.error || `Delete failed (${response.status})`;
        setError(msg);
        return;
      }

      setResumes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <Card>
      <CardContent className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Upload zone */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={isUploading}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors",
            "border-muted-foreground/25 text-muted-foreground",
            isDragOver && "border-primary/50 bg-accent/50",
            isUploading && "cursor-not-allowed opacity-50"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-10 w-10 animate-spin" />
          ) : (
            <Upload className="h-10 w-10" />
          )}
          <p className="text-sm font-medium">
            {isUploading ? t("uploading") : t("uploadCV")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("supportedFormats")}
          </p>
        </button>

        {/* Uploaded resumes list */}
        {resumes.length > 0 && (
          <div className="space-y-2">
            {resumes.map((resume) => (
              <div
                key={resume.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-8 w-8 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {resume.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {resume.file_type.toUpperCase()}
                      {resume.created_at && (
                        <span> - {formatDate(resume.created_at)}</span>
                      )}
                      {resume.is_primary && (
                        <span className="ml-2 font-medium text-primary">
                          {t("primary")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(resume.id)}
                  disabled={deletingId === resume.id}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  {deletingId === resume.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleInputChange}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}
