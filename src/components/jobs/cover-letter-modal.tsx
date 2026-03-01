"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAuthBrowserClient } from "@/lib/supabase/browser-client";

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
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch primary resume ID
      const supabase = getAuthBrowserClient();
      const { data: resume } = await supabase
        .from("resumes")
        .select("id, parsed_data")
        .eq("is_primary", true)
        .maybeSingle();

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
        if (data.error === "Resume not found" || data.error?.includes("analyzed")) {
          setError(t("coverLetterNoResume"));
        } else {
          setError(t("coverLetterError"));
        }
        return;
      }

      setLetter(data.letter.full_text);
    } catch {
      setError(t("coverLetterError"));
    } finally {
      setLoading(false);
    }
  }, [jobId, language, tone, t]);

  const handleCopy = useCallback(async () => {
    if (!letter) return;
    await navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [letter]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="overflow-y-auto max-h-[90vh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("coverLetterFor", { company: jobTitle })}</DialogTitle>
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

          {/* Generate button */}
          {!letter && (
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
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Letter display */}
          {letter && (
            <>
              <textarea
                readOnly
                value={letter}
                className="w-full min-h-[300px] rounded-md border bg-muted p-3 text-sm resize-y"
              />
              <div className="flex gap-2">
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
              </div>
            </>
          )}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
