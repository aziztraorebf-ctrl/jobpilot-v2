import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendEmail } from "../email-service";

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
  })),
}));

describe("sendEmail", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("NOTIFY_EMAIL", "test@example.com");
  });

  it("sends an email with subject and html content", async () => {
    const result = await sendEmail({
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });
    expect(result.success).toBe(true);
    expect(result.id).toBe("test-id");
  });

  it("returns error when RESEND_API_KEY is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const result = await sendEmail({
      subject: "Test",
      html: "<p>Hello</p>",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("RESEND_API_KEY");
  });

  it("returns error when NOTIFY_EMAIL is missing", async () => {
    vi.stubEnv("NOTIFY_EMAIL", "");
    const result = await sendEmail({
      subject: "Test",
      html: "<p>Hello</p>",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("NOTIFY_EMAIL");
  });
});
