import Link from "next/link";
import { notFound } from "next/navigation";

import {
  acknowledgePolicyAction,
  approvePolicyAction,
  archivePolicyAction,
  createPolicyCampaignAction,
  createPolicyExceptionAction,
  publishPolicyAction,
  requestPolicyReviewAction,
  revokePolicyExceptionAction,
} from "@/app/dashboard/policies/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PolicyDetail = {
  id: string;
  title: string;
  version: string;
  status: string;
  effective_date: string;
  next_review_date: string | null;
  owner_profile_id: string | null;
  content: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string | null;
};

type CampaignRow = {
  id: string;
  name: string;
  due_date: string;
  audience_type: "role" | "profiles" | "group";
  audience_role: string | null;
  audience_group_id: string | null;
};

type TargetRow = {
  id: string;
  campaign_id: string;
  profile_id: string;
  due_date: string;
  acknowledged_at: string | null;
};

type GroupRow = { id: string; audience_key: string; name: string };

type ApprovalRow = {
  id: string;
  approver_profile_id: string;
  decision: "approved" | "rejected";
  comment: string | null;
  created_at: string;
};

type ExceptionRow = {
  id: string;
  profile_id: string | null;
  justification: string;
  expiration_date: string;
  approved_by_profile_id: string;
  status: "active" | "expired" | "revoked";
};

