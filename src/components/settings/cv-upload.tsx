"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Upload, FileText, Trash2, Loader2, Sparkles, CheckCircle2,
  Eye, User, Brain, Briefcase, GraduationCap, Globe, Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ResumeRow } from "@/lib/supabase/queries";
import type { ParsedResume } from "@/lib/schemas/ai-responses";
import { KeywordSuggestionsSchema } from "@/lib/schemas/keyword-suggestions";
import type { KeywordSuggestions } from "@/lib/schemas/keyword-suggestions";
import { KeywordSuggestionsModal } from "./keyword-suggestions-modal";
import { toast } from "sonner";

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

interface ParsedProfileModalProps {
  resume: ResumeRow;
  parsed: ParsedResume;
  open: boolean;
  onClose: () => void;
}

function ParsedProfileModal({ resume, parsed, open, onClose }: ParsedProfileModalProps) {
  const t = useTranslations("settings");

  const allSkills = [
    ...(parsed.skills?.technical ?? []),
    ...(parsed.skills?.soft ?? []),
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            {resume.file_name}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground mt-1">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
              <span>{t("cvProfileUsageNote")}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Personal info */}
          {parsed.personal && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                <User className="h-3.5 w-3.5" />
                {t("cvPersonal")}
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {parsed.personal.name && (
                  <div><span className="text-muted-foreground text-xs">{t("cvName")}</span><p className="font-medium">{parsed.personal.name}</p></div>
                )}
                {parsed.personal.location && (
                  <div><span className="text-muted-foreground text-xs">{t("cvLocation")}</span><p>{parsed.personal.location}</p></div>
                )}
                {parsed.personal.email && (
                  <div><span className="text-muted-foreground text-xs">{t("cvEmail")}</span><p>{parsed.personal.email}</p></div>
                )}
                {parsed.personal.phone && (
                  <div><span className="text-muted-foreground text-xs">{t("cvPhone")}</span><p>{parsed.personal.phone}</p></div>
                )}
              </div>
            </section>
          )}

          {/* Summary */}
          {parsed.summary && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                <Brain className="h-3.5 w-3.5" />
                {t("cvSummary")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{parsed.summary}</p>
            </section>
          )}

          {/* Skills */}
          {(allSkills.length > 0 || (parsed.skills?.languages?.length ?? 0) > 0) && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                {t("cvSkillsAll")}
              </h3>
              <div className="space-y-2">
                {allSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {allSkills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                    ))}
                  </div>
                )}
                {(parsed.skills?.languages?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {parsed.skills.languages.map((lang) => (
                      <Badge key={lang} variant="outline" className="text-xs">{lang}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Experience */}
          {parsed.experience?.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                <Briefcase className="h-3.5 w-3.5" />
                {t("cvExperience")} ({parsed.experience.length})
              </h3>
              <div className="space-y-3">
                {parsed.experience.map((exp, i) => (
                  <div key={i} className="border-l-2 border-primary/20 pl-3">
                    <p className="text-sm font-medium">{exp.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {exp.company}
                      {exp.start_date && ` · ${exp.start_date}`}
                      {exp.end_date ? ` — ${exp.end_date}` : exp.start_date ? ` — ${t("cvPresent")}` : ""}
                    </p>
                    {exp.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Education */}
          {parsed.education?.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                <GraduationCap className="h-3.5 w-3.5" />
                {t("cvEducation")}
              </h3>
              <div className="space-y-1.5">
                {parsed.education.map((edu, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium">{edu.degree}</span>
                    {edu.institution && edu.institution !== "Non spécifié" && (
                      <span className="text-muted-foreground"> · {edu.institution}</span>
                    )}
                    {edu.year && edu.year !== "Non spécifié" && (
                      <span className="text-xs text-muted-foreground"> ({edu.year})</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
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
  const [viewingResumeId, setViewingResumeId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<KeywordSuggestions | null>(null);

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
      // Auto-open modal after analysis so user immediately sees what was extracted
      setViewingResumeId(resume.id);

      // Fire-and-forget — don't block the UI if suggestions fail
      try {
        const suggestRes = await fetch("/api/ai/suggest-keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeId: resume.id }),
        });
        if (suggestRes.ok) {
          const json = await suggestRes.json() as { suggestions: unknown };
          const parsed = KeywordSuggestionsSchema.safeParse(json.suggestions);
          if (parsed.success) {
            setSuggestions(parsed.data);
          }
        }
      } catch {
        // suggestions are optional, silently ignore failures
      }
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

  const viewingResume = viewingResumeId
    ? resumes.find((r) => r.id === viewingResumeId) ?? null
    : null;
  const viewingParsed = viewingResume ? getParsedData(viewingResume) : null;

  async function handleSaveSuggestions(
    keywords: string[],
    remotePreference: "remote" | "hybrid" | "any"
  ) {
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_preferences: { keywords, remote_preference: remotePreference },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Échec de la sauvegarde");
      }
      toast.success(t("saveSuccess"));
      // Reload so SearchPreferences tab reflects the newly saved keywords
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la sauvegarde");
    }
  }

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
                <div key={resume.id} className="rounded-lg border p-4">
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
                      {isAnalyzed ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingResumeId(resume.id)}
                          className="gap-1 text-xs"
                        >
                          <Eye className="h-3 w-3" />
                          {t("cvViewProfile")}
                        </Button>
                      ) : (
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

      {/* Parsed profile modal */}
      {viewingResume && viewingParsed && (
        <ParsedProfileModal
          resume={viewingResume}
          parsed={viewingParsed}
          open={viewingResumeId !== null}
          onClose={() => setViewingResumeId(null)}
        />
      )}

      {suggestions && (
        <KeywordSuggestionsModal
          suggestions={suggestions}
          onSave={handleSaveSuggestions}
          onClose={() => setSuggestions(null)}
        />
      )}
    </Card>
  );
}
