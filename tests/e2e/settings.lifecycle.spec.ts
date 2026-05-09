import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { credentialCandidates, signInWithCandidates } from "./utils/auth";

test("admin sees lifecycle controls", async ({ page }) => {
  const candidates = credentialCandidates({
    emails: [process.env.E2E_ADMIN_TEST_EMAIL, "admin@open-grc.local"],
    passwords: [
      process.env.E2E_ADMIN_TEST_PASSWORD,
      process.env.E2E_RISK_TEST_PASSWORD,
      "ChangeMe123!",
    ],
  });

  await signInWithCandidates(page, candidates);

  await page.goto("/dashboard/settings");
  await expect(
    page.getByRole("heading", { name: "Organization" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "User lifecycle" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Profile administration" }),
  ).toBeVisible();

  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.locator("#invite-role")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send invite" })).toBeVisible();
});

test("deactivated profile is signed out and blocked from protected routes", async ({
  page,
}) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Deactivated access test requires Supabase admin environment variables.",
  );

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const email = `deactivated-${Date.now()}@open-grc.local`;
  const password = "ChangeMe123!";
  let userId: string | null = null;

  try {
    const { data: organization, error: organizationError } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (organizationError || !organization) {
      throw new Error(organizationError?.message ?? "No organization found.");
    }

    const { data: createdUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Deactivated E2E User" },
      });

    if (createUserError || !createdUser.user) {
      throw new Error(createUserError?.message ?? "Could not create user.");
    }

    userId = createdUser.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: "Deactivated E2E User",
        role: "admin",
        organization_id: organization.id,
        status: "deactivated",
        deactivated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (profileError) {
      throw new Error(profileError.message);
    }

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login\?error=account_deactivated/, {
      timeout: 20_000,
    });
    await expect(page.getByText("Your account is deactivated.")).toBeVisible();

    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  } finally {
    if (userId) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
  }
});
