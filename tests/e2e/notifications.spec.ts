import { expect, test } from "@playwright/test";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("admin can sync and review scheduler-backed notifications", async ({ page }) => {
  const candidates = credentialCandidates({
    emails: [process.env.E2E_ADMIN_TEST_EMAIL, "admin@open-grc.local"],
    passwords: [process.env.E2E_ADMIN_TEST_PASSWORD, "ChangeMe123!"],
  });

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run reminder sync" })).toBeVisible();

  await page.getByRole("button", { name: "Run reminder sync" }).click();

  await expect(page.getByText("Reminder sync complete.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Active reminders", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overdue actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Risk acceptances expiring soon" })).toBeVisible();
});
