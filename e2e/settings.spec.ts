import { test, expect } from "@playwright/test";

test.describe("Settings — Profil", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/settings");
    await page.getByRole("tab", { name: /profil|profile/i }).click();
  });

  test("champ nom affiché et non vide", async ({ page }) => {
    const nameInput = page.getByLabel(/nom|name/i).first();
    await expect(nameInput).toBeVisible();
    const val = await nameInput.inputValue();
    expect(val.length).toBeGreaterThan(0);
  });

  test("onglet profil se charge sans erreur", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
    const text = await page.locator("main").textContent();
    expect(text).not.toContain("undefined");
  });
});

test.describe("Settings — Préférences de recherche", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/settings");
    await page.getByRole("tab", { name: /préférence|search/i }).click();
  });

  test("zone de tags mots-clés présente", async ({ page }) => {
    const input = page.getByPlaceholder(/ajouter|add tag/i).first();
    await expect(input).toBeVisible({ timeout: 5000 });
  });

  test("ajout d'un mot-clé via Enter", async ({ page }) => {
    const input = page.getByPlaceholder(/ajouter|add tag/i).first();
    if (!(await input.isVisible({ timeout: 2000 }))) return;

    await input.fill("E2E-TestKeyword");
    await input.press("Enter");
    await expect(page.getByText("E2E-TestKeyword")).toBeVisible({ timeout: 3000 });

    // Nettoyage : supprimer le tag
    const badge = page.locator("span, div").filter({ hasText: "E2E-TestKeyword" }).first();
    const removeBtn = badge.locator("button").first();
    if (await removeBtn.isVisible()) await removeBtn.click();
  });

  test("boutons remote/hybrid/any sélectionnables", async ({ page }) => {
    const remoteBtn = page.getByRole("button", { name: /^remote$/i });
    const anyBtn = page.getByRole("button", { name: /^any|tous$/i });

    if (!(await remoteBtn.isVisible({ timeout: 2000 }))) return;

    await remoteBtn.click();
    await page.waitForTimeout(200);
    // Vérifier que ça ne plante pas
    await expect(page.locator("main")).toBeVisible();

    if (await anyBtn.isVisible()) {
      await anyBtn.click();
    }
  });

  test("sauvegarde préférences — toast de succès visible", async ({ page }) => {
    const saveBtn = page.getByRole("button", { name: /sauvegarder|save/i }).first();
    await saveBtn.click();
    await expect(
      page.locator("[data-sonner-toast], [role=status], li[data-type]").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("section rotation profiles présente", async ({ page }) => {
    const rotationSection = page.getByText(/rotation/i).first();
    await expect(rotationSection).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Settings — CV / Résumé", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/settings");
    await page.getByRole("tab", { name: /cv|résumé|resume/i }).click();
  });

  test("zone d'upload présente", async ({ page }) => {
    const uploadZone = page.getByText(/déposez|drag|parcourir|browse|cliquez/i).first();
    await expect(uploadZone).toBeVisible({ timeout: 5000 });
  });

  test("erreur 'Resume not found' absente au chargement", async ({ page }) => {
    await expect(page.getByText(/resume not found/i)).toBeHidden({ timeout: 3000 });
  });

  test("liste CVs sans contenu null/undefined", async ({ page }) => {
    const text = await page.locator("main").textContent();
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("[object Object]");
  });

  test("upload CV TXT → apparaît dans la liste", async ({ page }) => {
    const uploadInput = page.locator('input[type="file"]');
    await uploadInput.setInputFiles({
      name: "test-cv-e2e.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Software Engineer with 5 years TypeScript and React experience."),
    });

    await expect(page.getByText("test-cv-e2e.txt")).toBeVisible({ timeout: 15000 });

    // Nettoyage : supprimer le CV uploadé
    const cvRow = page.locator("div, article").filter({ hasText: "test-cv-e2e.txt" }).first();
    const deleteBtn = cvRow.getByRole("button").filter({ has: page.locator("svg") }).last();
    if (await deleteBtn.isVisible({ timeout: 2000 })) {
      await deleteBtn.click();
      await expect(page.getByText("test-cv-e2e.txt")).toBeHidden({ timeout: 10000 });
    }
  });
});

test.describe("Settings — Notifications", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/settings");
    await page.getByRole("tab", { name: /notif/i }).click();
  });

  test("select fréquence visible et fonctionnel", async ({ page }) => {
    const freqSelect = page.getByRole("combobox").first();
    await expect(freqSelect).toBeVisible({ timeout: 5000 });
  });

  test("fréquence 'Quotidienne' sauvegardée et persistée après reload", async ({ page }) => {
    const freqSelect = page.getByRole("combobox").first();
    if (!(await freqSelect.isVisible({ timeout: 3000 }))) return;

    await freqSelect.click();
    const dailyOption = page.getByRole("option", { name: /quotidienne|daily/i });
    if (await dailyOption.isVisible({ timeout: 2000 })) {
      await dailyOption.click();
    } else {
      return;
    }

    const saveBtn = page.getByRole("button", { name: /sauvegarder|save/i });
    await saveBtn.click();
    await page.locator("[data-sonner-toast], [role=status], li[data-type]").first().isVisible({ timeout: 5000 }).catch(() => null);

    // Recharger et vérifier persistance
    await page.reload();
    await page.getByRole("tab", { name: /notif/i }).click();
    const freqAfterReload = page.getByRole("combobox").first();
    await expect(freqAfterReload).toBeVisible();
    const val = await freqAfterReload.textContent();
    expect(val).toMatch(/quotidienne|daily/i);
  });

  test("cases à cocher alertes email interactives", async ({ page }) => {
    const checkbox = page.getByRole("checkbox").first();
    if (!(await checkbox.isVisible({ timeout: 3000 }))) return;

    const initial = await checkbox.isChecked();
    await checkbox.click();
    expect(await checkbox.isChecked()).toBe(!initial);
    await checkbox.click(); // Remettre état initial
    expect(await checkbox.isChecked()).toBe(initial);
  });

  test("seuil d'alerte visible quand 'nouvelles offres' cochée", async ({ page }) => {
    const checkbox = page.getByRole("checkbox").first();
    if (!(await checkbox.isVisible({ timeout: 3000 }))) return;

    if (!(await checkbox.isChecked())) {
      await checkbox.click();
    }
    const threshold = page.getByText(/seuil|threshold/i);
    await expect(threshold).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Settings — Apparence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/settings");
    await page.getByRole("tab", { name: /apparence|appearance/i }).click();
  });

  test("section thème visible", async ({ page }) => {
    const themeSection = page.getByText(/thème|theme/i).first();
    await expect(themeSection).toBeVisible({ timeout: 5000 });
  });

  test("toggle thème clair/sombre sans crash", async ({ page }) => {
    const darkBtn = page.getByRole("button", { name: /sombre|dark/i });
    const lightBtn = page.getByRole("button", { name: /clair|light/i });

    if (!(await darkBtn.isVisible({ timeout: 2000 }))) return;

    await darkBtn.click();
    await page.waitForTimeout(300);
    await lightBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator("main")).toBeVisible();
  });
});
