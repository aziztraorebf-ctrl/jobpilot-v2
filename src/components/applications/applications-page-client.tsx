"use client";

import { useState } from "react";
import { ViewToggle } from "@/components/applications/view-toggle";
import { KanbanBoard } from "@/components/applications/kanban-board";
import { ListView } from "@/components/applications/list-view";
import type { ApplicationWithJob } from "@/lib/supabase/queries";

interface ApplicationsPageClientProps {
  applications: ApplicationWithJob[];
  scoreMap: Record<string, number>;
  title: string;
}

export function ApplicationsPageClient({
  applications,
  scoreMap,
  title,
}: ApplicationsPageClientProps) {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{title}</h1>
        <ViewToggle view={view} onViewChange={setView} />
      </div>
      {view === "kanban" ? (
        <KanbanBoard applications={applications} scoreMap={scoreMap} />
      ) : (
        <ListView applications={applications} scoreMap={scoreMap} />
      )}
    </>
  );
}
