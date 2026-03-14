import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("admin can post a risk comment", async ({ page }) => {
  const candidates = credentialCandidates({
    emails: [process.env.E2E_ADMIN_TEST_EMAIL, "admin@open-grc.local"],
    passwords: [process.env.E2E_ADMIN_TEST_PASSWORD, "ChangeMe123!"],
  });

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/risks");
  const firstRisk = page
    .getByRole("table", { name: "Risk register results" })
    .locator("tbody a")
    .first();
  const riskLinkCount = await firstRisk.count();
  test.skip(riskLinkCount === 0, "No risks available for comment test.");

  await Promise.all([
    page.waitForURL(/\/dashboard\/risks\/[0-9a-f-]+/, { timeout: 20_000 }),
    firstRisk.click(),
  ]);

  await expect(page.getByRole("heading", { name: "Comments" })).toBeVisible({ timeout: 20_000 });

  const commentBox = page.getByPlaceholder("Add a comment...");
  await commentBox.fill(`E2E comment ${Date.now()}`);
  await page.getByRole("button", { name: "Post comment" }).click();

  await expect(page.getByText("Comment posted.")).toBeVisible({ timeout: 20_000 });
});
