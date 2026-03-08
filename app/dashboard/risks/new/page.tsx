import { RiskForm } from "@/components/risks/risk-form";

import { createRiskAction } from "@/app/dashboard/risks/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

export default async function NewRiskPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const supabase = await createSupabaseServerClient();

  const { data: owners } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .order("email")
    .returns<OwnerRow[]>();

  const params = await searchParams;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New risk</h1>
        <p className="text-sm text-muted-foreground">
          Add a risk with impact and likelihood scoring.
        </p>
      </div>

      <RiskForm
        mode="create"
        action={createRiskAction}
        ownerOptions={(owners ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
        }))}
        defaults={{ ownerProfileId: profile.id }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
