import { expect, test } from "@playwright/test";

const managerEmail = process.env.E2E_MANAGER_TEST_EMAIL || "manager@open-grc.local";
const managerPassword = process.env.E2E_RISK_TEST_PASSWORD;

test("manager can create and revoke a risk acceptance", async ({ page }) => {
  test.skip(!managerPassword, "Set E2E_RISK_TEST_PASSWORD for manager seeded account.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(managerEmail);
  await page.getByLabel("Password").fill(managerPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/risk-acceptances/new");
  await page.getByLabel("Risk").selectOption({ index: 1 });
  await page.getByLabel("Approver").selectOption({ index: 1 });
  await page.getByLabel("Expiration date").fill("2031-12-31");
  await page
    .getByLabel("Justification")
    .fill("Temporary acceptance approved while remediation is planned and funded.");
  await page.getByRole("button", { name: "Create acceptance" }).click();

  await expect(page).toHaveURL(/\/dashboard\/risk-acceptances\/[0-9a-f-]+/);
  await expect(page.getByRole("heading", { name: /^Risk acceptance$/ })).toBeVisible();
  await expect(page.getByText(/^active$/i)).toBeVisible();

  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText(/^revoked$/i)).toBeVisible();
});
