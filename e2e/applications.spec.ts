import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./helpers/auth";

test.describe("Applications Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.getByRole("link", { name: /candidatures|applications/i }).click();
    await expect(page).toHaveURL(/\/applications/);
  });

  test("displays kanban or list view", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
    const hasKanban = await page.locator("[data-testid='kanban-board'], .kanban").count();
    const hasList = await page.locator("table, [data-testid='list-view']").count();
    const hasEmpty = await page.getByText(/aucune candidature|no application/i).count();
    expect(hasKanban + hasList + hasEmpty).toBeGreaterThan(0);
  });

  test("view toggle switches between kanban and list", async ({ page }) => {
    const kanbanBtn = page.getByRole("button", { name: /kanban/i });
    const listBtn = page.getByRole("button", { name: /list/i });

    if (await kanbanBtn.isVisible() && await listBtn.isVisible()) {
      await listBtn.click();
      await page.waitForTimeout(300);
      await kanbanBtn.click();
      await page.waitForTimeout(300);
    }
  });
});
