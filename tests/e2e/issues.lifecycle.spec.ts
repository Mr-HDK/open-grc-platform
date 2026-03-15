import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("contributor can raise, update, and filter issues from finding context", async ({ page }) => {
  test.setTimeout(120_000);

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
  const issueTitle = `Playwright issue ${Date.now()}`;

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/findings");
  const findingLinks = page.locator(
    "a[href^='/dashboard/findings/']:not([href='/dashboard/findings/new'])",
  );
  const findingCount = await findingLinks.count();
  test.skip(findingCount === 0, "Issue lifecycle test requires at least one finding.");

  await findingLinks.first().click();
  await expect(page).toHaveURL(/\/dashboard\/findings\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Raise issue" })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Raise issue" }).click();
  await expect(page).toHaveURL(/\/dashboard\/issues\/new\?/, { timeout: 20_000 });

  await page.getByLabel("Title").fill(issueTitle);
  await page
    .getByLabel("Description")
    .fill("Playwright issue created from finding detail to validate unified issue lifecycle coverage.");
  await page.getByLabel("Severity").selectOption("high");
  await page.getByLabel("Due date").fill("2020-01-15");
  await page.getByLabel("Root cause").fill("Exception handling remains fragmented across remediation trackers.");
  await page.getByLabel("Management response").fill("Track and close this exception through the unified issue register.");

  await page.getByRole("button", { name: "Create issue" }).click();

  await expect(page).toHaveURL(/\/dashboard\/issues\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: issueTitle })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Source finding" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Overdue by \d+ day\(s\)\./i)).toBeVisible({ timeout: 20_000 });

  const auditSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Audit log" }),
  });
  await expect(auditSection.locator("li.rounded-lg")).toHaveCount(1);
  await expect(auditSection.locator("li.rounded-lg").first()).toContainText("create");

  const editHref = await page.getByRole("link", { name: "Edit" }).getAttribute("href");
  expect(editHref).toBeTruthy();
  await page.goto(editHref!);
  await expect(page).toHaveURL(/\/dashboard\/issues\/[0-9a-f-]+\/edit$/, { timeout: 20_000 });
  await page.getByLabel("Status").selectOption("in_progress");
  await page
    .getByLabel("Management response")
    .fill("Issue triaged and assigned to the control owner for remediation evidence collection.");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(/\/dashboard\/issues\/[0-9a-f-]+$/, { timeout: 20_000 });
  const updatedAuditSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Audit log" }),
  });
  await expect(updatedAuditSection.locator("li.rounded-lg")).toHaveCount(2);
  await expect(updatedAuditSection.locator("li.rounded-lg").first()).toContainText("update");
  await expect(updatedAuditSection).toContainText("status: in_progress");

  await page.goto("/dashboard/issues?issueType=audit_finding&status=in_progress&overdue=true");
  await expect(page.getByRole("link", { name: issueTitle })).toBeVisible({ timeout: 20_000 });
});
