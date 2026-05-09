import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("list search accepts PostgREST grammar characters", async ({ page }) => {
  const candidates = credentialCandidates({
    emails: [process.env.E2E_ADMIN_TEST_EMAIL, "admin@open-grc.local"],
    passwords: [process.env.E2E_ADMIN_TEST_PASSWORD, "ChangeMe123!"],
  });
  const query = encodeURIComponent('owner, (critical) "100%"');

  await signInWithCandidates(page, candidates);

  await page.goto(`/dashboard/controls?q=${query}`);
  await expect(
    page.getByRole("heading", { name: "Controls catalog" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.goto(`/dashboard/third-parties?q=${query}`);
  await expect(
    page.getByRole("heading", { name: "Third-party risk" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
