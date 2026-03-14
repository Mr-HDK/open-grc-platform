import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("failed control test creates finding and passing retest closes it", async ({ page }) => {
  test.setTimeout(120_000);

  const candidates = credentialCandidates({
    emails: [
      process.env.E2E_RISK_TEST_EMAIL,
      process.env.E2E_CONTRIBUTOR_TEST_EMAIL,
      "contributor@open-grc.local",
    ],
    passwords: [
      process.env.E2E_RISK_TEST_PASSWORD,
      process.env.E2E_CONTRIBUTOR_TEST_PASSWORD,
      "ChangeMe123!",
    ],
  });

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/control-tests/new");
  const controlCount = await page.locator('#controlId option:not([value=""])').count();
  const testerCount = await page.locator('#testerProfileId option:not([value=""])').count();
  test.skip(controlCount === 0, "Control test requires at least one control.");
  test.skip(testerCount === 0, "Control test requires at least one tester profile.");

  await page.getByLabel("Control").selectOption({ index: 1 });
  await page.getByLabel("Tester").selectOption({ index: 1 });
  await page.getByLabel("Test period start").fill("2030-01-01");
  await page.getByLabel("Test period end").fill("2030-01-31");
  await page.getByLabel("Result").selectOption("failed");
  await page.getByLabel("Notes").fill("E2E failed test creates a finding.");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Create control test" }).click();

  await expect(page).toHaveURL(/\/dashboard\/control-tests\/[0-9a-f-]+/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /^Control test$/ })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Source finding" }).click();
  await expect(page).toHaveURL(/\/dashboard\/findings\/.+/, { timeout: 20_000 });

  const findingUrl = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/open - medium/i)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Record retest" }).click();
  await expect(page).toHaveURL(/\/dashboard\/control-tests\/new/, { timeout: 20_000 });

  await page.getByLabel("Result").selectOption("passed");
  await page.getByLabel("Test period start").fill("2030-02-01");
  await page.getByLabel("Test period end").fill("2030-02-28");
  await page.getByLabel("Notes").fill("E2E retest passed.");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Create control test" }).click();

  await expect(page).toHaveURL(/\/dashboard\/control-tests\/[0-9a-f-]+/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /^Control test$/ })).toBeVisible({ timeout: 20_000 });

  await page.goto(findingUrl);
  await expect(page.getByText(/closed - medium/i)).toBeVisible({ timeout: 20_000 });
});
