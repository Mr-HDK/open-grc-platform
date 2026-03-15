import { expect, type Page, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

async function selectOptionContainingOrFirst(page: Page, selector: string, text: string) {
  const option = await page.locator(`${selector} option`).evaluateAll((options, searchText) => {
    const candidates = options
      .map((option) => {
        const candidate = option as HTMLOptionElement;
        return {
          value: candidate.value,
          label: (candidate.textContent ?? "").trim(),
        };
      })
      .filter((candidate) => candidate.value.length > 0);

    return candidates.find((candidate) => candidate.label.includes(String(searchText))) ?? candidates[0] ?? null;
  }, text);

  expect(option, `Could not find any selectable option for selector ${selector}.`).toBeTruthy();
  await page.locator(selector).selectOption(option!.value);
  return option!;
}

async function selectOptionContaining(page: Page, selector: string, text: string) {
  const option = await page.locator(`${selector} option`).evaluateAll((options, searchText) => {
    const match = options.find((option) => {
      const candidate = option as HTMLOptionElement;
      return candidate.value.length > 0 && (candidate.textContent ?? "").includes(String(searchText));
    }) as HTMLOptionElement | undefined;

    return match
      ? {
          value: match.value,
          label: (match.textContent ?? "").trim(),
        }
      : null;
  }, text);

  expect(option, `Could not find option containing "${text}" for selector ${selector}.`).toBeTruthy();
  await page.locator(selector).selectOption(option!.value);
  return option!;
}

async function checkCheckboxContainingOrFirst(page: Page, name: string, text: string) {
  const labels = page.locator(`label:has(input[name="${name}"])`);
  const count = await labels.count();
  expect(count, `Expected at least one checkbox for ${name}.`).toBeGreaterThan(0);

  let index = 0;
  for (let currentIndex = 0; currentIndex < count; currentIndex += 1) {
    const currentLabel = labels.nth(currentIndex);
    const title = ((await currentLabel.locator(".font-medium").first().textContent()) ?? "").trim();
    if (title.includes(text)) {
      index = currentIndex;
      break;
    }
  }

  const label = labels.nth(index);
  await expect(label).toBeVisible();
  await label.locator('input[type="checkbox"]').check();
  const title = ((await label.locator(".font-medium").first().textContent()) ?? "").trim();
  return title;
}

function sectionByHeading(page: Page, title: string) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: title }),
  });
}

