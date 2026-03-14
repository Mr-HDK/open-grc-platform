import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("contributor can create an action plan", async ({ page }) => {
  const title = `Playwright action ${Date.now()}`;
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
