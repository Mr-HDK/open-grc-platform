import { notFound } from "next/navigation";

import { updateControlAction } from "@/app/dashboard/controls/actions";
import { ControlForm } from "@/components/controls/control-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type ControlEffectivenessStatus,
  type ControlReviewFrequency,
} from "@/lib/validators/control";

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

type ControlEditData = {
  id: string;
  code: string;
  title: string;
  description: string;
  control_type: string;
  review_frequency: ControlReviewFrequency;
  effectiveness_status: ControlEffectivenessStatus;
  owner_profile_id: string | null;
  next_review_date: string | null;
};

type RiskLinkRow = {
  risk_id: string;
};

async function getControlForEdit(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("controls")
    .select(
      "id, code, title, description, control_type, review_frequency, effectiveness_status, owner_profile_id, next_review_date",
    )
    .eq("id", controlId)
    .is("deleted_at", null)
    .maybeSingle<ControlEditData>();

  return data;
}

async function getFormOptions(controlId: string) {
  const supabase = await createSupabaseServerClient();

  const [{ data: owners }, { data: risks }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name").order("email").returns<OwnerRow[]>(),
    supabase
      .from("risks")
      .select("id, title, status, score")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(20)
      .returns<RiskOptionRow[]>(),
    supabase
      .from("risk_controls")
      .select("risk_id")
      .eq("control_id", controlId)
      .returns<RiskLinkRow[]>(),
  ]);

  return {
    owners: owners ?? [],
    risks: risks ?? [],
    linkedRiskIds: (links ?? []).map((item) => item.risk_id),
  };
}

export default async function EditControlPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSessionProfile("contributor");

  const { id } = await params;
  const query = await searchParams;

  const control = await getControlForEdit(id);

  if (!control) {
    notFound();
  }

  const { owners, risks, linkedRiskIds } = await getFormOptions(control.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit control</h1>
        <p className="text-sm text-muted-foreground">
          Update control metadata, owner, review settings, and linked risks.
        </p>
      </div>

      <ControlForm
        mode="edit"
        action={updateControlAction}
        owners={owners.map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
        }))}
        riskOptions={risks}
        defaults={{
          controlId: control.id,
          code: control.code,
          title: control.title,
          description: control.description,
          controlType: control.control_type,
          reviewFrequency: control.review_frequency,
          effectivenessStatus: control.effectiveness_status,
          ownerProfileId: control.owner_profile_id,
          nextReviewDate: control.next_review_date,
          selectedRiskIds: linkedRiskIds,
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
