import { createPolicyAction } from "@/app/dashboard/policies/actions";
import { PolicyForm } from "@/components/policies/policy-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

export default async function NewPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("manager");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const defaultEffectiveDate = new Date().toISOString().slice(0, 10);
  const nextReviewDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: owners } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("organization_id", profile.organizationId)
    .order("email")
    .returns<OwnerRow[]>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New policy</h1>
        <p className="text-sm text-muted-foreground">
          Draft a new policy version before publishing it as active.
        </p>
      </div>

      <PolicyForm
        mode="create"
        action={createPolicyAction}
        ownerOptions={(owners ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
        }))}
        defaults={{
          version: "1.0",
          effectiveDate: defaultEffectiveDate,
          nextReviewDate: nextReviewDate,
          ownerProfileId: profile.id,
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
