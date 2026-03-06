import { type Page } from "@playwright/test";

export async function loginAsTestUser(page: Page) {
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: /courriel|email/i }).fill(process.env.E2E_USER_EMAIL || "test@jobpilot.dev");
  await page.getByRole("textbox", { name: /mot de passe|password/i }).fill(process.env.E2E_USER_PASSWORD || "test123");
  await page.getByRole("button", { name: /se connecter|connexion|sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}

/** Navigate to a URL, re-logging in if the session has expired */
export async function gotoAuthenticated(page: Page, url: string) {
  await page.goto(url);
  // If redirected to login, log back in and retry
  if (page.url().includes("/login")) {
    await loginAsTestUser(page);
    await page.goto(url);
  }
}
