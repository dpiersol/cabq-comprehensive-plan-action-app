import type { Page } from "@playwright/test";

/** Uses mock Entra buttons (e2e production bundle with `VITE_E2E_MOCK_AUTH`). */
export async function loginAsMockCityUser(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Dev User Login|Mock city user/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
  /** Client-side navigation only — a full reload would drop in-memory mock auth. */
  await page.getByRole("link", { name: /^New action$/i }).click();
  await page.waitForURL(/\/app\/compose/, { timeout: 30_000 });
}
