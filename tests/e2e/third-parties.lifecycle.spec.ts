import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("contributor can create and review a third-party", async ({ page }) => {
  test.setTimeout(90_000);

  const vendorName = `Playwright vendor ${Date.now()}`;
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

  await page.goto("/dashboard/third-parties/new");
  await page.getByRole("textbox", { name: "Vendor" }).fill(vendorName);
  await page.getByRole("textbox", { name: "Service" }).fill("Identity provider");
  await page.getByLabel("Criticality").selectOption("high");
  await page.getByLabel("Assessment status").selectOption("monitoring");
  await page.getByLabel("Assessment score (0-100)").fill("65");
  await page.getByLabel("Next review date").fill("2031-01-31");

  const riskOptions = page.locator('input[name="riskIds"]');
  if ((await riskOptions.count()) > 0) {
    await riskOptions.first().check();
  }

  const controlOptions = page.locator('input[name="controlIds"]');
  if ((await controlOptions.count()) > 0) {
    await controlOptions.first().check();
  }

  const actionOptions = page.locator('input[name="actionPlanIds"]');
  if ((await actionOptions.count()) > 0) {
    await actionOptions.first().check();
  }

  await page.getByRole("button", { name: "Create third-party" }).click();

  await expect(page).toHaveURL(/\/dashboard\/third-parties\/[0-9a-f-]+/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: vendorName })).toBeVisible();

  await page.getByLabel("Assessment score").fill("72");
  await page.getByLabel("Review notes").fill("Quarterly review completed with no blocking issues.");
  await page.getByRole("button", { name: "Log review" }).click();

  await expect(page).toHaveURL(/success=review_created/, { timeout: 20_000 });
  await expect(page.getByText("Review logged successfully.")).toBeVisible({ timeout: 20_000 });
});
