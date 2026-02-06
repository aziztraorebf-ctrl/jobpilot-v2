"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { KanbanColumn } from "@/components/applications/kanban-column";
import { KanbanCard } from "@/components/applications/kanban-card";
import type { ApplicationWithJob, ApplicationStatus } from "@/lib/supabase/queries";

const COLUMNS = [
  { status: "saved", colorClass: "bg-slate-500" },
  { status: "applied", colorClass: "bg-blue-500" },
  { status: "interview", colorClass: "bg-purple-500" },
  { status: "offer", colorClass: "bg-emerald-500" },
  { status: "rejected", colorClass: "bg-red-500" },
] as const;

interface KanbanBoardProps {
  applications: ApplicationWithJob[];
  scoreMap: Record<string, number>;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}

export function KanbanBoard({
  applications,
  scoreMap,
  onStatusChange,
}: KanbanBoardProps) {
  const t = useTranslations("applications");

  // Group application IDs by status column
  const [items, setItems] = useState<Record<string, string[]>>(() => {
    const grouped: Record<string, string[]> = {};
    for (const col of COLUMNS) grouped[col.status] = [];
    for (const app of applications) {
      if (grouped[app.status]) {
        grouped[app.status].push(app.id);
      }
    }
    return grouped;
  });

  // Map for quick lookup by ID
  const appMap = useMemo(() => {
    const map = new Map<string, ApplicationWithJob>();
    for (const app of applications) map.set(app.id, app);
    return map;
  }, [applications]);

  const handleDragOver = useCallback(
    (event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragOver"]>>[0]) => {
      setItems((current) => move(current, event));
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragEnd"]>>[0]) => {
      if (event.canceled) return;
      const { source } = event.operation;
      if (!source) return;

      const sourceId = String(source.id);
      // Find which column the item ended up in
      for (const [status, ids] of Object.entries(items)) {
        if (ids.includes(sourceId)) {
          const app = appMap.get(sourceId);
          if (app && app.status !== status) {
            onStatusChange(app.id, status as ApplicationStatus);
          }
          break;
        }
      }
    },
    [items, appMap, onStatusChange]
  );

  return (
    <DragDropProvider onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              id={col.status}
              title={t(col.status as "saved" | "applied" | "interview" | "offer" | "rejected")}
              colorClass={col.colorClass}
              count={items[col.status]?.length ?? 0}
            >
              {(items[col.status] ?? []).map((appId, index) => {
                const app = appMap.get(appId);
                if (!app) return null;
                return (
                  <KanbanCard
                    key={app.id}
                    id={app.id}
                    index={index}
                    column={col.status}
                    application={app}
                    score={scoreMap[app.job_listing_id] ?? null}
                  />
                );
              })}
            </KanbanColumn>
          ))}
        </div>
        {/* Scroll fade indicator on mobile */}
        <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none xl:hidden" />
      </div>
    </DragDropProvider>
  );
}
