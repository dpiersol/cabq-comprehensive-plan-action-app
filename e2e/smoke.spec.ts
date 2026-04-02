import { expect, test } from "@playwright/test";

test.describe("App shell", () => {
  test("loads without runtime errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".site-header h1")).toContainText(/CABQ Comprehensive Plan/i, {
      timeout: 60_000,
    });
    expect(errors, `pageerror: ${errors.join("; ")}`).toHaveLength(0);
  });

  test("footer shows app version from build", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".site-header h1")).toBeVisible({ timeout: 60_000 });
    const footer = page.locator("footer.site-footer");
    await expect(footer).toContainText(/v\d+\.\d+\.\d+/, { timeout: 30_000 });
  });

  test("main tabs switch views", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".site-header h1")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('nav[aria-label="Main"]')).toBeVisible({ timeout: 60_000 });
    await page.locator('nav[aria-label="Main"]').getByRole("button", { name: /^Library/ }).click();
    await expect(page.getByRole("heading", { name: /Your submissions/i })).toBeVisible();
    await page.getByRole("button", { name: "Comprehensive Plan" }).click();
    await expect(page.getByRole("heading", { name: "Comprehensive Plan Items" })).toBeVisible();
  });
});
