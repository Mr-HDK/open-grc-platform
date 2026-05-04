import Link from "next/link";

import { createRcsaCampaignAction } from "@/app/dashboard/rcsa/actions";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rcsaCampaignStatusOptions } from "@/lib/validators/rcsa";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type AuditableEntityRow = {
  id: string;
  name: string;
};

type RiskRow = {
  id: string;
  title: string;
};

type ControlRow = {
  id: string;
  code: string;
  title: string;
};

function formatProfile(profile: ProfileRow) {
  return profile.full_name
    ? `${profile.full_name} (${profile.email})`
    : profile.email;
}

function dateOffset(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export default async function NewRcsaCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("manager");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [
    { data: profiles },
    { data: entities },
    { data: risks },
    { data: controls },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<ProfileRow[]>(),
    supabase
      .from("auditable_entities")
      .select("id, name")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("name")
      .returns<AuditableEntityRow[]>(),
    supabase
      .from("risks")
      .select("id, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(100)
      .returns<RiskRow[]>(),
    supabase
      .from("controls")
      .select("id, code, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("code")
      .limit(100)
      .returns<ControlRow[]>(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            New RCSA campaign
          </h1>
          <p className="text-sm text-muted-foreground">
            Scope a fixed self-assessment to an owner, entity, risk, or control.
          </p>
        </div>

        <Link
          href="/dashboard/rcsa"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to RCSA
        </Link>
      </div>

      {params.error ? (
        <FeedbackAlert message={decodeURIComponent(params.error)} />
      ) : null}

      <form
        action={createRcsaCampaignAction}
        className="space-y-6 rounded-xl border bg-card p-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            <span>Campaign title</span>
            <input
              name="title"
              required
              minLength={3}
              maxLength={180}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Q2 access control RCSA"
            />
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Status</span>
            <select
              name="status"
              defaultValue="draft"
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {rcsaCampaignStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Campaign owner</span>
            <select
              id="ownerProfileId"
              name="ownerProfileId"
              defaultValue={profile.id}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">No owner</option>
              {(profiles ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {formatProfile(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Auditable entity</span>
            <select
              id="auditableEntityId"
              name="auditableEntityId"
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">No entity</option>
              {(entities ?? []).map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Linked risk</span>
            <select
              id="riskId"
              name="riskId"
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">No risk</option>
              {(risks ?? []).map((risk) => (
                <option key={risk.id} value={risk.id}>
                  {risk.title}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Linked control</span>
            <select
              id="controlId"
              name="controlId"
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">No control</option>
              {(controls ?? []).map((control) => (
                <option key={control.id} value={control.id}>
                  {control.code} - {control.title}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Period start</span>
            <input
              name="periodStartDate"
              type="date"
              defaultValue={dateOffset(0)}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            />
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Period end</span>
            <input
              name="periodEndDate"
              type="date"
              defaultValue={dateOffset(90)}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            />
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Due date</span>
            <input
              name="dueDate"
              type="date"
              defaultValue={dateOffset(30)}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            />
          </label>
        </div>

        <label className="space-y-2 text-sm font-medium">
          <span>Description</span>
          <textarea
            name="description"
            rows={4}
            maxLength={4000}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            placeholder="Describe the scope, period, and expectations for the self-assessment."
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className={buttonVariants()}>
            Create campaign
          </button>
          <Link
            href="/dashboard/rcsa"
            className={buttonVariants({ variant: "outline" })}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
