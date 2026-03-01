"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Upload, FileText, Trash2, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ResumeRow } from "@/lib/supabase/queries";
import type { ParsedResume } from "@/lib/schemas/ai-responses";

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

function getParsedData(resume: ResumeRow): ParsedResume | null {
  if (!resume.parsed_data || typeof resume.parsed_data !== "object") return null;
  const d = resume.parsed_data as Record<string, unknown>;
  if (!d.skills && !d.experience) return null;
  return d as unknown as ParsedResume;
}

export function CVUpload({ resumes: initialResumes = [] }: CVUploadProps) {
  const t = useTranslations("settings");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumes, setResumes] = useState<ResumeRow[]>(initialResumes);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setError(null);
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (!validTypes.includes(file.type)) {
      setError(t("unsupportedFileType"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
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
        setError(body?.error ?? `Upload failed (${response.status})`);
        return;
      }
      const created: ResumeRow = await response.json();
      setResumes((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [t]);

  const handleAnalyze = useCallback(async (resume: ResumeRow) => {
    setError(null);
    setAnalyzingId(resume.id);
    try {
      const response = await fetch("/api/ai/analyze-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: resume.id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? t("analyzeError"));
        return;
      }
      const { parsed } = await response.json();
      setResumes((prev) =>
        prev.map((r) => (r.id === resume.id ? { ...r, parsed_data: parsed } : r))
      );
    } catch {
      setError(t("analyzeError"));
    } finally {
      setAnalyzingId(null);
    }
  }, [t]);

  const handleDelete = useCallback(async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      const response = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? `Delete failed (${response.status})`);
        return;
      }
      setResumes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <Card>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Upload zone */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleUpload(file);
          }}
          disabled={isUploading}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors",
            "border-muted-foreground/25 text-muted-foreground",
            isDragOver && "border-primary/50 bg-accent/50",
            isUploading && "cursor-not-allowed opacity-50"
          )}
        >
          {isUploading ? <Loader2 className="h-10 w-10 animate-spin" /> : <Upload className="h-10 w-10" />}
          <p className="text-sm font-medium">
            {isUploading ? t("uploading") : t("uploadCV")}
          </p>
          <p className="text-xs text-muted-foreground">{t("supportedFormats")}</p>
        </button>

        {/* Resume list */}
        {resumes.length > 0 && (
          <div className="space-y-3">
            {resumes.map((resume) => {
              const parsed = getParsedData(resume);
              const isAnalyzed = parsed !== null;
              const isAnalyzing = analyzingId === resume.id;

              return (
                <div key={resume.id} className="rounded-lg border p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-8 w-8 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{resume.file_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {resume.file_type.toUpperCase()}
                            {resume.created_at && ` · ${formatDate(resume.created_at)}`}
                          </span>
                          {resume.is_primary && (
                            <Badge variant="outline" className="text-xs text-primary border-primary/50">
                              {t("primary")}
                            </Badge>
                          )}
                          {isAnalyzed ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("analyzed")}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">{t("notAnalyzed")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isAnalyzed && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAnalyze(resume)}
                          disabled={isAnalyzing || resume.file_type === "docx"}
                          title={resume.file_type === "docx" ? t("noRawText") : undefined}
                          className="gap-1 text-xs"
                        >
                          {isAnalyzing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                          {isAnalyzing ? t("analyzing") : t("analyzeCV")}
                        </Button>
                      )}
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
                  </div>

                  {/* Parsed data panel */}
                  {isAnalyzed && parsed && (
                    <div className="rounded-md bg-muted/50 p-3 space-y-2 text-sm">
                      {parsed.summary && (
                        <p className="text-muted-foreground italic text-xs leading-relaxed">
                          {parsed.summary.length > 200
                            ? parsed.summary.slice(0, 200) + "…"
                            : parsed.summary}
                        </p>
                      )}
                      {parsed.skills?.technical?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-1">{t("cvSkills")}</p>
                          <div className="flex flex-wrap gap-1">
                            {parsed.skills.technical.slice(0, 12).map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {parsed.skills.technical.length > 12 && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                +{parsed.skills.technical.length - 12}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {parsed.experience?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-1">
                            {t("cvExperience")} ({parsed.experience.length})
                          </p>
                          <ul className="space-y-0.5">
                            {parsed.experience.slice(0, 3).map((exp, i) => (
                              <li key={i} className="text-xs text-muted-foreground">
                                {exp.title} · {exp.company}
                                {exp.end_date === null ? " (actuel)" : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}
