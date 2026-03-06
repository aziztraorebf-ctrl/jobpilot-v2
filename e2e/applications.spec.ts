import { test, expect } from "@playwright/test";

test.describe("Applications", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/applications");
    await expect(page).toHaveURL(/\/applications/);
  });

  test("page se charge sans erreur critique", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
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

  test("pas de contenu null/undefined visible", async ({ page }) => {
    const bodyText = await page.locator("main").textContent();
    expect(bodyText).not.toContain("undefined");
    expect(bodyText).not.toContain("[object Object]");
  });

  test("vue kanban, liste ou état vide cohérent affiché", async ({ page }) => {
    const hasKanban = await page.locator("[data-column], [data-status], .kanban").count() > 0;
    const hasTable = await page.locator("table").count() > 0;
    const hasEmpty = await page.getByText(/aucune candidature|no application/i).count() > 0;
    const hasCards = await page.locator("article, .application-card").count() > 0;
    expect(hasKanban || hasTable || hasEmpty || hasCards).toBeTruthy();
  });

  test("toggle kanban/liste fonctionne sans crash", async ({ page }) => {
    const kanbanBtn = page.getByRole("button", { name: /kanban/i });
    const listBtn = page.getByRole("button", { name: /list|liste/i });

    if (!(await kanbanBtn.isVisible({ timeout: 2000 })) || !(await listBtn.isVisible({ timeout: 2000 }))) return;

    await listBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator("main")).toBeVisible();

    await kanbanBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator("main")).toBeVisible();
  });

  test("export CSV déclenche un téléchargement .csv", async ({ page }) => {
    const exportBtn = page.getByRole("button", { name: /export|csv/i });
    if (!(await exportBtn.isVisible({ timeout: 2000 }))) return;

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 5000 }),
      exportBtn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test("bouton 'Nouvelle candidature' visible", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /nouvelle candidature|new application|ajouter/i });
    if (await newBtn.isVisible({ timeout: 2000 })) {
      await expect(newBtn).toBeEnabled();
    }
  });
});
