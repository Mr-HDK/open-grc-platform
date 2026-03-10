import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_TEST_EMAIL;
const adminPassword = process.env.E2E_ADMIN_TEST_PASSWORD;

test("admin can access notifications", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_TEST_EMAIL and E2E_ADMIN_TEST_PASSWORD.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail ?? "");
  await page.getByLabel("Password").fill(adminPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overdue actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Control reviews due soon" })).toBeVisible();
});
