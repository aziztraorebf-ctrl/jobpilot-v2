import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./helpers/auth";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test("sidebar links navigate to correct pages", async ({ page }) => {
    await page.getByRole("link", { name: /offres|jobs/i }).click();
    await expect(page).toHaveURL(/\/jobs/);

    await page.getByRole("link", { name: /candidatures|applications/i }).click();
    await expect(page).toHaveURL(/\/applications/);

    await page.getByRole("link", { name: /param|settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);

    await page.getByRole("link", { name: /tableau|dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("dashboard displays stats cards", async ({ page }) => {
    await expect(page.locator("[data-testid='stats-cards'], .grid")).toBeVisible();
  });
});
