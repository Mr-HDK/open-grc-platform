import { expect, type Page, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

async function selectOptionContainingOrFirst(
  page: Page,
  selector: string,
  text: string,
) {
  const option = await page
    .locator(`${selector} option`)
    .evaluateAll((options, searchText) => {
      const candidates = options
        .map((option) => {
          const candidate = option as HTMLOptionElement;
          return {
            value: candidate.value,
            label: (candidate.textContent ?? "").trim(),
          };
        })
        .filter((candidate) => candidate.value.length > 0);

      return (
        candidates.find((candidate) =>
          candidate.label.includes(String(searchText)),
        ) ??
        candidates[0] ??
        null
      );
    }, text);

  expect(
    option,
    `Could not find any selectable option for selector ${selector}.`,
  ).toBeTruthy();
  await page.locator(selector).selectOption(option!.value);
  return option!;
}

function sectionByHeading(page: Page, title: string) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: title }),
  });
}

test("manager can run an RCSA campaign lifecycle and generate follow-up", async ({
  page,
}) => {
  test.setTimeout(150_000);

  const campaignTitle = `Playwright RCSA ${Date.now()}`;
  const reviewNotes = `Reviewed RCSA responses ${Date.now()} with remediation required.`;

  const candidates = credentialCandidates({
    emails: [
      process.env.E2E_ADMIN_TEST_EMAIL,
      "manager@open-grc.local",
      "admin@open-grc.local",
    ],
    passwords: [process.env.E2E_ADMIN_TEST_PASSWORD, "ChangeMe123!"],
  });

  const session = await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/rcsa/new");
  await page.getByLabel("Campaign title").fill(campaignTitle);
  await page.getByLabel("Status").selectOption("draft");
  const ownerOption = await selectOptionContainingOrFirst(
    page,
    "#ownerProfileId",
    session.email,
  );
  await selectOptionContainingOrFirst(
    page,
    "#auditableEntityId",
    "Identity & Access Management",
  );
  await selectOptionContainingOrFirst(
    page,
    "#riskId",
    "No MFA for legacy VPN users",
  );
  await selectOptionContainingOrFirst(page, "#controlId", "MFA");
  await page.getByLabel("Period start").fill("2032-01-01");
  await page.getByLabel("Period end").fill("2032-03-31");
  await page.getByLabel("Due date").fill("2032-04-15");
  await page
    .getByLabel("Description")
    .fill("Playwright-created RCSA campaign for lifecycle coverage.");
  await page.getByRole("button", { name: "Create campaign" }).click();

  await expect(page).toHaveURL(/\/dashboard\/rcsa\/[0-9a-f-]+$/, {
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: campaignTitle })).toBeVisible({
    timeout: 20_000,
  });

  const responseSelects = page.locator('select[name^="responseValue:"]');
  await expect(responseSelects).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await responseSelects
      .nth(index)
      .selectOption(index === 0 ? "critical" : "weak");
  }

  await page
    .getByLabel("Notes for actions needed")
    .fill("Remediation is not complete and ownership needs tightening.");
  await page.getByLabel("Action required").first().check();
  await page
    .getByLabel("Suggested action for actions needed")
    .fill("Create a time-bound remediation plan for the RCSA gap.");
  await page.getByRole("button", { name: "Submit responses" }).click();

  await expect(sectionByHeading(page, "Response summary")).toContainText(
    "critical",
    { timeout: 20_000 },
  );
  await expect(
    page.getByText("RCSA responses were submitted for manager review."),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(sectionByHeading(page, "Response summary")).toContainText(
    "Action required",
  );

  await page.getByRole("button", { name: "Create issue" }).first().click();
  await expect(
    page.getByText("Issue was created from the weak RCSA response."),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("link", { name: "View linked issue" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Create action plan" })
    .first()
    .click();
  await expect(
    page.getByText("Action plan was created from the weak RCSA response."),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("link", { name: "View linked action" }),
  ).toBeVisible();

  await page.getByLabel("Review status").selectOption("reviewed");
  await page.getByLabel("Manager review notes").fill(reviewNotes);
  await page.getByRole("button", { name: "Save manager review" }).click();
  await expect(page.getByText("Manager review was saved.")).toBeVisible({
    timeout: 20_000,
  });
  await expect(sectionByHeading(page, "Manager review")).toContainText(
    "reviewed",
  );

  const auditSection = sectionByHeading(page, "Audit log");
  await expect(auditSection.locator(":scope > ul > li")).toHaveCount(3);
  await expect(auditSection).toContainText("create");
  await expect(auditSection).toContainText("update");
  await expect(auditSection).toContainText("status: reviewed");

  await page.goto("/dashboard/rcsa");
  await page.locator('select[name="status"]').selectOption("reviewed");
  await page.locator('select[name="owner"]').selectOption(ownerOption.value);
  await page.locator('select[name="period"]').selectOption("2032");
  await page.locator('select[name="score"]').selectOption("critical");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("link", { name: campaignTitle })).toBeVisible({
    timeout: 20_000,
  });
});
