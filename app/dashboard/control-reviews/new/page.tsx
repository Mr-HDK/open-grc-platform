import { ControlReviewForm } from "@/components/control-reviews/control-review-form";

import { createControlReviewAction } from "@/app/dashboard/control-reviews/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OptionRow = {
  id: string;
  code?: string;
  title?: string;
  email?: string;
  full_name?: string | null;
};

export default async function NewControlReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; controlId?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const defaultControlId = params.controlId ?? "";
  const [{ data: controls }, { data: reviewers }] = await Promise.all([
    supabase
      .from("controls")
      .select("id, code, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50)
      .returns<OptionRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<OptionRow[]>(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New control review</h1>
        <p className="text-sm text-muted-foreground">
          Schedule and track periodic reviews for controls.
        </p>
      </div>

      <ControlReviewForm
        mode="create"
        action={createControlReviewAction}
        controlOptions={(controls ?? []).map((control) => ({
          id: control.id,
          label: `${control.code ?? "CTRL"} - ${control.title ?? control.id}`,
        }))}
        reviewerOptions={(reviewers ?? []).map((reviewer) => ({
          id: reviewer.id,
          label: reviewer.full_name ? `${reviewer.full_name} (${reviewer.email})` : (reviewer.email ?? reviewer.id),
        }))}
        defaults={{
          controlId: defaultControlId,
          reviewerProfileId: profile.id,
          targetDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
