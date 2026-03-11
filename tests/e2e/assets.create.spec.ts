import { expect, test } from "@playwright/test";

const testEmail = process.env.E2E_RISK_TEST_EMAIL;
const testPassword = process.env.E2E_RISK_TEST_PASSWORD;

test("contributor can create an asset", async ({ page }) => {
  test.skip(!testEmail || !testPassword, "Set E2E_RISK_TEST_EMAIL and E2E_RISK_TEST_PASSWORD.");

  const name = `Playwright asset ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(testEmail ?? "");
  await page.getByLabel("Password").fill(testPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/assets/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Type").fill("Application");
  await page.getByLabel("Criticality").selectOption("high");
  await page
    .getByLabel("Description")
    .fill("Playwright asset registration test validating asset register create flow.");

  const riskOptions = page.locator('input[name="riskIds"]');
  if ((await riskOptions.count()) > 0) {
    await riskOptions.first().check();
  }

  const controlOptions = page.locator('input[name="controlIds"]');
  if ((await controlOptions.count()) > 0) {
    await controlOptions.first().check();
  }

  await page.getByRole("button", { name: "Create asset" }).click();

  await expect
    .poll(
      async () => {
        await page.goto(`/dashboard/assets?q=${encodeURIComponent(name)}`);
        return page.getByRole("link", { name }).count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
});
