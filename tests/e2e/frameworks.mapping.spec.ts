import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_TEST_EMAIL;
const adminPassword = process.env.E2E_ADMIN_TEST_PASSWORD;

test("admin can update framework mappings", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_TEST_EMAIL and E2E_ADMIN_TEST_PASSWORD.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail ?? "");
  await page.getByLabel("Password").fill(adminPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/frameworks");

  const controlOptions = await page.locator('#controlId option').count();
  test.skip(controlOptions === 0, "Framework mapping test requires at least one control.");

  await page.getByRole("button", { name: "Load control" }).click();

  const checkboxCount = await page.locator('input[name="requirementIds"]').count();
  test.skip(checkboxCount === 0, "Framework mapping test requires seeded requirements.");

  await page.locator('input[name="requirementIds"]').first().check();
  await page.getByRole("button", { name: "Save mappings" }).click();

  await expect(page).toHaveURL(/\/dashboard\/frameworks/);
  await expect(page.getByText("Mappings updated.")).toBeVisible();
});
