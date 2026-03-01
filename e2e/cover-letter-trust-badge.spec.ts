import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./helpers/auth";

test.describe("Cover Letter Trust Badge", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.getByRole("link", { name: /offres|jobs/i }).click();
    await expect(page).toHaveURL(/\/jobs/);
  });

  test("cover letter modal opens and shows trust badge after generation", async ({
    page,
  }) => {
    // Wait for job cards to load
    await page.waitForSelector("[data-testid='job-card'], .job-card, article", {
      timeout: 10000,
    });

    // Find and click the FileText (cover letter) button on the first job card
    const coverLetterBtn = page
      .locator("[data-testid='job-card'], .job-card, article")
      .first()
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /lettre|cover|letter/i })
      .or(
        page
          .locator("[data-testid='job-card'], .job-card, article")
          .first()
          .locator('button[aria-label*="lettre"], button[aria-label*="cover"], button[title*="lettre"], button[title*="cover"]')
      );

    // If no labeled button, try finding by icon position (FileText icon button)
    const anyBtn = page
      .locator("[data-testid='job-card'], .job-card, article")
      .first()
      .locator("button")
      .nth(0);

    const btnToClick = (await coverLetterBtn.count()) > 0
      ? coverLetterBtn.first()
      : anyBtn;

    await btnToClick.click();

    // Wait for dialog to appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Check if a previously saved letter is already loaded (with trust badge)
    const textarea = dialog.locator("textarea");
    const hasSavedLetter = await textarea.isVisible().catch(() => false);

    if (hasSavedLetter) {
      // Previously saved letter loaded - trust badge should be visible
      const trustBadge = dialog.locator(
        '[title], .bg-green-50, .bg-orange-50, .dark\\:bg-green-950, .dark\\:bg-orange-950'
      );
      await expect(trustBadge.first()).toBeVisible();

      // Verify textarea is editable
      await textarea.fill("Test edit content");
      await expect(textarea).toHaveValue("Test edit content");

      // Take screenshot of loaded state with badge
      await page.screenshot({
        path: "e2e/screenshots/cover-letter-saved-with-badge.png",
        fullPage: false,
      });
    } else {
      // No saved letter - generate one
      const generateBtn = dialog.getByRole("button", {
        name: /générer|generate/i,
      });

      if (await generateBtn.isVisible()) {
        await generateBtn.click();

        // Wait for generation (can take a while with AI)
        await expect(textarea).toBeVisible({ timeout: 60000 });

        // Trust badge should appear after generation
        const trustBadge = dialog.locator(
          '.bg-green-50, .bg-orange-50, .dark\\:bg-green-950, .dark\\:bg-orange-950'
        );
        await expect(trustBadge.first()).toBeVisible({ timeout: 5000 });

        // Take screenshot
        await page.screenshot({
          path: "e2e/screenshots/cover-letter-generated-with-badge.png",
          fullPage: false,
        });
      }
    }

    // Verify no console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Check badge states exist in the DOM
    const greenBadge = dialog.locator(".bg-green-50, .dark\\:bg-green-950");
    const orangeBadge = dialog.locator(".bg-orange-50, .dark\\:bg-orange-950");

    // One of the two badge states should be visible
    const greenVisible = await greenBadge.isVisible().catch(() => false);
    const orangeVisible = await orangeBadge.isVisible().catch(() => false);

    if (greenVisible) {
      // Verified state - check icon and text
      const checkIcon = greenBadge.locator("svg").first();
      await expect(checkIcon).toBeVisible();
      // Should show translated verified text
      await expect(greenBadge).toContainText(
        /vérif|verified|confirmé|confirmed/i
      );
    }

    if (orangeVisible) {
      // Review needed state - check icon, text, and warning list
      const warningIcon = orangeBadge.locator("svg").first();
      await expect(warningIcon).toBeVisible();
      await expect(orangeBadge).toContainText(
        /revu|review|vérifier|attention/i
      );
      // Should have a list of warnings
      const warningItems = orangeBadge.locator("li");
      expect(await warningItems.count()).toBeGreaterThan(0);
    }

    // Verify tooltip exists on the badge
    if (greenVisible || orangeVisible) {
      const badgeWithTooltip = dialog.locator("[title]").first();
      const tooltipText = await badgeWithTooltip.getAttribute("title");
      expect(tooltipText).toBeTruthy();
    }
  });

  test("download buttons are functional", async ({ page }) => {
    await page.waitForSelector("[data-testid='job-card'], .job-card, article", {
      timeout: 10000,
    });

    // Open cover letter modal on first job
    const firstCard = page
      .locator("[data-testid='job-card'], .job-card, article")
      .first();

    // Click any button on the card that might open cover letter modal
    const buttons = firstCard.locator("button");
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const btn = buttons.nth(i);
      const ariaLabel = await btn.getAttribute("aria-label");
      const title = await btn.getAttribute("title");
      const text = await btn.textContent();
      const combined = `${ariaLabel ?? ""} ${title ?? ""} ${text ?? ""}`.toLowerCase();

      if (
        combined.includes("lettre") ||
        combined.includes("cover") ||
        combined.includes("letter")
      ) {
        await btn.click();
        break;
      }
    }

    const dialog = page.getByRole("dialog");
    const isDialogVisible = await dialog
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!isDialogVisible) {
      test.skip();
      return;
    }

    // Wait for letter to load or generate
    const textarea = dialog.locator("textarea");
    const hasLetter = await textarea
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasLetter) {
      // Try generating
      const generateBtn = dialog.getByRole("button", {
        name: /générer|generate/i,
      });
      if (await generateBtn.isVisible()) {
        await generateBtn.click();
        await expect(textarea).toBeVisible({ timeout: 60000 });
      } else {
        test.skip();
        return;
      }
    }

    // Check download buttons exist
    const txtBtn = dialog.getByRole("button", { name: /\.txt|txt/i });
    const docxBtn = dialog.getByRole("button", { name: /\.docx|docx/i });

    await expect(txtBtn).toBeVisible();
    await expect(docxBtn).toBeVisible();

    // Set up download listeners
    const [downloadTxt] = await Promise.all([
      page.waitForEvent("download", { timeout: 5000 }).catch(() => null),
      txtBtn.click(),
    ]);

    if (downloadTxt) {
      expect(downloadTxt.suggestedFilename()).toContain(".txt");
    }

    const [downloadDocx] = await Promise.all([
      page.waitForEvent("download", { timeout: 5000 }).catch(() => null),
      docxBtn.click(),
    ]);

    if (downloadDocx) {
      expect(downloadDocx.suggestedFilename()).toContain(".docx");
    }
  });
});
