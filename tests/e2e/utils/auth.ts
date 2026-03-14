import { expect, type Page } from "@playwright/test";

function unique(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0),
    ),
  );
}

export function credentialCandidates(input: {
  emails: Array<string | undefined | null>;
  passwords: Array<string | undefined | null>;
}) {
  return {
    emails: unique(input.emails),
    passwords: unique(input.passwords),
  };
}

export async function signInWithCandidates(
  page: Page,
  candidates: {
    emails: string[];
    passwords: string[];
  },
) {
  for (const email of candidates.emails) {
    for (const password of candidates.passwords) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await page.goto("/login");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();

        try {
          await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
          return { email, password };
        } catch {
          // Retry on transient network/login errors before moving to next candidate.
          if (attempt < 2) {
            await page.waitForTimeout(1_000);
            continue;
          }
        }
      }
    }
  }

  throw new Error("Could not sign in with available credential candidates.");
}
