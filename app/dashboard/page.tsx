import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Bootstrap workspace for upcoming GRC modules.
        </p>
      </div>

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
