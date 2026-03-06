import { test, expect } from "@playwright/test";

test.describe("Auth — protection des routes", () => {
  // Override storageState global pour tester en mode non-authentifié
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirect dashboard → login si non connecté", async ({ page }) => {
    await page.goto("/fr/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirect jobs → login si non connecté", async ({ page }) => {
    await page.goto("/fr/jobs");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirect settings → login si non connecté", async ({ page }) => {
    await page.goto("/fr/settings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirect applications → login si non connecté", async ({ page }) => {
    await page.goto("/fr/applications");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login avec identifiants valides → dashboard", async ({ page }) => {
    await page.goto("/fr/login");
    await page.getByLabel(/email|courriel/i).fill(process.env.E2E_USER_EMAIL ?? "test@jobpilot.dev");
    await page.getByLabel(/mot de passe|password/i).fill(process.env.E2E_USER_PASSWORD ?? "test123");
    await page.getByRole("button", { name: /connexion|se connecter|sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("login avec mauvais mot de passe → message d'erreur, reste sur login", async ({ page }) => {
    await page.goto("/fr/login");
    await page.getByLabel(/email|courriel/i).fill("wrong@test.com");
    await page.getByLabel(/mot de passe|password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /connexion|se connecter|sign in/i }).click();
    await expect(page.locator("[role=alert], .text-destructive")).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Auth — i18n", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("page login en français (/fr/login)", async ({ page }) => {
    await page.goto("/fr/login");
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
  });

  test("page login en anglais (/en/login)", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});
