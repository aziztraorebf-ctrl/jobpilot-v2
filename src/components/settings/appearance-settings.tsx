"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", icon: Sun, labelKey: "light" },
  { value: "dark", icon: Moon, labelKey: "dark" },
  { value: "system", icon: Monitor, labelKey: "system" },
] as const;

export function AppearanceSettings() {
  const t = useTranslations("settings");
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardContent className="space-y-4">
        <Label>{t("theme")}</Label>
        <div className="grid grid-cols-3 gap-4">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent",
                  isActive && "ring-2 ring-primary border-primary"
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-medium">
                  {t(option.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
