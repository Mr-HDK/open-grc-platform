import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("contributor can save framework requirement assessments", async ({ page }) => {
  const candidates = credentialCandidates({
    emails: [
      process.env.E2E_CONTRIBUTOR_TEST_EMAIL,
      process.env.E2E_RISK_TEST_EMAIL,
      "contributor@open-grc.local",
    ],
    passwords: [
      process.env.E2E_CONTRIBUTOR_TEST_PASSWORD,
      process.env.E2E_RISK_TEST_PASSWORD,
      "ChangeMe123!",
    ],
  });

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/frameworks");

  const assessmentForms = page.locator("form[data-assessment-form]");
  const requirementCount = await assessmentForms.count();
  test.skip(requirementCount === 0, "Assessment test requires seeded framework requirements.");

  const firstRequirementForm = assessmentForms.first();
  await firstRequirementForm.getByLabel("Status").selectOption("gap");
  await firstRequirementForm
    .getByLabel("Justification")
    .fill("Gap confirmed by walkthrough because the expected safeguard is still missing.");

  const evidenceOptions = firstRequirementForm.locator('input[name="evidenceIds"]');
  if ((await evidenceOptions.count()) > 0) {
    await evidenceOptions.first().check();
  }

  await firstRequirementForm.getByRole("button", { name: "Save assessment" }).click();

  await expect(page).toHaveURL(/\/dashboard\/frameworks/, { timeout: 20_000 });
  await expect(page.getByText("Assessment updated.")).toBeVisible({ timeout: 20_000 });
  await expect(assessmentForms.first().getByLabel("Status")).toHaveValue("gap");
});
