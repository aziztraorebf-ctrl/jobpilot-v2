import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/fr/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login with valid credentials redirects to dashboard", async ({ page }) => {
    await page.goto("/fr/login");
    await page.getByLabel(/email|courriel/i).fill(process.env.E2E_USER_EMAIL || "test@jobpilot.dev");
    await page.getByLabel(/mot de passe|password/i).fill(process.env.E2E_USER_PASSWORD || "test123");
    await page.getByRole("button", { name: /connexion|se connecter|sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/fr/login");
    await page.getByLabel(/email|courriel/i).fill("wrong@test.com");
    await page.getByLabel(/mot de passe|password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /connexion|se connecter|sign in/i }).click();
    await expect(page.locator("[role=alert], .text-destructive, .text-red-500")).toBeVisible();
  });
});
