"use client";

import { Briefcase, TrendingUp, Send, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/supabase/queries";

interface StatsCardsProps {
  stats: DashboardStats;
}

const statConfigs = [
  {
    key: "activeJobs" as const,
    statsField: "activeJobs" as const,
    icon: Briefcase,
    iconColor: "text-blue-500",
    gradient:
      "bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10",
  },
  {
    key: "avgScore" as const,
    statsField: "avgScore" as const,
    icon: TrendingUp,
    iconColor: "text-emerald-500",
    gradient:
      "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/20 dark:to-emerald-600/10",
  },
  {
    key: "activeApps" as const,
    statsField: "activeApplications" as const,
    icon: Send,
    iconColor: "text-purple-500",
    gradient:
      "bg-gradient-to-br from-purple-500/10 to-purple-600/5 dark:from-purple-500/20 dark:to-purple-600/10",
  },
  {
    key: "upcomingInterviews" as const,
    statsField: "upcomingInterviews" as const,
    icon: Video,
    iconColor: "text-orange-500",
    gradient:
      "bg-gradient-to-br from-orange-500/10 to-orange-600/5 dark:from-orange-500/20 dark:to-orange-600/10",
  },
] as const;

export function StatsCards({ stats }: StatsCardsProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statConfigs.map((config) => {
        const Icon = config.icon;
        const value = stats[config.statsField];

        return (
          <Card
            key={config.key}
            className={cn(
              "relative overflow-hidden border-0 shadow-sm",
              config.gradient
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold">{value}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(config.key)}
                  </p>
                </div>
                <Icon className={cn("size-5 mt-1", config.iconColor)} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
