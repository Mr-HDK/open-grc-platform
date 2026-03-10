import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function signIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing_credentials");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  redirect("/dashboard");
}

const errorMessageByCode: Record<string, string> = {
  invalid_credentials: "Invalid credentials. Please try again.",
  missing_credentials: "Email and password are required.",
  profile_missing:
    "Your profile could not be loaded. Run `npm run db:setup` or ask an admin to confirm profiles are seeded.",
  organization_missing:
    "Organization context is missing. Run `npm run db:setup` before signing in.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorCode = params.error;
  const errorMessage = errorCode ? errorMessageByCode[errorCode] : null;
  const user = await getSessionUser();

  const shouldHoldOnError =
    errorCode === "profile_missing" || errorCode === "organization_missing";

  if (user && shouldHoldOnError) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } else if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
      <div className="w-full rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use a Supabase user from your project.
        </p>

        {errorMessage ? <FeedbackAlert message={errorMessage} /> : null}

        <form action={signIn} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input id="email" name="email" type="email" required />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input id="password" name="password" type="password" required />
          </div>

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