test("manager can plan, execute, and filter an audit engagement lifecycle", async ({ page }) => {
  test.setTimeout(150_000);

  const planTitle = `Playwright audit plan ${Date.now()}`;
  const planItemTopic = `Playwright audit topic ${Date.now()}`;
  const engagementTitle = `Playwright audit engagement ${Date.now()}`;
  const workpaperTitle = `Playwright workpaper ${Date.now()}`;

  const candidates = credentialCandidates({
    emails: [process.env.E2E_ADMIN_TEST_EMAIL, "manager@open-grc.local", "admin@open-grc.local"],
    passwords: [process.env.E2E_ADMIN_TEST_PASSWORD, "ChangeMe123!"],
  });

  const session = await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/audits/plans/new");
  await page.getByLabel("Plan title").fill(planTitle);
  await page.getByLabel("Plan year").fill("2031");
  await page.getByLabel("Cycle").selectOption("annual");
  await page.getByLabel("Status").selectOption("approved");
  const ownerOption = await selectOptionContainingOrFirst(page, "#ownerProfileId", session.email);
  await page.getByLabel("Summary").fill("Playwright-created internal audit plan for audit lifecycle coverage.");
  await page.getByRole("button", { name: "Create plan" }).click();

  await expect(page).toHaveURL(/\/dashboard\/audits\/plans\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: planTitle })).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("Topic").fill(planItemTopic);
  await selectOptionContainingOrFirst(page, "#auditableEntityId", "Identity & Access Management");
  await selectOptionContainingOrFirst(page, "#riskId", "No MFA for legacy VPN users");
  await page.locator('#status[name="status"]').selectOption("planned");
  await page.getByLabel("Notes").fill("Playwright-created plan item linked to seeded entity and risk.");
  await page.getByRole("button", { name: "Add item" }).click();

  const itemCard = page.locator("li.rounded-lg").filter({ has: page.getByText(planItemTopic) }).first();
  await expect(itemCard).toBeVisible({ timeout: 20_000 });
  const startEngagementHref = await itemCard.getByRole("link", { name: "Start engagement" }).getAttribute("href");
  expect(startEngagementHref).toBeTruthy();

  await page.goto(startEngagementHref!);
  await expect(page).toHaveURL(/\/dashboard\/audits\/engagements\/new/, { timeout: 20_000 });
  await page.getByLabel("Engagement title").fill(engagementTitle);
  await expect(page.locator("#auditPlanItemId")).not.toHaveValue("");
  const leadAuditorOption = await selectOptionContainingOrFirst(page, "#leadAuditorProfileId", session.email);
  await page.getByLabel("Status").selectOption("planned");
  await page.getByLabel("Planned start").fill("2031-02-03");
  await page.getByLabel("Planned end").fill("2031-02-14");
  await page.getByLabel("Scope").fill("Review VPN MFA exception inventory, approvals, and active remediation evidence.");
  await page.getByLabel("Objectives").fill("Confirm exceptions are approved, time-bound, and linked to remediation.");
  await page.getByLabel("Summary").fill("Playwright engagement created for audit module coverage.");
  const findingTitle = await checkCheckboxContainingOrFirst(
    page,
    "findingIds",
    "Seed finding - Legacy VPN MFA exceptions remain active",
  );
  const actionPlanTitle = await checkCheckboxContainingOrFirst(
    page,
    "actionPlanIds",
    "Enforce MFA on remaining legacy VPN accounts",
  );
  await page.waitForLoadState("networkidle");
  await Promise.all([
    page.waitForURL(/\/dashboard\/audits\/engagements\/[0-9a-f-]+$/, { timeout: 45_000 }),
    page.getByRole("button", { name: "Create engagement" }).click(),
  ]);

  await expect(page).toHaveURL(/\/dashboard\/audits\/engagements\/[0-9a-f-]+$/, { timeout: 45_000 });
  await expect(page.getByRole("heading", { name: engagementTitle })).toBeVisible({ timeout: 20_000 });
  await expect(sectionByHeading(page, "Scope")).toContainText("Review VPN MFA exception inventory");
  await expect(sectionByHeading(page, "Linked findings")).toContainText(findingTitle);
  await expect(sectionByHeading(page, "Remediation actions")).toContainText(actionPlanTitle);

  const editHref = await page.getByRole("link", { name: "Edit" }).getAttribute("href");
  expect(editHref).toBeTruthy();
  await page.goto(editHref!);
  await expect(page).toHaveURL(/\/dashboard\/audits\/engagements\/[0-9a-f-]+\/edit$/, { timeout: 20_000 });
  await page.getByLabel("Status").selectOption("completed");
  await page.getByLabel("Actual start").fill("2031-02-04");
  await page.getByLabel("Actual end").fill("2031-02-12");
  await page.getByLabel("Summary").fill("Playwright engagement updated after fieldwork completion.");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(/\/dashboard\/audits\/engagements\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByText("2031-02-04 to 2031-02-12")).toBeVisible({ timeout: 20_000 });

  const workpapersSection = sectionByHeading(page, "Workpapers");
  await page.getByLabel("Workpaper title").fill(workpaperTitle);
  await page.getByLabel("Procedure").fill("Inspect exception records, approvals, and evidence linked to MFA rollout.");
  await page.getByLabel("Conclusion").fill("Remaining exceptions are visible and tied to active remediation.");
  await selectOptionContainingOrFirst(page, "#reviewerProfileId", session.email);
  const evidenceOption = await selectOptionContainingOrFirst(page, "#evidenceId", "Quarterly vulnerability report");
  await page.getByRole("button", { name: "Add workpaper" }).click();

  await expect(workpapersSection).toContainText(workpaperTitle, { timeout: 20_000 });
  await expect(workpapersSection).toContainText(evidenceOption.label);

  const auditSection = sectionByHeading(page, "Audit log");
  await expect(auditSection.locator("li.rounded-lg")).toHaveCount(2);
  await expect(auditSection.locator("li.rounded-lg").first()).toContainText("update");

  await page.goto("/dashboard/audits");
  await page.locator('select[name="planStatus"]').selectOption("approved");
  await page.locator('select[name="planOwner"]').selectOption(ownerOption.value);
  await page.locator('select[name="planYear"]').selectOption("2031");
  await page.locator('select[name="planCycle"]').selectOption("annual");
  await page.getByRole("button", { name: "Apply plan filters" }).click();
  await expect(page.getByRole("link", { name: planTitle })).toBeVisible({ timeout: 20_000 });

  await page.locator('select[name="engagementStatus"]').selectOption("completed");
  await page.locator('select[name="leadAuditor"]').selectOption(leadAuditorOption.value);
  await page.locator('select[name="engagementYear"]').selectOption("2031");
  await page.locator('select[name="engagementCycle"]').selectOption("annual");
  await page.getByRole("button", { name: "Apply engagement filters" }).click();
  await expect(page.getByRole("link", { name: engagementTitle })).toBeVisible({ timeout: 20_000 });
});
