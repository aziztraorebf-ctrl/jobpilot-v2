import { Resend } from "resend";

const SENDER = "JobPilot <onboarding@resend.dev>";

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
      return { success: false, error: `${error.name}: ${error.message}` };
    }

    return { success: true, id: data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
