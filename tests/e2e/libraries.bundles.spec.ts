import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("admin can apply a reusable library bundle", async ({ page }) => {
  const candidates = credentialCandidates({
    emails: [process.env.E2E_ADMIN_TEST_EMAIL, "admin@open-grc.local"],
    passwords: [process.env.E2E_ADMIN_TEST_PASSWORD, "ChangeMe123!"],
  });

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/libraries");
  await expect(page.getByRole("heading", { name: "Libraries" })).toBeVisible({ timeout: 20_000 });

  const applyButtons = page.getByRole("button", { name: "Apply bundle" });
  test.skip((await applyButtons.count()) === 0, "Libraries test requires at least one configured bundle.");

  await applyButtons.first().click();

  await expect(page).toHaveURL(/success=bundle_applied/, { timeout: 20_000 });
  await expect(page.getByText("Bundle applied.")).toBeVisible({ timeout: 20_000 });
});
