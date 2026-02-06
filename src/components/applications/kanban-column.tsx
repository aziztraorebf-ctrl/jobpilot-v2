import { Badge } from "@/components/ui/badge";
import { KanbanCard } from "@/components/applications/kanban-card";
import { cn } from "@/lib/utils";
import type { ApplicationWithJob } from "@/lib/supabase/queries";

interface KanbanColumnProps {
  title: string;
  status: string;
  applications: ApplicationWithJob[];
  scoreMap: Record<string, number>;
  colorClass: string;
}

export function KanbanColumn({
  title,
  applications,
  scoreMap,
  colorClass,
}: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-[75vw] sm:w-56 xl:flex-1 xl:min-w-[180px] snap-start">
      <div
        className={cn(
          "rounded-t-lg p-3 font-semibold text-white text-center flex items-center justify-center gap-2",
          colorClass
        )}
      >
        <span>{title}</span>
        <Badge
          variant="secondary"
          className="bg-white/20 text-white border-transparent"
        >
          {applications.length}
        </Badge>
      </div>
      <div className="bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[200px]">
        {applications.map((application) => (
          <KanbanCard
            key={application.id}
            application={application}
            score={scoreMap[application.job_listing_id] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
