import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("manager can create and revoke a risk acceptance", async ({ page }) => {
  const candidates = credentialCandidates({
    emails: [process.env.E2E_MANAGER_TEST_EMAIL, "manager@open-grc.local"],
    passwords: [process.env.E2E_MANAGER_TEST_PASSWORD, process.env.E2E_RISK_TEST_PASSWORD, "ChangeMe123!"],
  });

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/risk-acceptances/new");
  const riskCount = await page.locator('#riskId option:not([value=""])').count();
  const approverCount = await page.locator('#approvedByProfileId option:not([value=""])').count();
  test.skip(riskCount === 0, "Risk acceptance test requires at least one risk.");
  test.skip(approverCount === 0, "Risk acceptance test requires at least one approver.");

  await page.getByLabel("Risk").selectOption({ index: 1 });
  await page.getByLabel("Approver").selectOption({ index: 1 });
  await page.getByLabel("Expiration date").fill("2031-12-31");
  await page
    .getByLabel("Justification")
    .fill("Temporary acceptance approved while remediation is planned and funded.");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Create acceptance" }).click();

  await expect(page).toHaveURL(/\/dashboard\/risk-acceptances\/[0-9a-f-]+/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /^Risk acceptance$/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/^active$/i)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText(/^revoked$/i)).toBeVisible({ timeout: 20_000 });
});
