import { AuditPlanForm } from "@/components/audits/audit-plan-form";
import { createAuditPlanAction } from "@/app/dashboard/audits/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

export default async function NewAuditPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("manager");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: owners } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("organization_id", profile.organizationId)
    .order("email")
    .returns<OwnerRow[]>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New audit plan</h1>
        <p className="text-sm text-muted-foreground">
          Create an annual or semiannual internal audit plan.
        </p>
      </div>

      <AuditPlanForm
        mode="create"
        action={createAuditPlanAction}
        owners={(owners ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
        }))}
        defaults={{
          planYear: new Date().getFullYear(),
          cycle: "annual",
          status: "draft",
          ownerProfileId: profile.id,
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
