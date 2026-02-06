import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

// Validate required env vars are present
const REQUIRED_VARS = [
  "JSEARCH_API_KEY",
  "ADZUNA_APP_ID",
  "ADZUNA_APP_KEY",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "NOTIFY_EMAIL",
];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.warn(
    `[Integration Setup] Missing env vars: ${missing.join(", ")}\n` +
      "Tests requiring these vars will be skipped. Make sure .env.local is configured."
  );
}
