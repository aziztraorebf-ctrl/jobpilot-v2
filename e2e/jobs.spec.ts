import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./helpers/auth";

test.describe("Jobs Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.getByRole("link", { name: /offres|jobs/i }).click();
    await expect(page).toHaveURL(/\/jobs/);
  });

  test("displays job listings", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
    const hasJobs = await page.locator("[data-testid='job-card'], .job-card, article").count();
    const hasEmpty = await page.getByText(/aucun|no.*result/i).count();
    expect(hasJobs + hasEmpty).toBeGreaterThan(0);
  });

  test("tabs switch between active and dismissed", async ({ page }) => {
    const activeTab = page.getByRole("tab", { name: /activ|active/i });
    const dismissedTab = page.getByRole("tab", { name: /rejet|dismiss/i });

    if (await activeTab.isVisible()) {
      await activeTab.click();
      await expect(activeTab).toHaveAttribute("data-state", "active");
    }

    if (await dismissedTab.isVisible()) {
      await dismissedTab.click();
      await expect(dismissedTab).toHaveAttribute("data-state", "active");
    }
  });
});
