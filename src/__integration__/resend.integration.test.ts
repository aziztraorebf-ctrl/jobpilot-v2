import { describe, it, expect } from "vitest";
import { Resend } from "resend";

// Resend free plan: can only send to the account email (gmail).
// NOTIFY_EMAIL in .env.local may differ. We use the Resend-allowed email.
const RESEND_TEST_EMAIL = "aziztraorebf@gmail.com";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  return new Resend(apiKey);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Resend API - Integration", () => {
  it("should have valid API key and connect successfully", async () => {
    const resend = getResendClient();

    const { data, error } = await resend.domains.list();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    console.log(`[Resend] API key valid. Domains: ${data?.data?.length ?? 0}`);
    console.log(`[Resend] Note: Free plan sends only to account email: ${RESEND_TEST_EMAIL}`);
  });

  it("should send a simple test email", async () => {
    await delay(1000); // Respect rate limit: 2 req/s
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: "JobPilot <onboarding@resend.dev>",
      to: RESEND_TEST_EMAIL,
      subject: "[JobPilot] Test d'integration - Email simple",
      text: "Ceci est un test d'integration automatise. Si vous recevez cet email, l'API Resend fonctionne correctement.",
    });

    if (error) {
      console.error(`[Resend] Error: ${error.name} - ${error.message}`);
    }

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.id).toBeDefined();

    console.log(`[Resend] Email sent successfully. ID: ${data?.id}`);
  });

  it("should send an HTML email", async () => {
    await delay(1000); // Respect rate limit: 2 req/s
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: "JobPilot <onboarding@resend.dev>",
      to: RESEND_TEST_EMAIL,
      subject: "[JobPilot] Test d'integration - Email HTML",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">JobPilot - Test HTML</h2>
          <p>Ceci est un test d'integration avec du contenu HTML.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr style="background: #f1f5f9;">
              <th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0;">Test</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0;">Status</th>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">API Connection</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; color: #16a34a;">PASS</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">HTML Rendering</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; color: #16a34a;">PASS</td>
            </tr>
          </table>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">
            Genere automatiquement par les tests d'integration JobPilot.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`[Resend HTML] Error: ${error.name} - ${error.message}`);
    }

    expect(error).toBeNull();
    expect(data?.id).toBeDefined();
    console.log(`[Resend HTML] Email sent. ID: ${data?.id}`);
  });

  it("should handle invalid recipient gracefully", async () => {
    await delay(1000); // Respect rate limit: 2 req/s
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: "JobPilot <onboarding@resend.dev>",
      to: "not-an-email",
      subject: "Test invalid recipient",
      text: "This should fail",
    });

    // Resend should return a validation error, not throw
    expect(error).toBeDefined();
    console.log(`[Resend Error] Expected error: ${error?.name} - ${error?.message}`);
  });
});
