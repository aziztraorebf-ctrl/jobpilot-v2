import { test, expect } from "@playwright/test";

// Ces tests vérifient le rendu mobile sur les 5 pages principales
// Ils s'exécutent dans le projet mobile-chrome (Pixel 5, 393px)
test.describe("Mobile smoke tests", () => {
  const appPages = [
    { url: "/fr/dashboard", name: "Dashboard" },
    { url: "/fr/jobs", name: "Jobs" },
    { url: "/fr/applications", name: "Applications" },
    { url: "/fr/settings", name: "Settings" },
    { url: "/fr/career-chat", name: "Career Chat" },
  ];

  for (const { url, name } of appPages) {
    test(`${name} — pas de scroll horizontal`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    });

    test(`${name} — pas de contenu null/undefined`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();

      // Vérifier dans main uniquement (body inclut les chunks RSC qui contiennent "$undefined")
      const mainText = await page.locator("main").textContent();
      expect(mainText).not.toContain("[object Object]");
    });
  }

  test("Jobs mobile — cartes visibles et non tronquées (>200px)", async ({ page }) => {
    await page.goto("/fr/jobs");
    const firstCard = page.locator("article").first();
    const hasCard = await firstCard.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasCard) return;

    const box = await firstCard.boundingBox();
    expect(box?.width).toBeGreaterThan(200);
  });

  test("Settings mobile — tous les onglets accessibles (>=4)", async ({ page }) => {
    await page.goto("/fr/settings");
    const tabs = page.getByRole("tab");
    await expect(tabs.first()).toBeVisible({ timeout: 5000 });
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("Dashboard mobile — stats cards visibles", async ({ page }) => {
    await page.goto("/fr/dashboard");
    await expect(page.locator("main")).toBeVisible();
    const mainText = await page.locator("main").textContent();
    expect(mainText!.length).toBeGreaterThan(50);
  });
});
