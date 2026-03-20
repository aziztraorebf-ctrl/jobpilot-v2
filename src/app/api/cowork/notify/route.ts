import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { sendEmail } from "@/lib/services/email-service";
import {
  buildMatchNotificationHtml,
  buildStaleReminderHtml,
  type ScoredJobSummary,
} from "@/lib/services/email-builder";

const ScoredJobSchema = z.object({
  title: z.string(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  sourceUrl: z.string(),
  overallScore: z.number(),
  matchingSkills: z.array(z.string()),
});

const MatchesDataSchema = z.object({
  jobs: z.array(ScoredJobSchema),
  totalFetched: z.number(),
  totalScored: z.number(),
  errors: z.array(z.string()).default([]),
});

const StaleDataSchema = z.object({
  applications: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      updated_at: z.string(),
      job_listings: z
        .object({
          title: z.string(),
          company_name: z.string().nullable(),
          source_url: z.string(),
        })
        .nullable(),
    })
  ),
});

const BodySchema = z.object({
  type: z.enum(["new_matches", "stale_reminder"]),
  data: z.unknown(),
});

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  try {
    const raw = await request.json();
    const { type, data } = BodySchema.parse(raw);

    let html: string;
    let subject: string;

    if (type === "new_matches") {
      const parsed = MatchesDataSchema.parse(data);
      html = buildMatchNotificationHtml(parsed.jobs as ScoredJobSummary[], {
        totalFetched: parsed.totalFetched,
        totalScored: parsed.totalScored,
        errors: parsed.errors,
      });
      subject = `[JobPilot] ${parsed.jobs.length} new match(es) found`;
    } else {
      const parsed = StaleDataSchema.parse(data);
      html = buildStaleReminderHtml(parsed.applications);
      subject = `[JobPilot] ${parsed.applications.length} stale application(s) need attention`;
    }

    const result = await sendEmail({ subject, html });

    if (!result.success) {
      console.error("[cowork] notify email error:", result.error);
      return NextResponse.json(
        { error: `Email send failed: ${result.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ sent: true, emailId: result.id });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error, "cowork/notify");
    }
    return apiError(error, "cowork/notify");
  }
}
