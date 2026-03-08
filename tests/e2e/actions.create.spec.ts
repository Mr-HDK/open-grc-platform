import { expect, test } from "@playwright/test";

const testEmail = process.env.E2E_RISK_TEST_EMAIL;
const testPassword = process.env.E2E_RISK_TEST_PASSWORD;

test("contributor can create an action plan", async ({ page }) => {
  test.skip(!testEmail || !testPassword, "Set E2E_RISK_TEST_EMAIL and E2E_RISK_TEST_PASSWORD.");

  const title = `Playwright action ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(testEmail ?? "");
  await page.getByLabel("Password").fill(testPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/actions/new");

  const riskCount = await page.locator('#riskId option:not([value=""])').count();
  const controlCount = await page.locator('#controlId option:not([value=""])').count();

  test.skip(
    riskCount === 0 && controlCount === 0,
    "Action plan test requires at least one risk or one control.",
  );

  if (riskCount > 0) {
    const riskValue = await page
      .locator('#riskId option:not([value=""])')
      .first()
      .getAttribute("value");

    await page.selectOption("#riskId", riskValue ?? "");
  } else {
    const controlValue = await page
      .locator('#controlId option:not([value=""])')
      .first()
      .getAttribute("value");

    await page.selectOption("#controlId", controlValue ?? "");
  }

  await page.getByLabel("Title").fill(title);
  await page
    .getByLabel("Description")
    .fill("Test action plan created by Playwright to validate remediation tracking flow.");
  await page.getByLabel("Target date").fill("2030-12-31");

  await page.getByRole("button", { name: "Create action plan" }).click();

  await expect
    .poll(
      async () => {
        await page.goto(`/dashboard/actions?q=${encodeURIComponent(title)}`);
        return page.getByRole("link", { name: title }).count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
});
