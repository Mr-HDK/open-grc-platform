import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_TEST_EMAIL;
const adminPassword = process.env.E2E_ADMIN_TEST_PASSWORD;

test("admin sees lifecycle controls", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_TEST_EMAIL and E2E_ADMIN_TEST_PASSWORD.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail ?? "");
  await page.getByLabel("Password").fill(adminPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "Organization" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "User lifecycle" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profile administration" })).toBeVisible();

  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.locator("#invite-role")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send invite" })).toBeVisible();
});
