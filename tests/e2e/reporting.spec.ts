import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_TEST_EMAIL;
const adminPassword = process.env.E2E_ADMIN_TEST_PASSWORD;

test("admin can access reporting and see import/export tools", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_TEST_EMAIL and E2E_ADMIN_TEST_PASSWORD.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail ?? "");
  await page.getByLabel("Password").fill(adminPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/reporting");
  await expect(page.getByRole("heading", { name: "Reporting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Exports" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Imports" })).toBeVisible();

  await expect(page.getByRole("link", { name: "Export CSV" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Export JSON" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Import risks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import controls" })).toBeVisible();
});
