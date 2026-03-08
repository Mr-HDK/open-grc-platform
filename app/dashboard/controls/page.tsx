import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils/cn";
import {
  controlEffectivenessOptions,
  controlReviewFrequencyOptions,
  isControlEffectivenessStatus,
  isControlReviewFrequency,
} from "@/lib/validators/control";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ControlListItem = {
  id: string;
  code: string;
  title: string;
  control_type: string;
  review_frequency: string;
  effectiveness_status: string;
  next_review_date: string | null;
  updated_at: string;
};

export default async function ControlsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    effectiveness?: string;
    frequency?: string;
    error?: string;
  }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const effectiveness = isControlEffectivenessStatus(params.effectiveness)
    ? params.effectiveness
    : "";
  const frequency = isControlReviewFrequency(params.frequency) ? params.frequency : "";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("controls")
    .select(
      "id, code, title, control_type, review_frequency, effectiveness_status, next_review_date, updated_at",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (q) {
    query = query.or(`title.ilike.%${q}%,code.ilike.%${q}%`);
  }

  if (effectiveness) {
    query = query.eq("effectiveness_status", effectiveness);
  }

  if (frequency) {
    query = query.eq("review_frequency", frequency);
  }

  const { data, error } = await query.returns<ControlListItem[]>();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Controls catalog</h1>
          <p className="text-sm text-muted-foreground">
            Maintain control effectiveness and map controls to risks.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/controls/new" className={buttonVariants()}>
            New control
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <Input name="q" placeholder="Search by title or code" defaultValue={q} />

        <select
          name="effectiveness"
          aria-label="Filter by effectiveness"
          defaultValue={effectiveness}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All effectiveness</option>
          {controlEffectivenessOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="frequency"
          aria-label="Filter by review frequency"
          defaultValue={frequency}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All frequencies</option>
          {controlReviewFrequencyOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">Controls catalog results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Code
              </th>
              <th scope="col" className="px-4 py-3">
                Title
              </th>
              <th scope="col" className="px-4 py-3">
                Type
              </th>
              <th scope="col" className="px-4 py-3">
                Effectiveness
              </th>
              <th scope="col" className="px-4 py-3">
                Frequency
              </th>
              <th scope="col" className="px-4 py-3">
                Next review
              </th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((control) => (
              <tr key={control.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{control.code}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/controls/${control.id}`}
                    className="font-medium hover:underline"
                  >
                    {control.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{control.control_type}</td>
                <td className="px-4 py-3">{control.effectiveness_status}</td>
                <td className="px-4 py-3">{control.review_frequency}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {control.next_review_date ?? "-"}
                </td>
              </tr>
            ))}

            {!error && (data?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  No controls found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
