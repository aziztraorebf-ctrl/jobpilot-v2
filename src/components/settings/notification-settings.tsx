"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Bell, Clock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SearchPreferencesData } from "@/components/settings/settings-page-client";

interface NotificationSettingsProps {
  searchPreferences: SearchPreferencesData;
}

export function NotificationSettings({ searchPreferences }: NotificationSettingsProps) {
  const t = useTranslations("settings");

  const [frequency, setFrequency] = useState<"manual" | "daily" | "weekly">(
    searchPreferences.notification_frequency ?? "manual"
  );

  const handleFrequencyChange = useCallback((value: string) => {
    if (value === "manual" || value === "daily" || value === "weekly") {
      setFrequency(value);
    }
  }, []);
  const [hour, setHour] = useState(
    String(searchPreferences.notification_hour ?? 8).padStart(2, "0")
  );
  const [saving, setSaving] = useState(false);

  const hours = Array.from({ length: 13 }, (_, i) => {
    const h = i + 6;
    return { value: String(h).padStart(2, "0"), label: `${h}:00` };
  });

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Merge with existing preferences to avoid overwriting search fields
      const merged = {
        ...searchPreferences,
        notification_frequency: frequency,
        notification_hour: parseInt(hour, 10),
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

      toast.success(t("saveSuccess"));
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("saveError");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [frequency, hour, searchPreferences, t]);

  return (
    <Card>
      <CardContent className="p-6 space-y-8">
        {/* Search frequency */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-muted-foreground" />
            <Label className="text-base font-semibold">
              {t("searchFrequency")}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("searchFrequencyDescription")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={frequency} onValueChange={handleFrequencyChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{t("frequencyManual")}</SelectItem>
                <SelectItem value="daily">{t("frequencyDaily")}</SelectItem>
                <SelectItem value="weekly">{t("frequencyWeekly")}</SelectItem>
              </SelectContent>
            </Select>

            {frequency !== "manual" && (
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Email alerts */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-muted-foreground" />
            <Label className="text-base font-semibold">
              {t("emailAlerts")}
            </Label>
            <Badge variant="secondary" className="text-xs">
              {t("comingSoon")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("emailAlertsDescription")}
          </p>
          <div className="space-y-3 opacity-50 pointer-events-none">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="size-4 rounded border" />
              <div className="flex items-center gap-2">
                <Bell className="size-4" />
                <span className="text-sm">{t("alertNewJobs")}</span>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="size-4 rounded border" />
              <div className="flex items-center gap-2">
                <Bell className="size-4" />
                <span className="text-sm">{t("alertFollowUp")}</span>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="size-4 rounded border" />
              <div className="flex items-center gap-2">
                <Bell className="size-4" />
                <span className="text-sm">{t("alertWeeklySummary")}</span>
              </div>
            </label>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("saving") : t("saveChanges")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
