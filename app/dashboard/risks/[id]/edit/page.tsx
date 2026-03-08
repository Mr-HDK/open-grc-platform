import { notFound } from "next/navigation";

import { updateRiskAction } from "@/app/dashboard/risks/actions";
import { RiskForm } from "@/components/risks/risk-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RiskEditData = {
  id: string;
  title: string;
  description: string;
  category: string;
  impact: number;
  likelihood: number;
  status: "draft" | "open" | "mitigated" | "accepted" | "closed";
  due_date: string | null;
};

async function getRiskForEdit(riskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risks")
    .select("id, title, description, category, impact, likelihood, status, due_date")
    .eq("id", riskId)
    .is("deleted_at", null)
    .maybeSingle<RiskEditData>();

  return data;
}

export default async function EditRiskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSessionProfile("contributor");

  const { id } = await params;
  const query = await searchParams;
  const risk = await getRiskForEdit(id);

  if (!risk) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit risk</h1>
        <p className="text-sm text-muted-foreground">Adjust risk details and scoring inputs.</p>
      </div>

      <RiskForm
        mode="edit"
        action={updateRiskAction}
        error={query.error ? decodeURIComponent(query.error) : null}
        defaults={{
          riskId: risk.id,
          title: risk.title,
          description: risk.description,
          category: risk.category,
          impact: risk.impact,
          likelihood: risk.likelihood,
          status: risk.status,
          dueDate: risk.due_date,
        }}
      />
    </div>
  );
}
