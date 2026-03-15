import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("manager can create, publish, and acknowledge a policy", async ({ page }) => {
  test.setTimeout(120_000);
  const managerCandidates = credentialCandidates({
    emails: [process.env.E2E_MANAGER_TEST_EMAIL, "manager@open-grc.local"],
    passwords: [process.env.E2E_MANAGER_TEST_PASSWORD, process.env.E2E_RISK_TEST_PASSWORD, "ChangeMe123!"],
  });

  const policyTitle = `Playwright policy ${Date.now()}`;

  await signInWithCandidates(page, managerCandidates);

  await page.goto("/dashboard/policies/new");
  await page.getByLabel("Title").fill(policyTitle);
  await page.getByLabel("Version").fill("1.0");
  await page.getByLabel("Effective date").fill("2031-01-31");
  await page.getByLabel("Next review date").fill("2032-01-31");
  await page.getByLabel("Content").fill("Policy attestation test content.");
  await page.getByRole("button", { name: "Create policy" }).click();

  await expect(page).toHaveURL(/\/dashboard\/policies\/[0-9a-f-]+/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: policyTitle })).toBeVisible();

  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL(/success=in_review/, { timeout: 20_000 });

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(/success=approved/, { timeout: 20_000 });

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/success=published/, { timeout: 20_000 });

  const campaignName = `Playwright policy campaign ${Date.now()}`;
  await page.locator('input[name="name"]').fill(campaignName);
  await page.locator('input[name="dueDate"]').fill("2031-03-15");
  await page.locator('select[name="audienceType"]').selectOption("role");
  await page.locator('select[name="audienceRole"]').selectOption("manager");
  await page.getByRole("button", { name: "Launch campaign" }).click();
  await expect(page).toHaveURL(/success=campaign_created/, { timeout: 20_000 });
  await expect(page.getByText(campaignName)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Acknowledge policy" }).click();
  await expect(page).toHaveURL(/success=acknowledged/, { timeout: 20_000 });
  await expect(page.getByText(/acknowledged/i)).toBeVisible({ timeout: 20_000 });
});

test("viewer cannot access policy creation page", async ({ page }) => {
  const viewerCandidates = credentialCandidates({
    emails: [process.env.E2E_VIEWER_TEST_EMAIL, "viewer@open-grc.local"],
    passwords: [
      process.env.E2E_VIEWER_TEST_PASSWORD,
      process.env.E2E_CONTRIBUTOR_TEST_PASSWORD,
      process.env.E2E_RISK_TEST_PASSWORD,
      "ChangeMe123!",
    ],
  });

  await signInWithCandidates(page, viewerCandidates);
  await page.goto("/dashboard/policies/new");

  await expect(page).toHaveURL(/\/dashboard\?error=forbidden/, { timeout: 20_000 });
});
