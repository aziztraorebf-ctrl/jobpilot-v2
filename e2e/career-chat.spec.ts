import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./helpers/auth";

test.describe("Career Chat", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test("can navigate to career chat from sidebar", async ({ page }) => {
    // Click on career chat link in sidebar
    await page.getByRole("link", { name: /career chat|chat carriere/i }).click();
    await expect(page).toHaveURL(/\/career-chat/);
  });

  test("displays welcome message when no messages", async ({ page }) => {
    await page.goto("/en/career-chat");

    // Check for welcome message or empty state
    await expect(page.locator("text=/welcome|bienvenue/i").or(page.locator("text=/start a conversation|commencer une conversation/i"))).toBeVisible();
  });

  test("can send a message and receive AI response", async ({ page }) => {
    await page.goto("/en/career-chat");

    // Find the chat input
    const chatInput = page.getByPlaceholder(/ask about|demandez/i).or(page.getByRole("textbox"));
    await expect(chatInput).toBeVisible();

    // Type a test message
    await chatInput.fill("What career paths might suit someone with web development experience?");

    // Send the message
    await page.getByRole("button", { name: /send|envoyer/i }).click();

    // Verify user message appears
    await expect(page.locator("text=/What career paths/i")).toBeVisible();

    // Wait for AI response (with timeout for API call)
    await expect(page.locator("text=/typing|en train/i").or(page.locator("[role='status']"))).toBeVisible({ timeout: 2000 });

    // Wait for response to complete (AI should respond within 30 seconds)
    await expect(page.locator("text=/typing|en train/i")).toBeHidden({ timeout: 30000 });

    // Verify at least one assistant message appears
    // The response should contain some career-related content
    const messages = page.locator("[data-role='assistant'], .assistant-message, .bg-muted");
    await expect(messages.first()).toBeVisible({ timeout: 5000 });
  });

  test("displays token usage", async ({ page }) => {
    await page.goto("/en/career-chat");

    // Send a simple message
    const chatInput = page.getByPlaceholder(/ask about|demandez/i).or(page.getByRole("textbox"));
    await chatInput.fill("Hello");
    await page.getByRole("button", { name: /send|envoyer/i }).click();

    // Wait for response
    await page.waitForTimeout(5000);

    // Look for token usage display
    // This could be in various formats: "123 tokens", "Token usage: 123", etc.
    const tokenDisplay = page.locator("text=/token/i");
    await expect(tokenDisplay.first()).toBeVisible({ timeout: 35000 });
  });

  test("conversation persists on page reload", async ({ page }) => {
    await page.goto("/en/career-chat");

    // Send a unique message
    const uniqueMessage = `Test message ${Date.now()}`;
    const chatInput = page.getByPlaceholder(/ask about|demandez/i).or(page.getByRole("textbox"));
    await chatInput.fill(uniqueMessage);
    await page.getByRole("button", { name: /send|envoyer/i }).click();

    // Wait for message to be visible
    await expect(page.locator(`text=${uniqueMessage}`)).toBeVisible();

    // Wait for AI response to complete
    await page.waitForTimeout(8000);

    // Reload the page
    await page.reload();

    // Verify the message is still there
    await expect(page.locator(`text=${uniqueMessage}`)).toBeVisible({ timeout: 10000 });
  });

  test("French translation works at /fr/career-chat", async ({ page }) => {
    await page.goto("/fr/career-chat");

    // Verify page loads
    await expect(page).toHaveURL(/\/fr\/career-chat/);

    // Check for French UI elements
    // Should see French placeholder or French welcome message
    const frenchElements = page.locator("text=/demandez|bienvenue|envoyer|carrière/i");
    await expect(frenchElements.first()).toBeVisible({ timeout: 5000 });
  });

  test("complete end-to-end flow", async ({ page }) => {
    // 1. Navigate to career chat from sidebar
    await page.getByRole("link", { name: /career chat|chat carriere/i }).click();
    await expect(page).toHaveURL(/\/career-chat/);

    // 2. Send a test message about career advice
    const chatInput = page.getByPlaceholder(/ask about|demandez/i).or(page.getByRole("textbox"));
    await chatInput.fill("What skills should I develop to transition into AI engineering?");
    await page.getByRole("button", { name: /send|envoyer/i }).click();

    // 3. Verify AI response appears
    await expect(page.locator("text=/typing|en train/i")).toBeHidden({ timeout: 30000 });
    const assistantMessages = page.locator("[data-role='assistant'], .assistant-message, .bg-muted");
    await expect(assistantMessages.first()).toBeVisible();

    // 4. Verify token usage displays
    await expect(page.locator("text=/token/i").first()).toBeVisible();

    // 5. Verify conversation persists on page reload
    await page.reload();
    await expect(page.locator("text=/What skills should I develop/i")).toBeVisible({ timeout: 10000 });

    // 6. Verify French translation works
    await page.goto("/fr/career-chat");
    await expect(page.locator("text=/demandez|bienvenue|envoyer|carrière/i").first()).toBeVisible();
  });
});
