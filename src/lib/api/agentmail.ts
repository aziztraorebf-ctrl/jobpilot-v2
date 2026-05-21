import { AgentMailClient } from "agentmail";

export interface SendAgentEmailParams {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
}

export interface AgentMailSendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

function getConfig(): { apiKey: string; inboxId: string } {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  const inboxId = process.env.AGENTMAIL_INBOX_ID;
  if (!apiKey) {
    throw new Error("AGENTMAIL_API_KEY env var is not set");
  }
  if (!inboxId) {
    throw new Error("AGENTMAIL_INBOX_ID env var is not set");
  }
  return { apiKey, inboxId };
}

let cachedClient: AgentMailClient | null = null;

function getClient(apiKey: string): AgentMailClient {
  if (!cachedClient) {
    cachedClient = new AgentMailClient({ apiKey });
  }
  return cachedClient;
}

export async function sendAgentEmail(
  params: SendAgentEmailParams
): Promise<AgentMailSendResult> {
  try {
    const { apiKey, inboxId } = getConfig();
    const client = getClient(apiKey);

    const to = Array.isArray(params.to) ? params.to : [params.to];

    const result = await client.inboxes.messages.send(inboxId, {
      to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      cc: params.cc,
      bcc: params.bcc,
      replyTo: params.replyTo,
    });

    return {
      success: true,
      messageId: result.messageId,
      threadId: result.threadId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[agentmail] send failed:", message);
    return { success: false, error: message };
  }
}

export function resetAgentMailClient(): void {
  cachedClient = null;
}
