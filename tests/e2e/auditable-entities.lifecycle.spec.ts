import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

function requireIdFromUrl(url: string, segment: string) {
  const match = url.match(new RegExp(`/dashboard/${segment}/([0-9a-f-]+)`));
  if (!match?.[1]) {
    throw new Error(`Could not extract ${segment} identifier from URL: ${url}`);
  }

  return match[1];
}

test("contributor can create, edit, and cross-link an auditable entity", async ({ page }) => {
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

  const assetName = `Playwright auditable asset ${Date.now()}`;
  const vendorName = `Playwright auditable vendor ${Date.now()}`;
  const entityName = `Playwright auditable entity ${Date.now()}`;

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/assets/new");
  await page.getByLabel("Name").fill(assetName);
  await page.getByLabel("Type").fill("Application");
  await page.getByLabel("Criticality").selectOption("high");
  await page.getByLabel("Description").fill("Asset created for auditable-entity lifecycle coverage.");
  await page.getByRole("button", { name: "Create asset" }).click();

  await expect(page).toHaveURL(/\/dashboard\/assets\/[0-9a-f-]+$/, { timeout: 20_000 });
  const assetUrl = page.url();
  const assetId = requireIdFromUrl(assetUrl, "assets");

  await page.goto("/dashboard/third-parties/new");
  await page.getByRole("textbox", { name: "Vendor" }).fill(vendorName);
  await page.getByRole("textbox", { name: "Service" }).fill("Identity service");
  await page.getByLabel("Criticality").selectOption("medium");
  await page.getByLabel("Assessment status").selectOption("monitoring");
  await page.getByLabel("Assessment score (0-100)").fill("61");
  await page.getByLabel("Next review date").fill("2031-01-31");
  await page.getByRole("button", { name: "Create third-party" }).click();

  await expect(page).toHaveURL(/\/dashboard\/third-parties\/[0-9a-f-]+$/, { timeout: 20_000 });
  const thirdPartyUrl = page.url();
  const thirdPartyId = requireIdFromUrl(thirdPartyUrl, "third-parties");

  await page.goto(
    `/dashboard/auditable-entities/new?assetId=${encodeURIComponent(assetId)}&thirdPartyId=${encodeURIComponent(thirdPartyId)}`,
  );
  await page.getByLabel("Name").fill(entityName);
  await page.getByLabel("Type").selectOption("process");
  await page.getByLabel("Description").fill("Auditable entity created by Playwright for cross-link coverage.");

  const riskOptions = page.locator('input[name="riskIds"]');
  if ((await riskOptions.count()) > 0) {
    await riskOptions.first().check();
  }

  const controlOptions = page.locator('input[name="controlIds"]');
  if ((await controlOptions.count()) > 0) {
    await controlOptions.first().check();
  }

  await page.getByRole("button", { name: "Create entity" }).click();

  await expect(page).toHaveURL(/\/dashboard\/auditable-entities\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: entityName })).toBeVisible();
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Linked assets" }) }),
  ).toContainText(assetName);
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Linked third parties" }) }),
  ).toContainText(vendorName);

  const entityUrl = page.url();
  const linkedRiskSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Linked risks" }) });
  const linkedControlSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Linked controls" }) });
  const riskHref =
    (await linkedRiskSection.getByRole("link").count()) > 0
      ? await linkedRiskSection.getByRole("link").first().getAttribute("href")
      : null;
  const controlHref =
    (await linkedControlSection.getByRole("link").count()) > 0
      ? await linkedControlSection.getByRole("link").first().getAttribute("href")
      : null;

  const editHref = await page.getByRole("link", { name: "Edit" }).getAttribute("href");
  expect(editHref).toBeTruthy();
  await page.goto(editHref!);
  await expect(page).toHaveURL(/\/dashboard\/auditable-entities\/[0-9a-f-]+\/edit$/, { timeout: 20_000 });
  await page.getByLabel("Status").selectOption("inactive");
  await page.getByLabel("Description").fill("Auditable entity updated by Playwright.");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(/\/dashboard\/auditable-entities\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByText("process | inactive")).toBeVisible();
  const auditSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Audit log" }),
  });
  await expect(auditSection.locator("li.rounded-lg")).toHaveCount(2);
  await expect(auditSection.locator("li.rounded-lg").first()).toContainText("update");

  await page.goto(assetUrl);
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Linked auditable entities" }) }),
  ).toContainText(entityName);

  await page.goto(thirdPartyUrl);
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Linked auditable entities" }) }),
  ).toContainText(entityName);

  if (riskHref) {
    await page.goto(riskHref);
    await expect(
      page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "Linked auditable entities" }) }),
    ).toContainText(entityName);
  }

  if (controlHref) {
    await page.goto(controlHref);
    await expect(
      page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "Linked auditable entities" }) }),
    ).toContainText(entityName);
  }

  await page.goto(entityUrl);
  await expect(page.getByRole("heading", { name: entityName })).toBeVisible();
});
