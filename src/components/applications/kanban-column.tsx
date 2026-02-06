"use client";

import { useDroppable } from "@dnd-kit/react";
import { CollisionPriority } from "@dnd-kit/abstract";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: string;
  title: string;
  colorClass: string;
  count: number;
  children: React.ReactNode;
}

export function KanbanColumn({
  id,
  title,
  colorClass,
  count,
  children,
}: KanbanColumnProps) {
  const { ref, isDropTarget } = useDroppable({
    id,
    type: "column",
    accept: "item",
    collisionPriority: CollisionPriority.Low,
  });

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
          {count}
        </Badge>
      </div>
      <div
        ref={ref}
        className={cn(
          "bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[200px] transition-colors",
          isDropTarget && "bg-primary/10 ring-2 ring-primary/30"
        )}
      >
        {children}
      </div>
    </div>
  );
}
