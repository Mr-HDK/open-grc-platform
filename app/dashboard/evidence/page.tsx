import Link from "next/link";

import { archiveEvidenceAction } from "@/app/dashboard/evidence/actions";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EvidenceListItem = {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  risk_id: string | null;
  control_id: string | null;
  action_plan_id: string | null;
  created_at: string;
};

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; target?: string; error?: string }>;
}) {
  await requireSessionProfile("viewer");

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const target = ["risk", "control", "action"].includes(params.target ?? "")
    ? params.target
    : "";

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("evidence")
    .select("id, title, file_name, file_size, mime_type, risk_id, control_id, action_plan_id, created_at")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`title.ilike.%${q}%,file_name.ilike.%${q}%`);
  }

  if (target === "risk") {
    query = query.not("risk_id", "is", null);
  }

  if (target === "control") {
    query = query.not("control_id", "is", null);
  }

  if (target === "action") {
    query = query.not("action_plan_id", "is", null);
  }

  const { data, error } = await query.returns<EvidenceListItem[]>();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evidence registry</h1>
          <p className="text-sm text-muted-foreground">
            Upload and track file-based proof linked to risks, controls, and actions.
          </p>
        </div>
        <Link href="/dashboard/evidence/new" className={buttonVariants()}>
          Upload evidence
        </Link>
      </div>

      {params.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(params.error)}
        </p>
      ) : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <Input name="q" placeholder="Search by title or filename" defaultValue={q} />

        <select
          name="target"
          defaultValue={target}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All targets</option>
          <option value="risk">Linked to risk</option>
          <option value="control">Linked to control</option>
          <option value="action">Linked to action plan</option>
        </select>

        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Apply filters
        </button>
      </form>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Targets</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((item) => (
              <tr key={item.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{item.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.file_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatFileSize(item.file_size)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  <div>{item.risk_id ? "Risk" : "-"}</div>
                  <div>{item.control_id ? "Control" : "-"}</div>
                  <div>{item.action_plan_id ? "Action" : "-"}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(item.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <form action={archiveEvidenceAction}>
                    <input type="hidden" name="evidenceId" value={item.id} />
                    <button type="submit" className="text-xs font-medium text-muted-foreground underline">
                      Archive
                    </button>
                  </form>
                </td>
              </tr>
            ))}

            {!error && (data?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  No evidence found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
