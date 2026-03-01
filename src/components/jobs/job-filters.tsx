"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface JobFiltersProps {
  onFiltersChange: (filters: {
    search: string;
    source: string;
    remote: string;
    minScore: number;
    newOnly: boolean;
  }) => void;
}

export function JobFilters({ onFiltersChange }: JobFiltersProps) {
  const t = useTranslations("jobs");

  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [remote, setRemote] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [newOnly, setNewOnly] = useState(false);

  const emitChange = useCallback(
    (overrides: Partial<{ search: string; source: string; remote: string; minScore: number; newOnly: boolean }>) => {
      onFiltersChange({
        search: overrides.search ?? search,
        source: overrides.source ?? source,
        remote: overrides.remote ?? remote,
        minScore: overrides.minScore ?? minScore,
        newOnly: overrides.newOnly ?? newOnly,
      });
    },
    [onFiltersChange, search, source, remote, minScore, newOnly]
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      emitChange({ search: value });
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleSourceChange(value: string) {
    setSource(value);
    emitChange({ source: value });
  }

  function handleRemoteChange(value: string) {
    setRemote(value);
    emitChange({ remote: value });
  }

  function handleMinScoreChange(value: string) {
    const score = parseInt(value, 10);
    setMinScore(score);
    emitChange({ minScore: score });
  }

  function handleNewOnlyChange(checked: boolean) {
    setNewOnly(checked);
    emitChange({ newOnly: checked });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-4 items-center p-4",
        "bg-card rounded-lg border"
      )}
    >
      {/* Search input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Source filter */}
      <Select value={source} onValueChange={handleSourceChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder={t("source")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("allSources")}</SelectItem>
          <SelectItem value="jsearch">JSearch</SelectItem>
          <SelectItem value="adzuna">Adzuna</SelectItem>
        </SelectContent>
      </Select>

      {/* Remote filter */}
      <Select value={remote} onValueChange={handleRemoteChange}>
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder={t("remote")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("all")}</SelectItem>
          <SelectItem value="yes">{t("remoteYes")}</SelectItem>
          <SelectItem value="no">{t("remoteNo")}</SelectItem>
        </SelectContent>
      </Select>

      {/* Min Score filter */}
      <Select
        value={String(minScore)}
        onValueChange={handleMinScoreChange}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t("minScore")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">{t("minScore")}: 0+</SelectItem>
          <SelectItem value="50">{t("minScore")}: 50+</SelectItem>
          <SelectItem value="60">{t("minScore")}: 60+</SelectItem>
          <SelectItem value="70">{t("minScore")}: 70+</SelectItem>
          <SelectItem value="80">{t("minScore")}: 80+</SelectItem>
        </SelectContent>
      </Select>

      {/* New Only filter */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="size-4 rounded border cursor-pointer"
          checked={newOnly}
          onChange={(e) => handleNewOnlyChange(e.target.checked)}
        />
        <span className="text-sm">{t("newOnly")}</span>
      </label>
    </div>
  );
}
