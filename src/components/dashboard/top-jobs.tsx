"use client";

import { Heart, ExternalLink, X, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreCircle } from "@/components/ui/score-circle";
import type { JobRow } from "@/lib/supabase/queries";

interface TopJobsProps {
  jobs: JobRow[];
  scoreMap: Record<string, number>;
}

export function TopJobs({ jobs, scoreMap }: TopJobsProps) {
  const t = useTranslations("dashboard");

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">{t("topJobsToday")}</h2>
      <div className="relative">
        <div className="flex overflow-x-auto gap-4 pb-2 snap-x snap-mandatory scroll-smooth -mx-6 px-6">
          {jobs.map((job) => {
            const score = scoreMap[job.id] ?? 0;

            return (
              <Card
                key={job.id}
                className="min-w-[260px] max-w-[300px] sm:min-w-[280px] sm:max-w-[320px] shrink-0 border snap-start"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate" title={job.title}>
                        {job.title}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {job.company_name ?? t("unknownCompany")}
                      </p>
                    </div>
                    <ScoreCircle score={score} size="md" />
                  </div>

                  {job.location !== null && (
                    <Badge variant="outline" className="mt-3 gap-1">
                      <MapPin className="size-3" />
                      {job.location}
                    </Badge>
                  )}

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("save")}
                    >
                      <Heart className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("apply")}
                      asChild
                    >
                      <a
                        href={job.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("dismiss")}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {/* Scroll fade indicator */}
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden" />
      </div>
    </section>
  );
}
