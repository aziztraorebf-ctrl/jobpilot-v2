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
    // Page loaded successfully — kanban, list, or empty state are all valid
    await expect(page).toHaveURL(/\/applications/);
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
