"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAuthBrowserClient } from "@/lib/supabase/browser-client";
import {
  getLatestCoverLetterClient,
  updateCoverLetter,
} from "@/lib/supabase/queries/cover-letters";
import { downloadAsTxt, downloadAsDocx } from "@/lib/utils/download";

type Language = "fr" | "en";
type Tone = "professional" | "enthusiastic" | "creative" | "formal";

const TONES: Tone[] = ["professional", "enthusiastic", "creative", "formal"];

interface CoverLetterModalProps {
  jobId: string;
  jobTitle: string;
  open: boolean;
  onClose: () => void;
}

export function CoverLetterModal({
  jobId,
  jobTitle,
  open,
  onClose,
}: CoverLetterModalProps) {
  const t = useTranslations("jobs");

  const [language, setLanguage] = useState<Language>("fr");
  const [tone, setTone] = useState<Tone>("professional");
  const [letter, setLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLetter, setLoadingLetter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [integrityWarnings, setIntegrityWarnings] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved letter on open
  useEffect(() => {
    if (!open) {
      setLetter(null);
      setError(null);
      setIntegrityWarnings([]);
      setSavedId(null);
      setSaved(false);
      setLoadingLetter(false);
      return;
    }

    let cancelled = false;
    setLoadingLetter(true);

    getLatestCoverLetterClient(jobId)
      .then((row) => {
        if (cancelled) return;
        if (row) {
          setLetter(row.content);
          setIntegrityWarnings(row.integrity_warnings ?? []);
          setSavedId(row.id);
          if (row.language) setLanguage(row.language);
          if (row.tone) setTone(row.tone);
        }
      })
      .catch(() => {
        // Silently fail – user can still generate a new letter
      })
      .finally(() => {
        if (!cancelled) setLoadingLetter(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, jobId]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getAuthBrowserClient();
      const { data: resumes } = await supabase
        .from("resumes")
        .select("id, parsed_data, is_primary")
        .not("parsed_data", "is", null)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);

      const resume = resumes?.[0] ?? null;

      if (!resume) {
        setError(t("coverLetterNoResume"));
        setLoading(false);
        return;
      }

      const res = await fetch("/api/ai/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          resumeId: resume.id,
          language,
          tone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (
          data.error === "Resume not found" ||
          data.error?.includes("analyzed")
        ) {
          setError(t("coverLetterNoResume"));
        } else {
          setError(t("coverLetterError"));
        }
        return;
      }

      const newLetter = data.letter.full_text;
      const warnings: string[] = data.integrityWarnings ?? [];
      const newSavedId: string | null = data.savedId ?? null;

      setLetter(newLetter);
      setIntegrityWarnings(warnings);
      setSavedId(newSavedId);

      // Persist integrity warnings to the saved letter
      if (newSavedId && warnings.length > 0) {
        updateCoverLetter(newSavedId, newLetter, warnings).catch(() => {
          // Non-critical – warnings just won't persist
        });
      }
    } catch {
      setError(t("coverLetterError"));
    } finally {
      setLoading(false);
    }
  }, [jobId, language, tone, t]);

  const handleLetterChange = useCallback(
    (value: string) => {
      setLetter(value);
      setSaved(false);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      if (!savedId) return;

      saveTimerRef.current = setTimeout(async () => {
        try {
          await updateCoverLetter(savedId, value, integrityWarnings);
          setSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
        } catch {
          // Silently fail auto-save
        }
      }, 1000);
    },
    [savedId, integrityWarnings]
  );

  const handleCopy = useCallback(async () => {
    if (!letter) return;
    await navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [letter]);

  const handleDownloadTxt = useCallback(() => {
    if (!letter) return;
    downloadAsTxt(letter, `cover-letter-${jobTitle}`);
  }, [letter, jobTitle]);

  const handleDownloadDocx = useCallback(async () => {
    if (!letter) return;
    await downloadAsDocx(letter, `cover-letter-${jobTitle}`);
  }, [letter, jobTitle]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="overflow-y-auto max-h-[90vh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("coverLetterFor", { company: jobTitle })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Language selector */}
          <div className="flex gap-1">
            {(["fr", "en"] as const).map((lang) => (
              <Button
                key={lang}
                variant={language === lang ? "default" : "outline"}
                size="sm"
                onClick={() => setLanguage(lang)}
              >
                {lang.toUpperCase()}
              </Button>
            ))}
          </div>

          {/* Tone selector */}
          <div className="flex flex-wrap gap-1">
            {TONES.map((t_) => (
              <Button
                key={t_}
                variant={tone === t_ ? "default" : "outline"}
                size="sm"
                onClick={() => setTone(t_)}
              >
                {t(`tone_${t_}`)}
              </Button>
            ))}
          </div>

          {/* Loading saved letter */}
          {loadingLetter && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Generate button */}
          {!letter && !loadingLetter && (
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t("coverLetterGenerate")}
            </Button>
          )}

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Letter display */}
          {letter && (
            <>
              <textarea
                value={letter}
                onChange={(e) => handleLetterChange(e.target.value)}
                className="w-full min-h-[300px] rounded-md border bg-muted p-3 text-sm resize-y"
              />

              {/* Trust badge */}
              <div
                title={t("trustBadgeTooltip")}
                className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                  integrityWarnings.length === 0
                    ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300"
                    : "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300"
                }`}
              >
                {integrityWarnings.length === 0 ? (
                  <>
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                    <span>{t("trustBadgeVerified")}</span>
                  </>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span className="font-medium">
                        {t("trustBadgeReview")}
                      </span>
                    </div>
                    <ul className="ml-6 list-disc space-y-0.5">
                      {integrityWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Saved indicator */}
              {saved && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="size-3" />
                  {t("coverLetterSaved")}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="size-4" />
                      {t("coverLetterCopied")}
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      {t("coverLetterCopy")}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="gap-1"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  {t("coverLetterRegenerate")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTxt}
                  className="gap-1"
                >
                  <FileText className="size-4" />
                  {t("coverLetterDownloadTxt")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadDocx}
                  className="gap-1"
                >
                  <Download className="size-4" />
                  {t("coverLetterDownloadDocx")}
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
