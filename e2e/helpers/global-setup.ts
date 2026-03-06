import { chromium } from "@playwright/test";
import type { FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/fr/login`);
  await page.getByLabel(/email|courriel/i).fill(process.env.E2E_USER_EMAIL ?? "test@jobpilot.dev");
  await page.getByLabel(/mot de passe|password/i).fill(process.env.E2E_USER_PASSWORD ?? "test123");
  await page.getByRole("button", { name: /connexion|se connecter|sign in/i }).click();
  await page.waitForURL("**/dashboard");

  await page.context().storageState({ path: "e2e/.auth/user.json" });
  await browser.close();
}

export default globalSetup;
