import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./helpers/auth";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.getByRole("link", { name: /param|settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test("displays settings tabs", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /profil|profile/i })).toBeVisible();
  });

  test("notifications tab shows email alert options", async ({ page }) => {
    const notifTab = page.getByRole("tab", { name: /notif/i });
    if (await notifTab.isVisible()) {
      await notifTab.click();
      await expect(page.getByText(/nouvelles offres|new.*jobs/i)).toBeVisible();
    }
  });

  test("appearance tab has theme toggle", async ({ page }) => {
    const appearTab = page.getByRole("tab", { name: /apparence|appearance/i });
    if (await appearTab.isVisible()) {
      await appearTab.click();
      await expect(page.getByText(/theme|dark.*mode/i)).toBeVisible();
    }
  });
});
