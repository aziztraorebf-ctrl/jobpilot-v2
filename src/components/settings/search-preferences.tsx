"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SearchPreferencesData } from "@/components/settings/settings-page-client";
import { RotationProfilesSettings } from "@/components/settings/rotation-profiles-settings";

interface SearchPreferencesProps {
  searchPreferences: SearchPreferencesData;
}

export function SearchPreferences({ searchPreferences }: SearchPreferencesProps) {
  const t = useTranslations("settings");

  // Tag input state: keywords
  const [keywords, setKeywords] = useState<string[]>(
    searchPreferences.keywords ?? []
  );
  const [newKeyword, setNewKeyword] = useState("");

  // Tag input state: locations
  const [locations, setLocations] = useState<string[]>(
    searchPreferences.locations ?? []
  );
  const [newLocation, setNewLocation] = useState("");

  // Salary
  const [salaryCurrency, setSalaryCurrency] = useState(
    searchPreferences.salary_currency ?? "CAD"
  );
  const [salaryMin, setSalaryMin] = useState(
    String(searchPreferences.salary_min ?? 0)
  );

  // Remote preference
  const [remotePreference, setRemotePreference] = useState<
    "remote" | "hybrid" | "any"
  >(searchPreferences.remote_preference ?? "any");

  const [saving, setSaving] = useState(false);

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newKeyword.trim()) {
      e.preventDefault();
      if (!keywords.includes(newKeyword.trim())) {
        setKeywords([...keywords, newKeyword.trim()]);
      }
      setNewKeyword("");
    }
  };

  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newLocation.trim()) {
      e.preventDefault();
      if (!locations.includes(newLocation.trim())) {
        setLocations([...locations, newLocation.trim()]);
      }
      setNewLocation("");
    }
  };

  const removeLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const remoteOptions: Array<{ value: "remote" | "hybrid" | "any"; label: string }> = [
    { value: "remote", label: t("remote") },
    { value: "hybrid", label: t("hybrid") },
    { value: "any", label: t("any") },
  ];

  const handleSave = useCallback(async () => {
    const parsedSalary = parseInt(salaryMin, 10);
    const safeSalaryMin = Number.isNaN(parsedSalary) || parsedSalary < 0
      ? 0
      : parsedSalary;

    // Confirm any tag still in the input field
    const finalKeywords = newKeyword.trim() && !keywords.includes(newKeyword.trim())
      ? [...keywords, newKeyword.trim()]
      : keywords;
    const finalLocations = newLocation.trim() && !locations.includes(newLocation.trim())
      ? [...locations, newLocation.trim()]
      : locations;
    if (newKeyword.trim()) setNewKeyword("");
    if (newLocation.trim()) setNewLocation("");

    setSaving(true);
    try {
      // Merge with existing preferences to avoid overwriting notification fields
      const merged = {
        ...searchPreferences,
        keywords: finalKeywords,
        locations: finalLocations,
        salary_min: safeSalaryMin,
        salary_currency: salaryCurrency,
        remote_preference: remotePreference,
      };

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_preferences: merged,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.error ?? t("saveError");
        throw new Error(message);
      }

      // Update local state so tags appear immediately without page reload
      setKeywords(finalKeywords);
      setLocations(finalLocations);
      toast.success(t("saveSuccess"));
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("saveError");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [keywords, locations, newKeyword, newLocation, salaryMin, salaryCurrency, remotePreference, searchPreferences, t]);

  return (
    <Card>
      <CardContent className="space-y-6">
        {/* Target Job Titles */}
        <div className="space-y-2">
          <Label>{t("targetJobTitles")}</Label>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw, i) => (
              <Badge key={`keyword-${kw}-${i}`} variant="secondary" className="gap-1">
                {kw}
                <button
                  type="button"
                  onClick={() => removeKeyword(i)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={handleKeywordKeyDown}
            placeholder={t("addTag")}
            className="mt-2"
          />
        </div>

        {/* Preferred Locations */}
        <div className="space-y-2">
          <Label>{t("preferredLocations")}</Label>
          <div className="flex flex-wrap gap-2">
            {locations.map((loc, i) => (
              <Badge key={`location-${loc}-${i}`} variant="secondary" className="gap-1">
                {loc}
                <button
                  type="button"
                  onClick={() => removeLocation(i)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Input
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            onKeyDown={handleLocationKeyDown}
            placeholder={t("addTag")}
            className="mt-2"
          />
        </div>

        {/* Minimum Salary */}
        <div className="space-y-2">
          <Label>{t("minimumSalary")}</Label>
          <div className="flex gap-3">
            <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        {/* Remote Preference */}
        <div className="space-y-2">
          <Label>{t("remotePreference")}</Label>
          <div className="flex gap-2">
            {remoteOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={remotePreference === option.value ? "default" : "outline"}
                className={cn(
                  remotePreference === option.value &&
                    "bg-primary text-primary-foreground"
                )}
                onClick={() => setRemotePreference(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("saving") : t("saveChanges")}
          </Button>
        </div>

        {/* Rotation Profiles */}
        <div className="border-t pt-6 dark:border-gray-700">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            Rotation de profils
          </h3>
          <RotationProfilesSettings
            searchPreferences={searchPreferences}
            onSave={async (updates) => {
              const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  search_preferences: { ...searchPreferences, ...updates },
                }),
              });
              if (!res.ok) {
                throw new Error("Échec de la sauvegarde");
              }
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
