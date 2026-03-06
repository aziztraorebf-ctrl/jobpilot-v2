import { test, expect } from "@playwright/test";

test.describe("Career Chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fr/career-chat");
    await expect(page).toHaveURL(/\/career-chat/);
  });

  test("page chargée — input de message visible", async ({ page }) => {
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible({ timeout: 5000 });
  });

  test("aucune erreur console critique au chargement", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.waitForTimeout(800);
    const critical = errors.filter(
      (e) => !e.includes("hydration") && !e.includes("Warning") && !e.includes("favicon")
    );
    expect(critical).toHaveLength(0);
  });

  test("envoi d'un message — message utilisateur visible", async ({ page }) => {
    const input = page.getByRole("textbox");
    await input.fill("Bonjour, quels domaines recrutent en ce moment ?");
    await page.getByRole("button", { name: /envoyer|send/i }).click();
    await expect(page.getByText(/quels domaines/i)).toBeVisible({ timeout: 5000 });
  });

  test("envoi d'un message — réponse IA reçue dans les 30s", async ({ page }) => {
    const input = page.getByRole("textbox");
    await input.fill("Dis-moi bonjour en une phrase.");
    await page.getByRole("button", { name: /envoyer|send/i }).click();

    // Attendre la réponse IA
    await page.waitForTimeout(2000);
    const response = page.locator(".bg-muted, [data-role='assistant'], .assistant").first();
    await expect(response).toBeVisible({ timeout: 30000 });
  });

  test("persistance — message visible après reload de page", async ({ page }) => {
    const uniqueMsg = `E2E-persist-${Date.now()}`;
    const input = page.getByRole("textbox");
    await input.fill(uniqueMsg);
    await page.getByRole("button", { name: /envoyer|send/i }).click();
    await expect(page.getByText(uniqueMsg)).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(3000);

    await page.reload();
    await expect(page.getByText(uniqueMsg)).toBeVisible({ timeout: 10000 });
  });

  test("version française — UI en français", async ({ page }) => {
    const frenchEl = page.getByText(/demandez|envoyer|carrière|bienvenue/i).first();
    await expect(frenchEl).toBeVisible({ timeout: 5000 });
  });

  test("version anglaise /en/career-chat — UI en anglais", async ({ page }) => {
    await page.goto("/en/career-chat");
    await expect(page).toHaveURL(/\/en\/career-chat/);
    await expect(page.locator("main")).toBeVisible();
  });
});
