"use client";

import { useTranslations } from "next-intl";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  view: "kanban" | "list";
  onViewChange: (view: "kanban" | "list") => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  const t = useTranslations("applications");

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={view === "kanban" ? "default" : "ghost"}
        className={cn(
          view === "kanban" && "bg-primary text-primary-foreground"
        )}
        onClick={() => onViewChange("kanban")}
      >
        <LayoutGrid className="size-4" />
        {t("kanban")}
      </Button>
      <Button
        size="sm"
        variant={view === "list" ? "default" : "ghost"}
        className={cn(view === "list" && "bg-primary text-primary-foreground")}
        onClick={() => onViewChange("list")}
      >
        <List className="size-4" />
        {t("list")}
      </Button>
    </div>
  );
}
