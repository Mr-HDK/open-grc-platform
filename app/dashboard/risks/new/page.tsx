import { RiskForm } from "@/components/risks/risk-form";

import { createRiskAction } from "@/app/dashboard/risks/actions";
import { requireSessionProfile } from "@/lib/auth/profile";

export default async function NewRiskPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSessionProfile("contributor");

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
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
