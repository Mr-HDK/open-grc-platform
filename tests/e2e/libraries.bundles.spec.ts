import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_TEST_EMAIL;
const adminPassword = process.env.E2E_ADMIN_TEST_PASSWORD;

test("admin can apply a reusable library bundle", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_TEST_EMAIL and E2E_ADMIN_TEST_PASSWORD.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail ?? "");
  await page.getByLabel("Password").fill(adminPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/libraries");
  await expect(page.getByRole("heading", { name: "Libraries" })).toBeVisible();

  const applyButtons = page.getByRole("button", { name: "Apply bundle" });
  test.skip((await applyButtons.count()) === 0, "Libraries test requires at least one configured bundle.");

  await applyButtons.first().click();

  await expect(page.getByText("Bundle applied.")).toBeVisible();
});
