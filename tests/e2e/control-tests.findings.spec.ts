import { expect, test } from "@playwright/test";

const testEmail = process.env.E2E_RISK_TEST_EMAIL;
const testPassword = process.env.E2E_RISK_TEST_PASSWORD;

test("failed control test creates finding and passing retest closes it", async ({ page }) => {
  test.skip(!testEmail || !testPassword, "Set E2E_RISK_TEST_EMAIL and E2E_RISK_TEST_PASSWORD.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(testEmail ?? "");
  await page.getByLabel("Password").fill(testPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/control-tests/new");
  await page.getByLabel("Control").selectOption({ index: 1 });
  await page.getByLabel("Test period start").fill("2030-01-01");
  await page.getByLabel("Test period end").fill("2030-01-31");
  await page.getByLabel("Result").selectOption("failed");
  await page.getByLabel("Notes").fill("E2E failed test creates a finding.");
  await page.getByRole("button", { name: "Create control test" }).click();

  await expect(page).toHaveURL(/\/dashboard\/control-tests\/[0-9a-f-]+/);
  await expect(page.getByRole("heading", { name: /^Control test$/ })).toBeVisible();

  await page.getByRole("link", { name: "Source finding" }).click();
  await expect(page).toHaveURL(/\/dashboard\/findings\/.+/);

  const findingUrl = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/open - medium/i)).toBeVisible();

  await page.getByRole("link", { name: "Record retest" }).click();
  await expect(page).toHaveURL(/\/dashboard\/control-tests\/new/);

  await page.getByLabel("Result").selectOption("passed");
  await page.getByLabel("Test period start").fill("2030-02-01");
  await page.getByLabel("Test period end").fill("2030-02-28");
  await page.getByLabel("Notes").fill("E2E retest passed.");
  await page.getByRole("button", { name: "Create control test" }).click();

  await expect(page).toHaveURL(/\/dashboard\/control-tests\/[0-9a-f-]+/);
  await expect(page.getByRole("heading", { name: /^Control test$/ })).toBeVisible();

  await page.goto(findingUrl);
  await expect(page.getByText(/closed - medium/i)).toBeVisible();
});
