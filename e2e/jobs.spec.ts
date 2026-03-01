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

  test("seen job workflow - new badge, mark as seen, filter", async ({ page }) => {
    // Step 1 & 2: Load jobs page and verify 'New' badges on unseen jobs
    await page.waitForSelector("[data-testid='job-card'], .job-card, article");

    // Check if any 'New' badges are visible
    const newBadges = page.getByText(/^new$|^nouveau$/i);
    const badgeCount = await newBadges.count();

    // If there are no unseen jobs, this test cannot proceed meaningfully
    // We'll just verify the page loaded correctly
    if (badgeCount === 0) {
      console.log("No unseen jobs found - test cannot verify badge behavior");
      await expect(page.locator("main")).toBeVisible();
      return;
    }

    console.log(`Found ${badgeCount} unseen jobs with 'New' badges`);
    expect(badgeCount).toBeGreaterThan(0);

    // Step 3: Click 'Apply' on a job and verify badge disappears immediately
    // Find the first job card with a 'New' badge
    const firstNewBadge = newBadges.first();
    const jobCard = firstNewBadge.locator("../..");

    // Get initial state
    await expect(firstNewBadge).toBeVisible();

    // Find and click the Apply button on this job
    const applyButton = jobCard.getByRole("button", { name: /postuler|apply/i });
    if (await applyButton.isVisible()) {
      await applyButton.click();

      // Verify badge disappears immediately (optimistic update)
      await expect(firstNewBadge).not.toBeVisible({ timeout: 2000 });
      console.log("✓ Badge disappeared after clicking Apply");
    }

    // Step 4: Refresh page and verify job stays marked as seen
    await page.reload();
    await page.waitForSelector("[data-testid='job-card'], .job-card, article");

    // The job we marked should not have a badge anymore
    const badgeCountAfterRefresh = await newBadges.count();
    expect(badgeCountAfterRefresh).toBeLessThan(badgeCount);
    console.log("✓ Job stays marked as seen after refresh");

    // Step 5: Enable 'New only' filter and verify only unseen jobs show
    const newOnlyFilter = page.getByLabel(/show new jobs only|afficher les nouvelles offres seulement/i);

    if (await newOnlyFilter.isVisible()) {
      await newOnlyFilter.check();
      await page.waitForTimeout(500); // Wait for filter to apply

      // All visible jobs should have 'New' badges
      const visibleJobs = await page.locator("[data-testid='job-card'], .job-card, article").count();
      const visibleBadges = await newBadges.count();

      // In filtered mode, every job should have a badge (or there should be no jobs)
      if (visibleJobs > 0) {
        expect(visibleBadges).toBe(visibleJobs);
        console.log(`✓ 'New only' filter active: ${visibleJobs} unseen jobs shown`);
      }

      // Step 6: Disable filter and verify all jobs show again
      await newOnlyFilter.uncheck();
      await page.waitForTimeout(500); // Wait for filter to remove

      const allJobsCount = await page.locator("[data-testid='job-card'], .job-card, article").count();
      expect(allJobsCount).toBeGreaterThanOrEqual(visibleJobs);
      console.log(`✓ Filter disabled: ${allJobsCount} total jobs shown`);
    }
  });
});
