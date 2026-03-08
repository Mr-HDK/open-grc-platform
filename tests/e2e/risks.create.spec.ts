import { expect, test } from "@playwright/test";

const testEmail = process.env.E2E_RISK_TEST_EMAIL;
const testPassword = process.env.E2E_RISK_TEST_PASSWORD;

test("contributor can create a risk", async ({ page }) => {
  test.skip(!testEmail || !testPassword, "Set E2E_RISK_TEST_EMAIL and E2E_RISK_TEST_PASSWORD.");

  const title = `Playwright risk ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(testEmail ?? "");
  await page.getByLabel("Password").fill(testPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/risks/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(
    "Test risk created by Playwright to validate risk register creation flow.",
  );
  await page.getByLabel("Category").fill("Testing");
  await page.getByLabel("Impact (1-5)").fill("4");
  await page.getByLabel("Likelihood (1-5)").fill("3");
  await page.getByLabel("Due date").fill("2030-12-31");

  await page.getByRole("button", { name: "Create risk" }).click();

  await expect(page).toHaveURL(/\/dashboard\/risks\//);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});
