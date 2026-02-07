"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { ScoreCircle } from "@/components/ui/score-circle";
import { cn } from "@/lib/utils";
import type { ApplicationWithJob } from "@/lib/supabase/queries";

interface KanbanCardProps {
  id: string;
  index: number;
  column: string;
  application: ApplicationWithJob;
  score: number | null;
}

function getRelevantDate(application: ApplicationWithJob): string {
  const dateStr =
    application.interview_at ?? application.applied_at ?? application.saved_at;
  if (!dateStr) {
    return "";
  }
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

export function KanbanCard({
  id,
  index,
  column,
  application,
  score,
}: KanbanCardProps) {
  const t = useTranslations("applications");
  const { ref, isDragSource } = useSortable({
    id,
    index,
    type: "item",
    group: column,
  });

  const jobTitle = application.job_listings?.title ?? t("untitled");
  const company = application.job_listings?.company_name ?? t("unknownCompany");

  return (
    <Card
      ref={ref}
      className={cn(
        "gap-2 p-3 cursor-grab active:cursor-grabbing transition-shadow",
        isDragSource ? "opacity-50 shadow-lg" : "hover:shadow-md"
      )}
    >
      <div>
        <p className="font-medium text-sm leading-tight">{jobTitle}</p>
        <p className="text-xs text-muted-foreground">{company}</p>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          {getRelevantDate(application)}
        </span>
        {score !== null && <ScoreCircle score={score} size="sm" />}
      </div>
    </Card>
  );
}
