"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScoreCircle } from "@/components/ui/score-circle";
import { Badge } from "@/components/ui/badge";

interface ScoreDetail {
  overall_score: number;
  skill_match_score: number;
  experience_match_score: number;
  education_match_score: number;
  explanation: string;
  matching_skills: string[];
  missing_skills: string[];
  strengths: string[];
  concerns: string[];
}

interface ScoreDetailModalProps {
  jobId: string;
  jobTitle: string;
  open: boolean;
  onClose: () => void;
}

function SubScoreBar({ label, score }: { label: string; score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 80
      ? "bg-emerald-500"
      : clamped >= 60
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{clamped}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function ScoreDetailModal({
  jobId,
  jobTitle,
  open,
  onClose,
}: ScoreDetailModalProps) {
  const t = useTranslations("jobs");
  const [data, setData] = useState<ScoreDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const resetState = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/ai/match-score-detail?jobId=${encodeURIComponent(jobId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, jobId, resetState]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="overflow-y-auto max-h-[90vh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{jobTitle}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (error || !data) && (
          <p className="text-center text-muted-foreground py-8">
            {t("scoreNotAvailable")}
          </p>
        )}

        {!loading && data && (
          <div className="space-y-6">
            {/* Overall score */}
            <div className="flex justify-center">
              <ScoreCircle score={data.overall_score} size="lg" />
            </div>

            {/* Explanation */}
            {data.explanation && (
              <p className="text-sm text-muted-foreground text-center">
                {data.explanation}
              </p>
            )}

            {/* Sub-scores */}
            <div className="space-y-3">
              <SubScoreBar
                label={t("scoreSubSkills")}
                score={data.skill_match_score}
              />
              <SubScoreBar
                label={t("scoreSubExperience")}
                score={data.experience_match_score}
              />
              <SubScoreBar
                label={t("scoreSubEducation")}
                score={data.education_match_score}
              />
            </div>

            {/* Matching skills */}
            {(data.matching_skills?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  {t("scoreMatchingSkills")}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.matching_skills.map((skill) => (
                    <Badge
                      key={skill}
                      className="bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-900 dark:text-emerald-300"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Missing skills */}
            {(data.missing_skills?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  {t("scoreMissingSkills")}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.missing_skills.map((skill) => (
                    <Badge
                      key={skill}
                      className="bg-red-100 text-red-700 border-transparent dark:bg-red-900 dark:text-red-300"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths */}
            {(data.strengths?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t("scoreStrengths")}</h4>
                <ul className="space-y-1.5">
                  {data.strengths.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Concerns */}
            {(data.concerns?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t("scoreConcerns")}</h4>
                <ul className="space-y-1.5">
                  {data.concerns.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
