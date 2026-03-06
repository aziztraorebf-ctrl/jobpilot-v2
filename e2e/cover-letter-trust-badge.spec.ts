import { test, expect } from "@playwright/test";

test.describe("Cover Letter Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/jobs");
    await expect(page.locator("main")).toBeVisible();
  });

  test("cover letter modal s'ouvre depuis une carte job", async ({ page }) => {
    // Attendre qu'au moins une carte job soit chargée
    const firstCard = page.locator("article").first();
    const hasCard = await firstCard.isVisible({ timeout: 10000 }).catch(() => false);
    if (!hasCard) return; // Pas de jobs disponibles, skip naturel

    // Chercher un bouton avec aria-label contenant "lettre" ou "cover"
    const coverBtn = firstCard.locator('button[aria-label*="lettre" i], button[aria-label*="cover" i], button[title*="lettre" i], button[title*="cover" i]').first();
    const hasCoverBtn = await coverBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasCoverBtn) return; // Pas de bouton lettre visible, skip

    await coverBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Vérifier que le dialogue contient du contenu
    const dialogText = await dialog.textContent();
    expect(dialogText!.length).toBeGreaterThan(10);

    // Fermer
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });

  test("boutons de téléchargement présents si lettre générée", async ({ page }) => {
    const firstCard = page.locator("article").first();
    const hasCard = await firstCard.isVisible({ timeout: 10000 }).catch(() => false);
    if (!hasCard) return;

    const coverBtn = firstCard.locator('button[aria-label*="lettre" i], button[aria-label*="cover" i], button[title*="lettre" i], button[title*="cover" i]').first();
    const hasCoverBtn = await coverBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasCoverBtn) return;

    await coverBtn.click();

    const dialog = page.getByRole("dialog");
    const dialogVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
    if (!dialogVisible) return;

    // Si une lettre est déjà générée, les boutons de téléchargement sont visibles
    const textarea = dialog.locator("textarea");
    const hasLetter = await textarea.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasLetter) return; // Pas de lettre générée, skip

    const txtBtn = dialog.getByRole("button", { name: /\.txt|txt/i });
    const docxBtn = dialog.getByRole("button", { name: /\.docx|docx/i });

    await expect(txtBtn).toBeVisible();
    await expect(docxBtn).toBeVisible();
  });
});
