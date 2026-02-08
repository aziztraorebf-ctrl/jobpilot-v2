import { type Page } from "@playwright/test";

export async function loginAsTestUser(page: Page) {
  await page.goto("/fr/login");
  await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL || "test@jobpilot.dev");
  await page.getByLabel(/mot de passe|password/i).fill(process.env.E2E_USER_PASSWORD || "test123");
  await page.getByRole("button", { name: /connexion|sign in/i }).click();
  await page.waitForURL("**/dashboard");
}
