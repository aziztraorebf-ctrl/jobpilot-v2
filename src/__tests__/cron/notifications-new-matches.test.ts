import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/cron-auth", () => ({
  verifyCronSecret: vi.fn(() => true),
  unauthorizedResponse: vi.fn(),
}));

vi.mock("@/lib/supabase/queries", () => ({
  getProfilesWithAutoSearch: vi.fn(),
  getJobs: vi.fn(),
  getScoreMap: vi.fn(),
  getStaleApplications: vi.fn(),
  getWeeklyStats: vi.fn(),
  getTopScoredUnseenJobs: vi.fn(),
  insertCronRun: vi.fn(),
}));

vi.mock("@/lib/services/email-service", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@react-email/components", () => ({
  render: vi.fn(async () => "<html>email</html>"),
}));

vi.mock("@/emails/new-jobs-alert", () => ({
  NewJobsAlert: vi.fn(() => null),
}));

vi.mock("@/emails/weekly-summary", () => ({
  WeeklySummary: vi.fn(() => null),
}));

vi.mock("@/emails/follow-up-reminder", () => ({
  FollowUpReminder: vi.fn(() => null),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { GET } from "@/app/api/cron/notifications/route";
import * as queries from "@/lib/supabase/queries";
import * as emailService from "@/lib/services/email-service";

const mockProfile = {
  id: "user-1",
  search_preferences: {
    notification_frequency: "manual",
    alert_threshold: 60,
  },
};

describe("cron/notifications — new matches digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(queries.getStaleApplications).mockResolvedValue([]);
    vi.mocked(queries.getWeeklyStats).mockResolvedValue({ appliedCount: 0, interviewCount: 0 } as never);
    vi.mocked(queries.getJobs).mockResolvedValue([]);
    vi.mocked(queries.getScoreMap).mockResolvedValue({});
    vi.mocked(queries.insertCronRun).mockResolvedValue(undefined as never);
    vi.mocked(emailService.sendEmail).mockResolvedValue({ success: true, id: "email-1" });
  });

  it("sends new matches email when top scored unseen jobs exist (manual frequency)", async () => {
    vi.mocked(queries.getProfilesWithAutoSearch).mockResolvedValue([mockProfile as never]);
    vi.mocked(queries.getTopScoredUnseenJobs).mockResolvedValue([
      { job_listing_id: "j1", title: "Agent Sécurité", company_name: "Garda", source_url: "https://example.com", overall_score: 82 },
      { job_listing_id: "j2", title: "Coordonnateur", company_name: "CIUSSS", source_url: "https://example2.com", overall_score: 75 },
    ] as never);

    const req = new Request("http://localhost/api/cron/notifications");
    const res = await GET(req);
    const json = await res.json();

    expect(json.emailsSent).toBe(1);
    const calls = vi.mocked(emailService.sendEmail).mock.calls;
    const matchCall = calls.find((c) => c[0].subject.includes("nouvelle"));
    expect(matchCall).toBeDefined();
  });

  it("does not send new matches email when no top scored jobs", async () => {
    vi.mocked(queries.getProfilesWithAutoSearch).mockResolvedValue([mockProfile as never]);
    vi.mocked(queries.getTopScoredUnseenJobs).mockResolvedValue([]);

    const req = new Request("http://localhost/api/cron/notifications");
    const res = await GET(req);
    const json = await res.json();

    const calls = vi.mocked(emailService.sendEmail).mock.calls;
    const matchCall = calls.find((c) => c[0].subject.includes("nouvelle"));
    expect(matchCall).toBeUndefined();
    expect(json.emailsSent).toBe(0);
  });

  it("continues without failing cron when new matches email fails", async () => {
    vi.mocked(queries.getProfilesWithAutoSearch).mockResolvedValue([mockProfile as never]);
    vi.mocked(queries.getTopScoredUnseenJobs).mockResolvedValue([
      { job_listing_id: "j1", title: "Dev", company_name: "ACME", source_url: "https://x.com", overall_score: 80 },
    ] as never);
    vi.mocked(emailService.sendEmail).mockResolvedValue({ success: false, error: "SMTP error" });

    const req = new Request("http://localhost/api/cron/notifications");
    const res = await GET(req);
    const json = await res.json();

    expect(json.emailsSent).toBe(0);
    expect(res.status).toBe(200);
  });
});
