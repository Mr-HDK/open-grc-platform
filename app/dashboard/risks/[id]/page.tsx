import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveRiskAction } from "@/app/dashboard/risks/actions";
import { buttonVariants } from "@/components/ui/button";
import { EvidenceListSection } from "@/components/evidence/evidence-list-section";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RiskDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  impact: number;
  likelihood: number;
  score: number;
  level: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type EvidenceRow = {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  created_at: string;
};

async function getRiskById(riskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risks")
    .select(
      "id, title, description, category, impact, likelihood, score, level, status, due_date, created_at, updated_at",
    )
    .eq("id", riskId)
    .is("deleted_at", null)
    .maybeSingle<RiskDetail>();

  return data;
}

async function getRiskEvidence(riskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("evidence")
    .select("id, title, file_name, file_size, created_at")
    .eq("risk_id", riskId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .returns<EvidenceRow[]>();

  return data ?? [];
}

export default async function RiskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSessionProfile("viewer");

  const { id } = await params;
  const query = await searchParams;
  const risk = await getRiskById(id);

  if (!risk) {
    notFound();
  }

  const evidence = await getRiskEvidence(risk.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{risk.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{risk.category}</p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/dashboard/risks/${risk.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit
          </Link>

          <form action={archiveRiskAction}>
            <input type="hidden" name="riskId" value={risk.id} />
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              Archive
            </button>
          </form>
        </div>
      </div>

      {query.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(query.error)}
        </p>
      ) : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Description</p>
        <p className="mt-2 whitespace-pre-line text-sm">{risk.description}</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium">{risk.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Impact x Likelihood</p>
          <p className="mt-1 text-sm font-medium">
            {risk.impact} x {risk.likelihood}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Score / Level</p>
          <p className="mt-1 text-sm font-medium">
            {risk.score} / {risk.level}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Due date</p>
          <p className="mt-1 text-sm font-medium">{risk.due_date ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
          <p className="mt-1 text-sm font-medium">{new Date(risk.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(risk.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <EvidenceListSection
        title="Evidence"
        emptyMessage="No evidence linked to this risk."
        items={evidence}
        createHref={`/dashboard/evidence/new?riskId=${risk.id}`}
      />
    </div>
  );
}
