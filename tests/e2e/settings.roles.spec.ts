import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_TEST_EMAIL;
const adminPassword = process.env.E2E_ADMIN_TEST_PASSWORD;

test("admin can access settings and submit role update form", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_TEST_EMAIL and E2E_ADMIN_TEST_PASSWORD.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail ?? "");
  await page.getByLabel("Password").fill(adminPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profile administration" })).toBeVisible();

  const editableForm = page.locator("tbody form").first();
  test.skip((await editableForm.count()) === 0, "Settings role update test requires at least one editable profile.");

  const selectedRole = await editableForm.locator('select[name="role"]').inputValue();
  await editableForm.locator('select[name="role"]').selectOption(selectedRole);
  await editableForm.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Role updated.")).toBeVisible();
  await expect(page.getByText("Updated role for")).toBeVisible();
});
