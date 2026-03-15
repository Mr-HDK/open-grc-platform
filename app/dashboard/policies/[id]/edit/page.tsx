import { notFound } from "next/navigation";

import { updatePolicyAction } from "@/app/dashboard/policies/actions";
import { PolicyForm } from "@/components/policies/policy-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PolicyRow = {
  id: string;
  title: string;
  version: string;
  effective_date: string;
  next_review_date: string | null;
  owner_profile_id: string | null;
  content: string | null;
};

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

async function getPolicy(policyId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("policies")
    .select("id, title, version, effective_date, next_review_date, owner_profile_id, content")
    .eq("id", policyId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<PolicyRow>();

  return data;
}

export default async function EditPolicyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("manager");
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [policy, ownersResult] = await Promise.all([
    getPolicy(id, profile.organizationId),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<OwnerRow[]>(),
  ]);

  if (!policy) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit policy</h1>
        <p className="text-sm text-muted-foreground">Update draft metadata and content.</p>
      </div>

      <PolicyForm
        mode="edit"
        action={updatePolicyAction}
        ownerOptions={(ownersResult.data ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
        }))}
        defaults={{
          policyId: policy.id,
          title: policy.title,
          version: policy.version,
          effectiveDate: policy.effective_date,
          nextReviewDate: policy.next_review_date ?? policy.effective_date,
          ownerProfileId: policy.owner_profile_id,
          content: policy.content,
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
