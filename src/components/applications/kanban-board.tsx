"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { KanbanColumn } from "@/components/applications/kanban-column";
import type { ApplicationWithJob } from "@/lib/supabase/queries";

interface ColumnConfig {
  status: string;
  colorClass: string;
  titleKey: "saved" | "applied" | "interview" | "offer" | "rejected";
}

const COLUMNS: ColumnConfig[] = [
  { status: "saved", colorClass: "bg-slate-500", titleKey: "saved" },
  { status: "applied", colorClass: "bg-blue-500", titleKey: "applied" },
  { status: "interview", colorClass: "bg-purple-500", titleKey: "interview" },
  { status: "offer", colorClass: "bg-emerald-500", titleKey: "offer" },
  { status: "rejected", colorClass: "bg-red-500", titleKey: "rejected" },
];

interface KanbanBoardProps {
  applications: ApplicationWithJob[];
  scoreMap: Record<string, number>;
}

export function KanbanBoard({ applications, scoreMap }: KanbanBoardProps) {
  const t = useTranslations("applications");

  const applicationsByStatus = useMemo(() => {
    const grouped: Record<string, ApplicationWithJob[]> = {};
    for (const col of COLUMNS) {
      grouped[col.status] = applications.filter(
        (app) => app.status === col.status
      );
    }
    return grouped;
  }, [applications]);

  return (
    <div className="relative">
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.status}
            title={t(column.titleKey)}
            status={column.status}
            applications={applicationsByStatus[column.status] ?? []}
            scoreMap={scoreMap}
            colorClass={column.colorClass}
          />
        ))}
      </div>
      {/* Scroll fade indicator on mobile */}
      <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none xl:hidden" />
    </div>
  );
}
