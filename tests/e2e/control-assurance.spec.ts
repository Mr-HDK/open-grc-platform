import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("admin can orchestrate control assurance and review it in the manager dashboard", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const stamp = Date.now();
  const controlCode = `ASSURE-${stamp}`;
  const controlTitle = `Playwright assurance control ${stamp}`;
  const attestationCycle = `Quarterly attestation ${stamp}`;
  const requestTitle = `Evidence request ${stamp}`;
  const candidates = credentialCandidates({
    emails: [process.env.E2E_ADMIN_TEST_EMAIL, "admin@open-grc.local"],
    passwords: [process.env.E2E_ADMIN_TEST_PASSWORD, "ChangeMe123!"],
  });

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/controls/new");
  await page.getByLabel("Code").fill(controlCode);
  await page.getByLabel("Control type").fill("Detective");
  await page.getByLabel("Title").fill(controlTitle);
  await page.getByLabel("Description").fill(
    "Playwright control assurance flow coverage for attestation and evidence orchestration.",
  );
  await page.getByLabel("Review frequency").selectOption("quarterly");
  await page.getByLabel("Effectiveness").selectOption("effective");
  await page.getByLabel("Next review date").fill("2031-03-31");
  await page.getByRole("button", { name: "Create control" }).click();

  await expect(page).toHaveURL(/\/dashboard\/controls\/[0-9a-f-]+/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: controlTitle })).toBeVisible();

  const attestationSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Attestations" }),
  });
  await attestationSection.getByLabel("Cycle").fill(attestationCycle);
  await attestationSection.getByLabel("Due date").fill("2031-04-15");
  await attestationSection.getByRole("button", { name: "Launch attestation cycle" }).click();

  await expect(page).toHaveURL(/success=attestation_created/, { timeout: 20_000 });
  await expect(page.getByText("Attestation cycle created.")).toBeVisible();
  await expect(attestationSection.getByText(attestationCycle)).toBeVisible();

  const attestationUpdateForm = attestationSection.locator("form").filter({
    has: page.getByRole("button", { name: "Update attestation" }),
  }).first();
  await attestationUpdateForm.locator('select[name="status"]').selectOption("submitted");
  await attestationUpdateForm
    .locator('select[name="attestedEffectivenessStatus"]')
    .selectOption("effective");
  await attestationUpdateForm
    .locator('textarea[name="ownerComment"]')
    .fill("Owner attests the control is operating as designed.");
  await attestationUpdateForm.getByRole("button", { name: "Update attestation" }).click();

  await expect(page).toHaveURL(/success=attestation_updated/, { timeout: 20_000 });
  await expect(page.getByText("Attestation updated.")).toBeVisible();

  const requestsSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Evidence requests" }),
  });
  await requestsSection.getByLabel("Title").fill(requestTitle);
  await requestsSection.getByLabel("Due date").fill("2031-04-20");
  await requestsSection.getByRole("button", { name: "Add evidence request" }).click();

  await expect(page).toHaveURL(/success=evidence_request_created/, { timeout: 20_000 });
  await expect(page.getByText("Evidence request created.")).toBeVisible();
  await expect(requestsSection.getByText(requestTitle)).toBeVisible();

  await requestsSection.getByRole("link", { name: "Upload evidence" }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/evidence\/new/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Upload evidence" })).toBeVisible();
  await page.getByLabel("Title").fill(`Evidence for ${controlCode}`);
  await page.getByLabel("Description").fill("Uploaded from the control assurance evidence request.");
  await page.locator("#file").setInputFiles({
    name: `${controlCode.toLowerCase()}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from("control assurance evidence"),
  });
  await page.getByRole("button", { name: "Upload evidence" }).click();

  await expect(page).toHaveURL(/success=evidence_uploaded/, { timeout: 20_000 });
  await expect(page.getByText("Evidence uploaded and linked to the request.")).toBeVisible();

  const requestUpdateForm = requestsSection.locator("form").filter({
    has: page.getByRole("button", { name: "Update request" }),
  }).first();
  await requestUpdateForm.locator('select[name="status"]').selectOption("accepted");
  await requestUpdateForm
    .locator('textarea[name="reviewComment"]')
    .fill("Evidence reviewed and accepted.");
  await requestUpdateForm.getByRole("button", { name: "Update request" }).click();

  await expect(page).toHaveURL(/success=evidence_request_updated/, { timeout: 20_000 });
  await expect(page.getByText("Evidence request updated.")).toBeVisible();

  await page.goto("/dashboard/control-assurance");
  await expect(page.getByRole("heading", { name: "Control assurance" })).toBeVisible();
  const controlRow = page.locator("tr").filter({
    has: page.getByRole("link", { name: `${controlCode} - ${controlTitle}` }),
  });
  await expect(controlRow.getByRole("link", { name: `${controlCode} - ${controlTitle}` })).toBeVisible();
  await expect(controlRow.getByRole("cell", { name: "healthy" })).toBeVisible();
});
