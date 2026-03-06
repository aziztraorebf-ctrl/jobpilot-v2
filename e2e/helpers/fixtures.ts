import { test as base, expect, type Page } from "@playwright/test";

export { expect };
export const test = base;

export async function waitForJobs(page: Page) {
  await page.waitForSelector("article", { timeout: 10000 });
}

export async function navigateTo(page: Page, name: RegExp) {
  await page.getByRole("link", { name }).click();
}
