import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("admin can view reporting packs and printable output", async ({ page }) => {
  test.setTimeout(60_000);

  const candidates = credentialCandidates({
    emails: [process.env.E2E_ADMIN_TEST_EMAIL, "admin@open-grc.local"],
    passwords: [process.env.E2E_ADMIN_TEST_PASSWORD, "ChangeMe123!"],
  });

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/reporting");
  await expect(page.getByRole("heading", { name: "Reporting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Report packs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Management review pack" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Printable pack" })).toBeVisible();

  await page.goto("/dashboard/reporting/print?preset=management&horizon=30");

  await expect(page.getByRole("heading", { name: "Printable reporting pack" })).toBeVisible();
  await expect(page.getByText("Management review pack")).toBeVisible();
});
