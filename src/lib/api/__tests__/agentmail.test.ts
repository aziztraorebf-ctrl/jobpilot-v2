import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSend = vi.fn();

vi.mock("agentmail", () => ({
  AgentMailClient: vi.fn().mockImplementation(() => ({
    inboxes: {
      messages: {
        send: mockSend,
      },
    },
  })),
}));

describe("sendAgentEmail", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.resetModules();
    mockSend.mockReset();
    process.env.AGENTMAIL_API_KEY = "am_test_key";
    process.env.AGENTMAIL_INBOX_ID = "inbox_test_123";
    const { resetAgentMailClient } = await import("../agentmail");
    resetAgentMailClient();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns success with messageId and threadId on successful send", async () => {
    mockSend.mockResolvedValue({
      messageId: "msg_abc",
      threadId: "thread_xyz",
    });
    const { sendAgentEmail } = await import("../agentmail");

    const result = await sendAgentEmail({
      to: "recipient@example.com",
      subject: "Test",
      text: "Hello",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg_abc");
    expect(result.threadId).toBe("thread_xyz");
    expect(mockSend).toHaveBeenCalledWith(
      "inbox_test_123",
      expect.objectContaining({
        to: ["recipient@example.com"],
        subject: "Test",
        text: "Hello",
      })
    );
  });

  it("normalizes single string recipient to array", async () => {
    mockSend.mockResolvedValue({ messageId: "msg_1", threadId: "t_1" });
    const { sendAgentEmail } = await import("../agentmail");

    await sendAgentEmail({
      to: "single@example.com",
      subject: "Test",
      text: "Body",
    });

    expect(mockSend.mock.calls[0][1].to).toEqual(["single@example.com"]);
  });

  it("passes array recipients through unchanged", async () => {
    mockSend.mockResolvedValue({ messageId: "m", threadId: "t" });
    const { sendAgentEmail } = await import("../agentmail");

    await sendAgentEmail({
      to: ["a@example.com", "b@example.com"],
      subject: "Test",
      text: "Body",
    });

    expect(mockSend.mock.calls[0][1].to).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("forwards optional cc, bcc, replyTo, html fields", async () => {
    mockSend.mockResolvedValue({ messageId: "m", threadId: "t" });
    const { sendAgentEmail } = await import("../agentmail");

    await sendAgentEmail({
      to: "to@example.com",
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      replyTo: ["reply@example.com"],
      subject: "Test",
      text: "Plain",
      html: "<p>HTML</p>",
    });

    const payload = mockSend.mock.calls[0][1];
    expect(payload.cc).toEqual(["cc@example.com"]);
    expect(payload.bcc).toEqual(["bcc@example.com"]);
    expect(payload.replyTo).toEqual(["reply@example.com"]);
    expect(payload.html).toBe("<p>HTML</p>");
  });

  it("returns success=false with error message when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("API rate limited"));
    const { sendAgentEmail } = await import("../agentmail");

    const result = await sendAgentEmail({
      to: "to@example.com",
      subject: "Test",
      text: "Body",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("API rate limited");
    expect(result.messageId).toBeUndefined();
  });

  it("returns success=false when AGENTMAIL_API_KEY is missing", async () => {
    delete process.env.AGENTMAIL_API_KEY;
    const { sendAgentEmail } = await import("../agentmail");

    const result = await sendAgentEmail({
      to: "to@example.com",
      subject: "Test",
      text: "Body",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("AGENTMAIL_API_KEY");
  });

  it("returns success=false when AGENTMAIL_INBOX_ID is missing", async () => {
    delete process.env.AGENTMAIL_INBOX_ID;
    const { sendAgentEmail } = await import("../agentmail");

    const result = await sendAgentEmail({
      to: "to@example.com",
      subject: "Test",
      text: "Body",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("AGENTMAIL_INBOX_ID");
  });
});
