import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("admin can update framework mappings", async ({ page }) => {
  const candidates = credentialCandidates({
    emails: [process.env.E2E_ADMIN_TEST_EMAIL, "admin@open-grc.local"],
    passwords: [process.env.E2E_ADMIN_TEST_PASSWORD, "ChangeMe123!"],
  });

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/frameworks");

  const controlOptions = await page.locator('#controlId option').count();
  test.skip(controlOptions === 0, "Framework mapping test requires at least one control.");

  await page.getByRole("button", { name: "Load control" }).click();

  const checkboxCount = await page.locator('input[name="requirementIds"]').count();
  test.skip(checkboxCount === 0, "Framework mapping test requires seeded requirements.");

  await page.locator('input[name="requirementIds"]').first().check();
  await page.getByRole("button", { name: "Save mappings" }).click();

  await expect(page).toHaveURL(/\/dashboard\/frameworks/, { timeout: 20_000 });
  await expect(page.getByText("Mappings updated.")).toBeVisible({ timeout: 20_000 });
});
