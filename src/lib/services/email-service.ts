import { Resend } from "resend";
import * as Sentry from "@sentry/nextjs";

const SENDER = "JobPilot <onboarding@resend.dev>";

function reportEmailFailure(error: string, subject: string): void {
  Sentry.captureMessage(`sendEmail failed: ${error}`, {
    level: "error",
    tags: { service: "email", provider: "resend" },
    extra: { subject },
  });
}

interface SendEmailOptions {
  subject: string;
  html: string;
  react?: React.ReactElement;
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }

  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) {
    return { success: false, error: "NOTIFY_EMAIL is not configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: SENDER,
      to: notifyEmail,
      subject: options.subject,
      ...(options.react ? { react: options.react } : { html: options.html }),
    });

    if (error) {
      const formatted = `${error.name}: ${error.message}`;
      reportEmailFailure(formatted, options.subject);
      return { success: false, error: formatted };
    }

    return { success: true, id: data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    reportEmailFailure(message, options.subject);
    return { success: false, error: message };
  }
}
