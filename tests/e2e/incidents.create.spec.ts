import { expect, test } from "@playwright/test";

const testEmail = process.env.E2E_RISK_TEST_EMAIL;
const testPassword = process.env.E2E_RISK_TEST_PASSWORD;

test("contributor can create an incident", async ({ page }) => {
  test.skip(!testEmail || !testPassword, "Set E2E_RISK_TEST_EMAIL and E2E_RISK_TEST_PASSWORD.");

  const title = `Playwright incident ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(testEmail ?? "");
  await page.getByLabel("Password").fill(testPassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/incidents/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(
    "Test incident created by Playwright to validate incident register creation flow.",
  );
  await page.getByLabel("Occurred on").fill("2030-12-31");

  await page.getByRole("button", { name: "Create incident" }).click();

  await expect
    .poll(
      async () => {
        await page.goto(`/dashboard/incidents?q=${encodeURIComponent(title)}`);
        return page.getByRole("link", { name: title }).count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
});
