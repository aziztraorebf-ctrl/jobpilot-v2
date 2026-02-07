"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ViewToggle } from "@/components/applications/view-toggle";
import { KanbanBoard } from "@/components/applications/kanban-board";
import { ListView } from "@/components/applications/list-view";
import type { ApplicationWithJob, ApplicationStatus } from "@/lib/supabase/queries";

interface ApplicationsPageClientProps {
  applications: ApplicationWithJob[];
  scoreMap: Record<string, number>;
  title: string;
}

export function ApplicationsPageClient({
  applications: initial,
  scoreMap,
  title,
}: ApplicationsPageClientProps) {
  const t = useTranslations("applications");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [applications, setApplications] = useState<ApplicationWithJob[]>(initial);

  // NOTE: Rapid consecutive status changes (e.g., two quick DnD moves) may
  // cause incomplete rollback if both fail, since each captures the snapshot
  // after the previous optimistic update. Acceptable for expected low-frequency
  // DnD usage. For high-frequency scenarios, consider a request-keyed rollback map.
  const handleStatusChange = useCallback(
    async (applicationId: string, newStatus: ApplicationStatus) => {
      const prev = applications;
      setApplications((apps) =>
        apps.map((a) =>
          a.id === applicationId ? { ...a, status: newStatus } : a
        )
      );

      try {
        const res = await fetch(`/api/applications/${applicationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error("Update failed");
        toast.success(t("statusUpdated"));
      } catch {
        setApplications(prev);
        toast.error(t("statusUpdateFailed"));
      }
    },
    [applications, t]
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{title}</h1>
        <ViewToggle view={view} onViewChange={setView} />
      </div>
      {view === "kanban" ? (
        <KanbanBoard
          applications={applications}
          scoreMap={scoreMap}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <ListView applications={applications} scoreMap={scoreMap} />
      )}
    </>
  );
}
