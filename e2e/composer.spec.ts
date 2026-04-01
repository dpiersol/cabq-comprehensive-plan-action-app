import { expect, test } from "@playwright/test";

test.describe("Composer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".site-header h1")).toContainText(/CABQ Comprehensive Plan/i, {
      timeout: 60_000,
    });
    await expect(page.locator("#pi-0-chapter")).toBeVisible({ timeout: 30_000 });
  });

  test("selects plan hierarchy and fills action + contacts", async ({ page }) => {
    await page.locator("#pi-0-chapter").selectOption("0");
    await expect(page.locator("#pi-0-goal")).toBeVisible();
    await page.locator("#pi-0-goal").selectOption("0");
    await expect(page.locator("#pi-0-goal-detail")).toBeVisible();
    await page.locator("#pi-0-goal-detail").selectOption("0");
    await expect(page.locator("#pi-0-policy")).toBeVisible();
    await page.locator("#pi-0-policy").selectOption("0");

    await page.locator("#action-title").fill("E2E action title test");

    const editor = page.locator(".tiptap-editor-surface .ProseMirror");
    await editor.click();
    await page.keyboard.type(
      "This is a departmental action description written in the rich text editor for end-to-end testing. ",
    );

    await page.locator("#primary-contact-name").fill("Jane Planner");
    await page.locator("#primary-contact-role").fill("Planner");
    await page.locator("#primary-contact-email").fill("jane.planner@cabq.gov");
    await page.locator("#primary-contact-phone").fill("(505) 555-0100");

    await page.getByRole("button", { name: "Save to library" }).click();
    await expect(page.getByText(/Saved to library|Saved changes/i)).toBeVisible({ timeout: 10_000 });
  });

  test("department combobox opens and filters", async ({ page }) => {
    const input = page.locator("#department");
    await input.fill("Police");
    await page.locator(".department-combobox-toggle").click();
    await expect(page.locator(".department-combobox-list")).toBeVisible();
    await expect(page.locator(".department-combobox-option").first()).toBeVisible();
  });

  test("TipTap toolbar formats text", async ({ page }) => {
    await page.locator("#pi-0-chapter").selectOption("0");
    await page.locator("#pi-0-goal").selectOption("0");
    await page.locator("#pi-0-goal-detail").selectOption("0");
    await page.locator("#pi-0-policy").selectOption("0");

    const editor = page.locator(".tiptap-editor-surface .ProseMirror");
    await editor.click();
    await page.keyboard.type("Bold me");
    await page.keyboard.press("Control+a");
    await page.getByRole("toolbar", { name: "Text formatting" }).getByTitle("Bold").click();
    await expect(editor.locator("strong, b")).toContainText("Bold me");
  });
});
