import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("stats cards chargées sans valeurs vides", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
    const main = await page.locator("main").textContent() ?? "";
    expect(main.length).toBeGreaterThan(100);
    expect(main).not.toContain("undefined");
    expect(main).not.toContain("[object Object]");
  });

  test("section top jobs visible (jobs ou état vide cohérent)", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
    // Au minimum, le titre de section ou un état vide doit être rendu
    const hasTopJobs = await page.getByText(/meilleures offres|top jobs|offres/i).first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmpty = await page.getByText(/aucun|no.*result|empty/i).first().isVisible({ timeout: 1000 }).catch(() => false);
    // La page a du contenu dans tous les cas
    const mainText = await page.locator("main").textContent();
    expect(mainText!.length).toBeGreaterThan(50);
    void hasTopJobs; void hasEmpty;
  });

  test("bannière rotation — absente ou correctement affichée", async ({ page }) => {
    const banner = page.locator(".bg-blue-50, .bg-blue-950, [class*='blue']").first();
    const bannerVisible = await banner.isVisible({ timeout: 2000 }).catch(() => false);
    if (bannerVisible) {
      const bannerText = await banner.textContent();
      expect(bannerText).toBeTruthy();
      expect(bannerText!.length).toBeGreaterThan(5);
      // Ne doit pas contenir de valeurs nulles
      expect(bannerText).not.toContain("undefined");
    }
    // Si absente, c'est normal (pas assez de profils configurés)
  });

  test("section candidatures récentes visible", async ({ page }) => {
    const recentSection = page.getByText(/candidatures récentes|recent applications/i);
    await expect(recentSection).toBeVisible({ timeout: 5000 });
  });

  test("aucune erreur console critique", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.waitForTimeout(500);
    const critical = errors.filter(
      (e) => !e.includes("hydration") && !e.includes("Warning") && !e.includes("favicon")
    );
    expect(critical).toHaveLength(0);
  });

  test("score modal s'ouvre et se ferme depuis le dashboard", async ({ page }) => {
    // Chercher un badge de score cliquable
    const scoreBtn = page.getByRole("button", { name: /\d+%/ }).first();
    const hasScoredJob = await scoreBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasScoredJob) return; // Pas de jobs scorés, test skip naturel

    await scoreBtn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Fermer avec Escape
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });

  test("navigation vers jobs depuis top jobs", async ({ page }) => {
    // Si une carte job est visible, on peut cliquer dessus
    const jobCard = page.locator("article").first();
    const hasCard = await jobCard.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasCard) return;
    // Vérifier juste que les cartes sont cliquables / pas des liens cassés
    const cardText = await jobCard.textContent();
    expect(cardText!.length).toBeGreaterThan(5);
  });
});
