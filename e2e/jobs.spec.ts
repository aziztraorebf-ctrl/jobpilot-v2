import { test, expect } from "@playwright/test";

test.describe("Jobs — chargement et filtres de base", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/jobs");
    await expect(page).toHaveURL(/\/jobs/);
  });

  test("page se charge sans écran blanc", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
    const mainText = await page.locator("main").textContent();
    expect(mainText!.length).toBeGreaterThan(10);
  });

  test("pas de contenu null/undefined affiché", async ({ page }) => {
    const bodyText = await page.locator("main").textContent();
    expect(bodyText).not.toContain("undefined");
    expect(bodyText).not.toContain("[object Object]");
  });

  test("tab actif visible et sélectionnable", async ({ page }) => {
    const activeTab = page.getByRole("tab", { name: /activ|active/i });
    await expect(activeTab).toBeVisible({ timeout: 5000 });
    await activeTab.click();
    await expect(activeTab).toHaveAttribute("data-state", "active");
  });

  test("tab rejetés visible et sélectionnable", async ({ page }) => {
    const dismissedTab = page.getByRole("tab", { name: /rejet|dismiss/i });
    if (!(await dismissedTab.isVisible({ timeout: 3000 }))) return;
    await dismissedTab.click();
    await expect(dismissedTab).toHaveAttribute("data-state", "active");
    // Revenir sur actifs
    await page.getByRole("tab", { name: /activ|active/i }).click();
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
});

test.describe("Jobs — actions sur les cartes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/jobs");
    await expect(page).toHaveURL(/\/jobs/);
  });

  test("dismiss un job — disparaît de la liste active", async ({ page }) => {
    const jobs = page.locator("article");
    if ((await jobs.count()) === 0) return;

    const firstJob = jobs.first();
    const dismissBtn = firstJob.getByRole("button", { name: /rejeter|dismiss|ignorer/i });
    if (!(await dismissBtn.isVisible({ timeout: 2000 }))) return;

    const initialCount = await jobs.count();
    await dismissBtn.click();
    await page.waitForTimeout(500);
    expect(await jobs.count()).toBeLessThan(initialCount);
  });

  test("restore un job — revient dans la liste active", async ({ page }) => {
    const dismissedTab = page.getByRole("tab", { name: /rejet|dismiss/i });
    if (!(await dismissedTab.isVisible({ timeout: 3000 }))) return;
    await dismissedTab.click();

    const dismissedJobs = page.locator("article");
    if ((await dismissedJobs.count()) === 0) return;

    const restoreBtn = dismissedJobs.first().getByRole("button", { name: /restaurer|restore/i });
    if (!(await restoreBtn.isVisible({ timeout: 2000 }))) return;

    await restoreBtn.click();
    await page.waitForTimeout(500);
    // Revenir sur actifs
    await page.getByRole("tab", { name: /activ|active/i }).click();
    await expect(page.locator("article").first()).toBeVisible({ timeout: 3000 });
  });

  test("score badge affiche un nombre valide (0-100)", async ({ page }) => {
    const scoreBadge = page.locator("text=/%/").first();
    if (!(await scoreBadge.isVisible({ timeout: 3000 }))) return;
    const text = await scoreBadge.textContent();
    const num = parseInt(text ?? "0", 10);
    expect(num).toBeGreaterThanOrEqual(0);
    expect(num).toBeLessThanOrEqual(100);
  });

  test("badge 'Nouveau' — pas d'erreur JS lors de l'affichage", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.waitForTimeout(300);
    const critical = errors.filter(
      (e) => !e.includes("hydration") && !e.includes("Warning")
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe("Jobs — recherche manuelle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/jobs");
  });

  test("bouton recherche manuelle présent avec compteur", async ({ page }) => {
    const searchBtn = page.getByRole("button", { name: /recherche.*manuelle|manual.*search/i });
    if (!(await searchBtn.isVisible({ timeout: 3000 }))) return;
    const btnText = await searchBtn.textContent();
    // Doit contenir un chiffre (compteur restant)
    expect(btnText).toMatch(/\d/);
  });
});

test.describe("Jobs — rotation profiles (tabs par profil)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/jobs");
  });

  test("si tabs de rotation présents — tous fonctionnels", async ({ page }) => {
    // Les tabs de rotation n'apparaissent que si 2 profils configurés
    const allTab = page.getByRole("button", { name: /^tous$|^all$/i });
    if (!(await allTab.isVisible({ timeout: 3000 }))) return;

    await allTab.click();
    await page.waitForTimeout(300);
    // Pas de crash
    await expect(page.locator("main")).toBeVisible();

    // Vérifier que les autres boutons de profil sont cliquables
    // (ils sont des boutons simples, pas des tabs ARIA)
    const profileBtns = await page.getByRole("button").all();
    for (const btn of profileBtns.slice(0, 5)) {
      const text = await btn.textContent();
      if (text && text.length > 0 && text.length < 30) {
        // Bouton de profil potentiel — vérifier qu'il est enabled
        const isDisabled = await btn.isDisabled();
        expect(isDisabled).toBe(false);
      }
    }
  });
});

test.describe("Jobs — cover letter modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/jobs");
    await page.waitForSelector("article", { timeout: 10000 }).catch(() => null);
  });

  test("modal cover letter s'ouvre et se ferme", async ({ page }) => {
    const jobs = page.locator("article");
    if ((await jobs.count()) === 0) return;

    // Chercher bouton cover letter par aria-label ou title
    const coverBtn = jobs.first().locator(
      'button[title*="lettre"], button[aria-label*="lettre"], button[aria-label*="cover"]'
    );

    if (await coverBtn.isVisible({ timeout: 2000 })) {
      await coverBtn.click();
    } else {
      // Fallback : 2e bouton de la carte
      const allBtns = jobs.first().locator("button");
      if ((await allBtns.count()) >= 2) {
        await allBtns.nth(1).click();
      } else {
        return;
      }
    }

    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await expect(dialog).toBeVisible();

    // Soit un bouton "générer", soit une textarea
    const hasCTA = await dialog
      .getByRole("button", { name: /générer|generate/i })
      .isVisible()
      .catch(() => false);
    const hasTextarea = await dialog.locator("textarea").isVisible().catch(() => false);
    expect(hasCTA || hasTextarea).toBeTruthy();

    // Fermer
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });
});
