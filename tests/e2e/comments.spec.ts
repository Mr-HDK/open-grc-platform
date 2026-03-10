import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_TEST_EMAIL;
const adminPassword = process.env.E2E_ADMIN_TEST_PASSWORD;

test("admin can post a risk comment", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_TEST_EMAIL and E2E_ADMIN_TEST_PASSWORD.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail ?? "");
  await page.getByLabel("Password").fill(adminPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/risks");
  const firstRisk = page.locator("tbody a").first();
  test.skip((await firstRisk.count()) === 0, "No risks available for comment test.");

  await firstRisk.click();

  await expect(page.getByRole("heading", { name: "Comments" })).toBeVisible();

  const commentBox = page.getByPlaceholder("Add a comment...");
  await commentBox.fill(`E2E comment ${Date.now()}`);
  await page.getByRole("button", { name: "Post comment" }).click();

  await expect(page.getByText("Comment posted.")).toBeVisible();
});
