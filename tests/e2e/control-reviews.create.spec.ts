import { expect, test } from "@playwright/test";

const testEmail = process.env.E2E_RISK_TEST_EMAIL;
const testPassword = process.env.E2E_RISK_TEST_PASSWORD;

test("contributor can create a control review", async ({ page }) => {
  test.skip(!testEmail || !testPassword, "Set E2E_RISK_TEST_EMAIL and E2E_RISK_TEST_PASSWORD.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(testEmail ?? "");
  await page.getByLabel("Password").fill(testPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/control-reviews/new");
  const controlSelect = page.getByLabel("Control");
  await controlSelect.selectOption({ index: 1 });
  await page.getByLabel("Target date").fill("2030-12-31");
  await page.getByLabel("Notes").fill("Playwright review test");

  await page.getByRole("button", { name: "Create review" }).click();

  await expect(page.getByRole("heading", { name: "Control review" })).toBeVisible();
});
