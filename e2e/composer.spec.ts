import { expect, test } from "@playwright/test";
import { loginAsMockCityUser } from "./helpers/auth";

test.describe.configure({ timeout: 90_000 });

test.describe("Comprehensive Plan form", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMockCityUser(page);
    await expect(page.locator(".site-header h1")).toContainText(/CABQ Comprehensive Plan/i, {
      timeout: 60_000,
    });
    await expect(page.getByRole("heading", { name: "Comprehensive Plan Items" })).toBeVisible({
      timeout: 60_000,
    });
  });

  test("selects plan hierarchy and fills action + contacts", async ({ page }) => {
    await page.locator("#pi-0-chapter").selectOption("0");
    await expect(page.locator("#pi-0-goal")).toBeVisible();
    await page.locator("#pi-0-goal").selectOption("0");
    await expect(page.locator("#pi-0-goal-detail")).toBeVisible();
    await page.locator("#pi-0-goal-detail").selectOption("0");
    await expect(page.locator("#pi-0-policy")).toBeVisible();
    await page.locator("#pi-0-policy").selectOption("0");

    await page.locator("#legislation-title").fill("E2E legislation title test");

    const editor = page.locator(".tiptap-editor-surface .ProseMirror");
    await editor.click();
    await page.keyboard.type(
      "This is a departmental legislation description written in the rich text editor for end-to-end testing. ",
    );

    await page.locator("#how-furthers-policies").fill(
      "This text explains how the legislation furthers the selected comprehensive plan policies for E2E testing.",
    );

    await page.locator("#department").fill("Planning");

    await page.locator("#primary-contact-name").fill("Jane Planner");
    await page.locator("#primary-contact-role").fill("Planner");
    await page.locator("#primary-contact-email").fill("jane.planner@cabq.gov");
    await page.locator("#primary-contact-phone").fill("(505) 555-0100");

    await page.getByRole("button", { name: "Submit" }).last().click();
    await page.getByRole("button", { name: /^Library/ }).click();
    await expect(page.getByRole("table").getByText(/^CP-\d{6}$/)).toBeVisible({ timeout: 20_000 });
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
