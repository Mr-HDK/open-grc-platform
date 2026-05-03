import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

async function signInAsAdmin(page: Parameters<typeof signInWithCandidates>[0]) {
  const candidates = credentialCandidates({
    emails: [process.env.E2E_ADMIN_TEST_EMAIL, "admin@open-grc.local"],
    passwords: [process.env.E2E_ADMIN_TEST_PASSWORD, "ChangeMe123!"],
  });

  await signInWithCandidates(page, candidates);
}

test("admin can view reporting packs and printable output", async ({ page }) => {
  test.setTimeout(60_000);
  const savedViewName = `E2E Reporting ${Date.now()}`;

  await signInAsAdmin(page);

  await page.goto("/dashboard/reporting");
  await expect(page.getByRole("heading", { name: "Reporting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Report packs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved views" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Save current view" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Management review pack" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open issues" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Control health" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Printable pack" })).toBeVisible();

  await page.getByPlaceholder("Quarterly audit committee").fill(savedViewName);
  await page.getByRole("button", { name: "Save current view" }).click();

  await expect(page).toHaveURL(/\/dashboard\/reporting\?/);
  await expect(page).toHaveURL(/view=/);
  await expect(page.getByText(`Saved view "${savedViewName}".`)).toBeVisible();
  await expect(page.getByText(savedViewName, { exact: true })).toBeVisible();

  await page.goto("/dashboard/reporting/print?preset=management&horizon=30");

  await expect(page.getByRole("heading", { name: "Printable reporting pack" })).toBeVisible();
  await expect(page.getByText("Management review pack")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Control health" }).first()).toBeVisible();
});

test("admin reporting filters are reflected in export links and compliance sections", async ({ page }) => {
  test.setTimeout(60_000);

  await signInAsAdmin(page);

  await page.goto(
    "/dashboard/reporting?preset=compliance&horizon=90&statusFocus=attention_required&severity=high&issueType=policy_exception",
  );

  await expect(page.getByRole("heading", { name: "Compliance review pack" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Framework gaps" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Policy attestation coverage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Audit state" })).toBeVisible();

  const policyCoverageCard = page
    .locator("div.rounded-lg.border.bg-white.p-4")
    .filter({ has: page.getByRole("heading", { name: "Policy coverage" }) })
    .first();

  const exportJsonLink = policyCoverageCard.getByRole("link", { name: "Export JSON" });
  await expect(exportJsonLink).toHaveAttribute("href", /type=policy_coverage/);
  await expect(exportJsonLink).toHaveAttribute("href", /format=json/);
  await expect(exportJsonLink).toHaveAttribute("href", /preset=compliance/);
  await expect(exportJsonLink).toHaveAttribute("href", /horizon=90/);
  await expect(exportJsonLink).toHaveAttribute("href", /statusFocus=attention_required/);
  await expect(exportJsonLink).toHaveAttribute("href", /severity=high/);
  await expect(exportJsonLink).toHaveAttribute("href", /issueType=policy_exception/);
});

test("admin can download filtered reporting JSON exports", async ({ page }) => {
  test.setTimeout(60_000);

  await signInAsAdmin(page);
  await page.goto(
    "/dashboard/reporting?preset=audit_committee&horizon=60&statusFocus=attention_required",
  );
  await expect(page.getByRole("heading", { name: "Audit committee pack" })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export pack JSON" }).click(),
  ]);

  expect(download.suggestedFilename()).toBe("audit_committee-report-pack.json");

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const content = await download.createReadStream();
  const chunks: Buffer[] = [];

  for await (const chunk of content!) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    preset: string;
    title: string;
    horizonDays: number;
    statusFocusLabel: string;
    sections: string[];
  };

  expect(payload.preset).toBe("audit_committee");
  expect(payload.title).toBe("Audit committee pack");
  expect(payload.horizonDays).toBe(60);
  expect(payload.statusFocusLabel).toBe("attention required");
  expect(payload.sections).toContain("audit_state");
});
