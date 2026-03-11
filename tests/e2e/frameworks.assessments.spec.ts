import { expect, test } from "@playwright/test";

const contributorEmail = process.env.E2E_CONTRIBUTOR_TEST_EMAIL || "contributor@open-grc.local";
const contributorPassword = process.env.E2E_CONTRIBUTOR_TEST_PASSWORD;

test("contributor can save framework requirement assessments", async ({ page }) => {
  test.skip(
    !contributorPassword,
    "Set E2E_CONTRIBUTOR_TEST_PASSWORD for seeded contributor account.",
  );

  await page.goto("/login");
  await page.getByLabel("Email").fill(contributorEmail);
  await page.getByLabel("Password").fill(contributorPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

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

  await expect(page).toHaveURL(/\/dashboard\/frameworks/);
  await expect(page.getByText("Assessment updated.")).toBeVisible();
  await expect(assessmentForms.first().getByLabel("Status")).toHaveValue("gap");
});
