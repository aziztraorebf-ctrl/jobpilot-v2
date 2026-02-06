import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { ScoreCircle } from "@/components/ui/score-circle";
import type { ApplicationWithJob } from "@/lib/supabase/queries";

interface KanbanCardProps {
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

export function KanbanCard({ application, score }: KanbanCardProps) {
  const jobTitle = application.job_listings?.title ?? "Untitled";
  const company = application.job_listings?.company_name ?? "Unknown";

  return (
    <Card className="gap-2 p-3 hover:shadow-md transition-shadow cursor-pointer">
      <div>
        <p className="font-medium text-sm leading-tight">
          {jobTitle}
        </p>
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