function labelProfile(profile: ProfileRow | null | undefined) {
  if (!profile) {
    return "-";
  }

  return profile.full_name ? `${profile.full_name} (${profile.email})` : profile.email;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function targetStatus(target: TargetRow) {
  if (target.acknowledged_at) {
    return "acknowledged";
  }
  return target.due_date < todayIso() ? "overdue" : "pending";
}

function exceptionStatus(item: ExceptionRow) {
  if (item.status === "revoked") {
    return "revoked";
  }
  return item.expiration_date < todayIso() ? "expired" : "active";
}

function daysUntil(dateValue: string) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const target = new Date(`${dateValue}T00:00:00.000Z`);
  return Math.floor((target.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
}

export default async function PolicyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canManage = hasRole("manager", profile.role);
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: policy } = await supabase
    .from("policies")
    .select(
      "id, title, version, status, effective_date, next_review_date, owner_profile_id, content, published_at, created_at, updated_at",
    )
    .eq("id", id)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .maybeSingle<PolicyDetail>();

  if (!policy) {
    notFound();
  }

  const [
    profilesResult,
    groupsResult,
    campaignsResult,
    targetsResult,
    approvalsResult,
    exceptionsResult,
    previousResult,
    auditEntries,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, status")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<ProfileRow[]>(),
    supabase
      .from("policy_audience_groups")
      .select("id, audience_key, name")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("name")
      .returns<GroupRow[]>(),
    supabase
      .from("policy_attestation_campaigns")
      .select("id, name, due_date, audience_type, audience_role, audience_group_id")
      .eq("organization_id", profile.organizationId)
      .eq("policy_id", policy.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .returns<CampaignRow[]>(),
    supabase
      .from("policy_attestation_targets")
      .select("id, campaign_id, profile_id, due_date, acknowledged_at")
      .eq("organization_id", profile.organizationId)
      .eq("policy_id", policy.id)
      .returns<TargetRow[]>(),
    supabase
      .from("policy_approvals")
      .select("id, approver_profile_id, decision, comment, created_at")
      .eq("organization_id", profile.organizationId)
      .eq("policy_id", policy.id)
      .order("created_at", { ascending: false })
      .returns<ApprovalRow[]>(),
    supabase
      .from("policy_exceptions")
      .select("id, profile_id, justification, expiration_date, approved_by_profile_id, status")
      .eq("organization_id", profile.organizationId)
      .eq("policy_id", policy.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .returns<ExceptionRow[]>(),
    supabase
      .from("policies")
      .select(
        "id, title, version, status, effective_date, next_review_date, owner_profile_id, content, published_at, created_at, updated_at",
      )
      .eq("organization_id", profile.organizationId)
      .eq("title", policy.title)
      .lt("created_at", policy.created_at)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<PolicyDetail>(),
    getAuditEntries("policy", policy.id),
  ]);

  const profiles = profilesResult.data ?? [];
  const groups = groupsResult.data ?? [];
  const campaigns = campaignsResult.data ?? [];
  const targets = targetsResult.data ?? [];
  const approvals = approvalsResult.data ?? [];
  const exceptions = exceptionsResult.data ?? [];
  const previousPolicy = previousResult.data ?? null;
  const profileById = new Map(profiles.map((item) => [item.id, item]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const owner = policy.owner_profile_id ? profileById.get(policy.owner_profile_id) : null;
  const activeProfiles = profiles.filter((item) => item.status !== "deactivated" && item.status !== "invited");
  const managerProfiles = profiles.filter((item) => ["manager", "admin"].includes(item.role));
  const reviewDelta = policy.next_review_date ? daysUntil(policy.next_review_date) : null;

  const campaignStats = new Map<string, { total: number; acknowledged: number; pending: number; overdue: number }>();
  const ownPendingTargets = targets.filter(
    (target) => target.profile_id === profile.id && targetStatus(target) !== "acknowledged",
  );
  for (const target of targets) {
    const stats = campaignStats.get(target.campaign_id) ?? { total: 0, acknowledged: 0, pending: 0, overdue: 0 };
    const status = targetStatus(target);
    stats.total += 1;
    if (status === "acknowledged") stats.acknowledged += 1;
    if (status === "pending") stats.pending += 1;
    if (status === "overdue") stats.overdue += 1;
    campaignStats.set(target.campaign_id, stats);
  }

  const totalOverdueTargets = Array.from(campaignStats.values()).reduce((acc, item) => acc + item.overdue, 0);
  const pendingCampaignId = ownPendingTargets[0]?.campaign_id ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{policy.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Version {policy.version} | {policy.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && ["draft", "in_review"].includes(policy.status) ? (
            <Link href={`/dashboard/policies/${policy.id}/edit`} className={buttonVariants({ variant: "outline" })}>Edit</Link>
          ) : null}
          {canManage && policy.status === "draft" ? (
            <form action={requestPolicyReviewAction}><input type="hidden" name="policyId" value={policy.id} /><button type="submit" className={buttonVariants({ variant: "outline" })}>Submit for review</button></form>
          ) : null}
          {canManage && policy.status === "in_review" ? (
            <>
              <form action={approvePolicyAction}><input type="hidden" name="policyId" value={policy.id} /><input type="hidden" name="decision" value="approved" /><button type="submit" className={buttonVariants({ variant: "outline" })}>Approve</button></form>
              <form action={approvePolicyAction}><input type="hidden" name="policyId" value={policy.id} /><input type="hidden" name="decision" value="rejected" /><button type="submit" className={buttonVariants({ variant: "outline" })}>Reject</button></form>
              <form action={publishPolicyAction}><input type="hidden" name="policyId" value={policy.id} /><button type="submit" className={buttonVariants({ variant: "outline" })}>Publish</button></form>
            </>
          ) : null}
          {canManage && policy.status !== "archived" ? (
            <form action={archivePolicyAction}><input type="hidden" name="policyId" value={policy.id} /><button type="submit" className={buttonVariants({ variant: "outline" })}>Archive</button></form>
          ) : null}
        </div>
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}
      {query.success ? <FeedbackAlert variant="success" message={`Policy update successful (${query.success}).`} /> : null}

      {policy.status === "active" && reviewDelta !== null && reviewDelta <= 14 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {reviewDelta < 0 ? `Policy review overdue by ${Math.abs(reviewDelta)} day(s).` : `Policy review due in ${reviewDelta} day(s).`}
        </div>
      ) : null}
      {totalOverdueTargets > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {totalOverdueTargets} attestation target(s) are overdue.
        </div>
      ) : null}

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Effective date</p><p className="mt-1 text-sm font-medium">{policy.effective_date}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Next review</p><p className="mt-1 text-sm font-medium">{policy.next_review_date ?? "-"}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p><p className="mt-1 text-sm font-medium">{labelProfile(owner)}</p></div>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Attestation campaigns</h2>
          {policy.status === "active" && ownPendingTargets.length > 0 ? (
            <form action={acknowledgePolicyAction}>
              <input type="hidden" name="policyId" value={policy.id} />
              <input type="hidden" name="campaignId" value={pendingCampaignId} />
              <button type="submit" className={buttonVariants()}>Acknowledge policy</button>
            </form>
          ) : null}
        </div>
        {canManage && policy.status === "active" ? (
          <form action={createPolicyCampaignAction} className="mt-4 grid gap-3 rounded-lg border p-4 md:grid-cols-2">
            <input type="hidden" name="policyId" value={policy.id} />
            <input name="name" required placeholder="Campaign name" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" />
            <input name="dueDate" type="date" required defaultValue={new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" />
            <select name="audienceType" defaultValue="role" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="role">By role</option><option value="profiles">Explicit profiles</option><option value="group">Audience group</option></select>
            <select name="audienceRole" defaultValue="viewer" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">None</option><option value="admin">admin</option><option value="manager">manager</option><option value="contributor">contributor</option><option value="viewer">viewer</option></select>
            <select name="audienceGroupId" defaultValue="" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm md:col-span-2"><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.audience_key})</option>)}</select>
            <div className="space-y-2 md:col-span-2">
              <p className="text-xs font-medium">Explicit profiles (for audienceType=profiles)</p>
              <div className="max-h-36 space-y-1 overflow-auto rounded-md border p-2">{activeProfiles.map((item) => <label key={item.id} className="flex items-center gap-2 text-xs"><input type="checkbox" name="targetProfileIds" value={item.id} />{labelProfile(item)} ({item.role})</label>)}</div>
            </div>
            <button type="submit" className={buttonVariants({ variant: "outline" })}>Launch campaign</button>
          </form>
        ) : null}
        <ul className="mt-4 space-y-2 text-sm">
          {campaigns.map((campaign) => {
            const stats = campaignStats.get(campaign.id) ?? { total: 0, acknowledged: 0, pending: 0, overdue: 0 };
            const audienceLabel = campaign.audience_type === "group" ? `group: ${groupById.get(campaign.audience_group_id ?? "")?.name ?? "unknown"}` : campaign.audience_type === "role" ? `role: ${campaign.audience_role}` : "explicit profiles";
            return <li key={campaign.id} className="rounded-lg border p-3">{campaign.name} | due {campaign.due_date} | {audienceLabel} | ack {stats.acknowledged} / pending {stats.pending} / overdue {stats.overdue}</li>;
          })}
          {campaigns.length === 0 ? <li className="text-muted-foreground">No campaigns yet.</li> : null}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Waivers</h2>
        {canManage ? (
          <form action={createPolicyExceptionAction} className="mt-4 grid gap-3 rounded-lg border p-4 md:grid-cols-2">
            <input type="hidden" name="policyId" value={policy.id} />
            <select name="profileId" defaultValue="" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">Policy-level waiver</option>{activeProfiles.map((item) => <option key={item.id} value={item.id}>{labelProfile(item)} ({item.role})</option>)}</select>
            <input name="expirationDate" type="date" required defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" />
            <select name="approvedByProfileId" required defaultValue="" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm md:col-span-2"><option value="">Select approver</option>{managerProfiles.map((item) => <option key={item.id} value={item.id}>{labelProfile(item)} ({item.role})</option>)}</select>
            <textarea name="justification" minLength={10} maxLength={4000} required className="min-h-[90px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2" />
            <button type="submit" className={buttonVariants({ variant: "outline" })}>Create waiver</button>
          </form>
        ) : null}
        <ul className="mt-4 space-y-2 text-sm">
          {exceptions.map((item) => <li key={item.id} className="rounded-lg border p-3"><p className="font-medium capitalize">{exceptionStatus(item)} waiver</p><p className="mt-1 text-xs text-muted-foreground">profile: {labelProfile(profileById.get(item.profile_id ?? ""))} | approved by {labelProfile(profileById.get(item.approved_by_profile_id))} | exp {item.expiration_date}</p><p className="mt-2 text-xs text-muted-foreground">{item.justification}</p>{canManage && exceptionStatus(item) === "active" ? <form action={revokePolicyExceptionAction} className="mt-2"><input type="hidden" name="policyExceptionId" value={item.id} /><button type="submit" className={buttonVariants({ variant: "outline" })}>Revoke waiver</button></form> : null}</li>)}
          {exceptions.length === 0 ? <li className="text-muted-foreground">No waivers recorded.</li> : null}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Approvals</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {approvals.map((approval) => <li key={approval.id} className="rounded-lg border p-3">{approval.decision} by {labelProfile(profileById.get(approval.approver_profile_id))} ({new Date(approval.created_at).toLocaleString()}){approval.comment ? ` | ${approval.comment}` : ""}</li>)}
          {approvals.length === 0 ? <li className="text-muted-foreground">No decisions yet.</li> : null}
        </ul>
      </section>

      {previousPolicy ? (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight">Previous version comparison</h2>
          <p className="mt-2 text-sm text-muted-foreground">Comparing with v{previousPolicy.version}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="rounded-lg border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Previous content</p><p className="mt-2 whitespace-pre-line text-sm">{previousPolicy.content ?? "-"}</p></article>
            <article className="rounded-lg border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Current content</p><p className="mt-2 whitespace-pre-line text-sm">{policy.content ?? "-"}</p></article>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Content</h2>
        <p className="mt-3 whitespace-pre-line text-sm">{policy.content ?? "-"}</p>
      </section>

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
