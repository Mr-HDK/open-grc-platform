import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const errorMessageByCode: Record<string, string> = {
  forbidden: "You do not have access to that area.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const profile = await getSessionProfile();
  const errorMessage = params.error
    ? errorMessageByCode[params.error] ?? "Action blocked."
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{profile?.role ?? "viewer"}</span>.
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {errorMessage}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Risks" value="0" helper="Module not implemented yet" />
        <Card title="Controls" value="0" helper="Module not implemented yet" />
        <Card title="Action plans" value="0" helper="Module not implemented yet" />
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="text-sm font-medium text-muted-foreground underline underline-offset-4"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
