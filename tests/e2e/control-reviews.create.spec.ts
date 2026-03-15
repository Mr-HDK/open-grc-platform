import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("contributor can create, update, and audit a control review", async ({ page }) => {
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

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/control-reviews/new");
  const controlSelect = page.getByLabel("Control");
  await controlSelect.selectOption({ index: 1 });
  const selectedControlId = await controlSelect.inputValue();
  const uniqueSeed = Date.now();
  const targetYear = 2040 + (uniqueSeed % 10);
  const targetMonth = String(((Math.floor(uniqueSeed / 10) % 12) + 1)).padStart(2, "0");
  const targetDay = String(((Math.floor(uniqueSeed / 100) % 28) + 1)).padStart(2, "0");
  const targetDate = `${targetYear}-${targetMonth}-${targetDay}`;
  await page.getByLabel("Target date").fill(targetDate);
  await page.getByLabel("Notes").fill("Playwright review test");

  await page.getByRole("button", { name: "Create review" }).click();

  await expect
    .poll(
      async () => {
        await page.goto(
          `/dashboard/control-reviews?status=scheduled&controlId=${encodeURIComponent(selectedControlId)}`,
        );
        return page.locator("tr", { hasText: targetDate }).count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);

  const detailHref = await page
    .locator("tr", { hasText: targetDate })
    .first()
    .locator("a[href^='/dashboard/control-reviews/']")
    .first()
    .getAttribute("href");
  expect(detailHref).toBeTruthy();
  await page.goto(detailHref!);
  await expect(page).toHaveURL(/\/dashboard\/control-reviews\/[^/]+$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /^Control review$/ })).toBeVisible();
  const auditSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Audit log" }),
  });
  await expect(auditSection.locator("li.rounded-lg")).toHaveCount(1);
  await expect(auditSection.locator("li.rounded-lg").first()).toContainText("create");

  const editHref = await page.getByRole("link", { name: "Edit" }).getAttribute("href");
  expect(editHref).toBeTruthy();
  await page.goto(editHref!);
  await expect(page).toHaveURL(/\/dashboard\/control-reviews\/[^/]+\/edit$/, { timeout: 20_000 });
  await page.getByLabel("Status").selectOption("completed");
  await page.getByLabel("Notes").fill("Playwright review test completed");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect
    .poll(
      async () => {
        await page.goto(detailHref!);
        const section = page.locator("section").filter({
          has: page.getByRole("heading", { name: "Audit log" }),
        });
        return section.locator("li.rounded-lg").count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(2);

  const updatedAuditSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Audit log" }),
  });
  await expect(updatedAuditSection.locator("li.rounded-lg")).toHaveCount(2);
  await expect(updatedAuditSection.locator("li.rounded-lg").first()).toContainText("update");
  await expect(updatedAuditSection).toContainText("status: completed");
});
