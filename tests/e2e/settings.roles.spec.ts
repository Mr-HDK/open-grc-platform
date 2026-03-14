import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("admin can access settings and submit role update form", async ({ page }) => {
  const candidates = credentialCandidates({
    emails: [process.env.E2E_ADMIN_TEST_EMAIL, "admin@open-grc.local"],
    passwords: [process.env.E2E_ADMIN_TEST_PASSWORD, "ChangeMe123!"],
  });

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Profile administration" })).toBeVisible({
    timeout: 20_000,
  });

  const editableForm = page
    .locator("tbody tr")
    .filter({ has: page.locator('button:has-text("Save")') })
    .first();
  test.skip((await editableForm.count()) === 0, "Settings role update test requires at least one editable profile.");

  const selectedRole = await editableForm.locator('select[name="role"]').inputValue();
  await editableForm.locator('select[name="role"]').selectOption(selectedRole);
  await page.waitForLoadState("networkidle");
  await editableForm.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(/success=role/, { timeout: 20_000 });
  await expect(page.getByText("Role updated.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Updated role for")).toBeVisible({ timeout: 20_000 });
});
