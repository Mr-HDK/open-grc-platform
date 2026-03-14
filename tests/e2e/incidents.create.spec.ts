import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("contributor can create, update, and audit an incident", async ({ page }) => {
  test.setTimeout(90_000);

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

  const title = `Playwright incident ${Date.now()}`;

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/incidents/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(
    "Test incident created by Playwright to validate incident register lifecycle and audit history.",
  );
  await page.getByLabel("Occurred on").fill("2030-12-31");

  await page.getByRole("button", { name: "Create incident" }).click();

  await expect
    .poll(
      async () => {
        await page.goto(`/dashboard/incidents?q=${encodeURIComponent(title)}`);
        return page.getByRole("link", { name: title }).count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);

  const detailHref = await page.getByRole("link", { name: title }).getAttribute("href");
  expect(detailHref).toBeTruthy();
  await page.goto(detailHref!);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const auditSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Audit log" }),
  });
  await expect(auditSection.locator("li.rounded-lg")).toHaveCount(1);
  await expect(auditSection.locator("li.rounded-lg").first()).toContainText("create");

  const editHref = await page.getByRole("link", { name: "Edit" }).getAttribute("href");
  expect(editHref).toBeTruthy();
  await page.goto(editHref!);
  await expect(page).toHaveURL(/\/dashboard\/incidents\/[^/]+\/edit$/, { timeout: 20_000 });
  await page.getByLabel("Status").selectOption("investigating");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(/\/dashboard\/incidents\/[^/]+$/, { timeout: 20_000 });
  const updatedAuditSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Audit log" }),
  });
  await expect(updatedAuditSection.locator("li.rounded-lg")).toHaveCount(2);
  await expect(updatedAuditSection.locator("li.rounded-lg").first()).toContainText("update");
  await expect(updatedAuditSection).toContainText("status: investigating");
});
