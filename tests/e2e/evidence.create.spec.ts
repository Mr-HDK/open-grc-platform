import { Buffer } from "buffer";

import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("contributor can upload evidence", async ({ page }) => {
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

  const title = `Playwright evidence ${Date.now()}`;

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/evidence/new");

  const riskCount = await page.locator('#riskId option:not([value=""])').count();
  const controlCount = await page.locator('#controlId option:not([value=""])').count();
  const actionCount = await page.locator('#actionPlanId option:not([value=""])').count();

  test.skip(
    riskCount === 0 && controlCount === 0 && actionCount === 0,
    "Evidence test requires at least one linkable risk/control/action.",
  );

  if (riskCount > 0) {
    const riskValue = await page
      .locator('#riskId option:not([value=""])')
      .first()
      .getAttribute("value");
    await page.selectOption("#riskId", riskValue ?? "");
  } else if (controlCount > 0) {
    const controlValue = await page
      .locator('#controlId option:not([value=""])')
      .first()
      .getAttribute("value");
    await page.selectOption("#controlId", controlValue ?? "");
  } else {
    const actionValue = await page
      .locator('#actionPlanId option:not([value=""])')
      .first()
      .getAttribute("value");
    await page.selectOption("#actionPlanId", actionValue ?? "");
  }

  await page.getByLabel("Title").fill(title);
  await page
    .getByLabel("Description")
    .fill("Test evidence uploaded by Playwright to validate file upload metadata flow.");

  await page.getByLabel("File").setInputFiles({
    name: `evidence-${Date.now()}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from("playwright evidence content", "utf8"),
  });

  await page.getByRole("button", { name: "Upload evidence" }).click();

  await expect
    .poll(
      async () => {
        await page.goto(`/dashboard/evidence?q=${encodeURIComponent(title)}`);
        return page.getByText(title).count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
});
