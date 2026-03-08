import { expect, test } from "@playwright/test";

const testEmail = process.env.E2E_RISK_TEST_EMAIL;
const testPassword = process.env.E2E_RISK_TEST_PASSWORD;

test("contributor can create a control", async ({ page }) => {
  test.skip(!testEmail || !testPassword, "Set E2E_RISK_TEST_EMAIL and E2E_RISK_TEST_PASSWORD.");

  const code = `PW-CTRL-${Date.now()}`;
  const title = `Playwright control ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(testEmail ?? "");
  await page.getByLabel("Password").fill(testPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/controls/new");

  const riskCount = await page.locator('input[name="riskIds"]').count();
  test.skip(riskCount === 0, "Controls creation test requires at least one risk.");

  await page.getByLabel("Code").fill(code);
  await page.getByLabel("Control type").fill("Preventive");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(
    "Test control created by Playwright to validate controls CRUD and risk mapping.",
  );
  await page.locator('input[name="riskIds"]').first().check();

  await page.getByRole("button", { name: "Create control" }).click();

  await expect(page).toHaveURL(/\/dashboard\/controls\//);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText(code)).toBeVisible();
});
