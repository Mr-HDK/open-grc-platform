import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("contributor can create a control", async ({ page }) => {
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

  const code = `PW-CTRL-${Date.now()}`;
  const title = `Playwright control ${Date.now()}`;

  await signInWithCandidates(page, candidates);

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

  await expect
    .poll(
      async () => {
        await page.goto(`/dashboard/controls?q=${encodeURIComponent(title)}`);
        return page.getByRole("link", { name: title }).count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
});
