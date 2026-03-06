import { test, expect } from "@playwright/test";

// storageState global utilisé (utilisateur connecté)
test.describe("Navigation — sidebar et routing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("toutes les pages du sidebar sont accessibles", async ({ page }) => {
    const links: Array<[RegExp, RegExp]> = [
      [/offres|jobs/i, /\/jobs/],
      [/candidatures|applications/i, /\/applications/],
      [/param|settings/i, /\/settings/],
      [/tableau|dashboard/i, /\/dashboard/],
    ];

    for (const [linkName, urlPattern] of links) {
      await page.getByRole("link", { name: linkName }).click();
      await expect(page).toHaveURL(urlPattern);
    }
  });

  test("dashboard — contenu principal chargé", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
    const mainText = await page.locator("main").textContent();
    expect(mainText!.length).toBeGreaterThan(50);
  });

  test("dashboard — pas de contenu null/undefined visible", async ({ page }) => {
    const bodyText = await page.locator("main").textContent();
    expect(bodyText).not.toContain("undefined");
    expect(bodyText).not.toContain("[object Object]");
  });

  test("page 404 — redirection ou message d'erreur", async ({ page }) => {
    await page.goto("/fr/cette-page-nexiste-pas");
    // Soit une vraie 404, soit redirect vers dashboard
    const is404 = await page.getByText(/404|not found|introuvable/i).isVisible().catch(() => false);
    const isDashboard = page.url().includes("/dashboard");
    expect(is404 || isDashboard).toBeTruthy();
  });
});
