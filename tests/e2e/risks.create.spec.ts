import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("contributor can create a risk", async ({ page }) => {
  const candidates = credentialCandidates({
    emails: [
      process.env.E2E_RISK_TEST_EMAIL,
      process.env.E2E_CONTRIBUTOR_TEST_EMAIL,
      "contributor@open-grc.local",
    ],
    passwords: [
      process.env.E2E_RISK_TEST_PASSWORD,
      process.env.E2E_CONTRIBUTOR_TEST_PASSWORD,
      "ChangeMe123!",
    ],
  });

  const title = `Playwright risk ${Date.now()}`;

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/risks/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(
    "Test risk created by Playwright to validate risk register creation flow.",
  );
  await page.getByLabel("Category").fill("Testing");
  await page.getByLabel("Impact (1-5)").fill("4");
  await page.getByLabel("Likelihood (1-5)").fill("3");
  await page.getByLabel("Due date").fill("2030-12-31");

  await page.getByRole("button", { name: "Create risk" }).click();

  await expect
    .poll(
      async () => {
        await page.goto(`/dashboard/risks?q=${encodeURIComponent(title)}`);
        return page.getByRole("link", { name: title }).count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
});
