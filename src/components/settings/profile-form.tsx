"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProfileData } from "@/components/settings/settings-page-client";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ProfileFormProps {
  profile: ProfileData;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const t = useTranslations("settings");

  const [fullName, setFullName] = useState(profile.full_name);
  const [language, setLanguage] = useState<"fr" | "en">(profile.preferred_language);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!fullName.trim()) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          preferred_language: language,
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
  }, [fullName, language, t]);

  return (
    <Card>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
            {getInitials(fullName || "?")}
          </div>
          <div>
            <p className="text-lg font-semibold">{fullName || "-"}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>

        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName">{t("fullName")}</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <div className="relative">
            <Input
              id="email"
              value={profile.email}
              readOnly
              className="bg-muted pr-10"
            />
            <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {/* Language toggle */}
        <div className="space-y-2">
          <Label>{t("language")}</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={language === "fr" ? "default" : "outline"}
              className={cn(
                language === "fr" && "bg-primary text-primary-foreground"
              )}
              onClick={() => setLanguage("fr")}
            >
              FR
            </Button>
            <Button
              type="button"
              size="sm"
              variant={language === "en" ? "default" : "outline"}
              className={cn(
                language === "en" && "bg-primary text-primary-foreground"
              )}
              onClick={() => setLanguage("en")}
            >
              EN
            </Button>
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
