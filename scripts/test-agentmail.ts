/**
 * E2E validation script for the AgentMail client.
 *
 * Reads AGENTMAIL_API_KEY + AGENTMAIL_INBOX_ID from .env.local,
 * sends a real test email to NOTIFY_EMAIL, and prints the result.
 *
 * Usage:
 *   npx tsx scripts/test-agentmail.ts
 *
 * This complements the unit tests (which use mocks) by validating
 * that the real API credentials work and the endpoint responds.
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { sendAgentEmail } from "../src/lib/api/agentmail";

async function main() {
  const recipient = process.env.NOTIFY_EMAIL;
  if (!recipient) {
    console.error("ERROR: NOTIFY_EMAIL env var is not set in .env.local");
    process.exit(1);
  }

  console.log("Sending test email via AgentMail...");
  console.log(`  From inbox: ${process.env.AGENTMAIL_INBOX_ID}`);
  console.log(`  To: ${recipient}`);

  const result = await sendAgentEmail({
    to: recipient,
    subject: "[JobPilot] AgentMail e2e test",
    text:
      "This is an end-to-end validation message sent by scripts/test-agentmail.ts.\n\n" +
      "If you received this, the AgentMail integration is wired correctly.",
    html:
      "<h2>AgentMail e2e test</h2>" +
      "<p>This is an end-to-end validation message sent by " +
      "<code>scripts/test-agentmail.ts</code>.</p>" +
      "<p>If you received this, the AgentMail integration is wired correctly.</p>",
  });

  if (result.success) {
    console.log("\nSUCCESS");
    console.log(`  messageId: ${result.messageId}`);
    console.log(`  threadId:  ${result.threadId}`);
    console.log(`\nCheck your inbox at ${recipient}.`);
  } else {
    console.error("\nFAILED");
    console.error(`  error: ${result.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
