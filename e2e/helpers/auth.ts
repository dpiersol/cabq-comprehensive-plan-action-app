import type { Page } from "@playwright/test";

/** Uses mock Entra buttons (e2e production bundle with `VITE_E2E_MOCK_AUTH`). */
export async function loginAsMockCityUser(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Mock city user/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}
