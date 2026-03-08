import { ControlForm } from "@/components/controls/control-form";

import { createControlAction } from "@/app/dashboard/controls/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type RiskOptionRow = {
  id: string;
  title: string;
  status: string;
  score: number;
};

export default async function NewControlPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");

  const supabase = await createSupabaseServerClient();
  const [{ data: owners }, { data: risks }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name").order("email").returns<OwnerRow[]>(),
    supabase
      .from("risks")
      .select("id, title, status, score")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(20)
      .returns<RiskOptionRow[]>(),
  ]);

  const params = await searchParams;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New control</h1>
        <p className="text-sm text-muted-foreground">
          Create a control and link it to one or more risks.
        </p>
      </div>

      <ControlForm
        mode="create"
        action={createControlAction}
        owners={(owners ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
        }))}
        riskOptions={risks ?? []}
        defaults={{ ownerProfileId: profile.id }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
