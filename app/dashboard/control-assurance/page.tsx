import Link from "next/link";

import { FeedbackAlert } from "@/components/ui/feedback-alert";
import {
  deriveControlAssuranceHealth,
  isOpenEvidenceRequest,
  isPastDate,
  toLabel,
} from "@/lib/control-assurance/health";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ControlRow = {
  id: string;
  code: string;
  title: string;
  owner_profile_id: string | null;
  effectiveness_status: string;
  next_review_date: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type AttestationRow = {
  id: string;
  control_id: string;
  status: "pending" | "submitted" | "reviewed";
  due_date: string;
  created_at: string;
};

type EvidenceRequestRow = {
  id: string;
  control_id: string;
  status: "requested" | "submitted" | "accepted" | "rejected" | "waived";
  due_date: string;
  evidence_id: string | null;
};

type FindingRow = {
  id: string;
  control_id: string;
  status: "open" | "in_progress" | "closed";
};

type ControlTestRow = {
  id: string;
  control_id: string;
  result: string;
  updated_at: string;
};

function profileLabel(profile: ProfileRow | undefined) {
  if (!profile) {
    return "-";
  }

  return profile.full_name ? `${profile.full_name} (${profile.email})` : profile.email;
}

export default async function ControlAssurancePage({
  searchParams,
}: {
  searchParams: Promise<{
    health?: string;
    focus?: string;
    ownerId?: string;
    error?: string;
  }>;
}) {
  const profile = await requireSessionProfile("manager");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const healthFilter = params.health === "healthy" || params.health === "at_risk" ? params.health : "";
  const focusFilter =
    params.focus === "overdue" ||
    params.focus === "missing_attestations" ||
    params.focus === "missing_evidence"
      ? params.focus
      : "";
  const ownerId = params.ownerId?.trim() ?? "";

  const [controlsResult, profilesResult, attestationsResult, requestsResult, findingsResult, testsResult] =
    await Promise.all([
      supabase
        .from("controls")
        .select("id, code, title, owner_profile_id, effectiveness_status, next_review_date")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .order("code")
        .returns<ControlRow[]>(),
      supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("organization_id", profile.organizationId)
        .order("email")
        .returns<ProfileRow[]>(),
      supabase
        .from("control_attestations")
        .select("id, control_id, status, due_date, created_at")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .returns<AttestationRow[]>(),
      supabase
        .from("control_evidence_requests")
        .select("id, control_id, status, due_date, evidence_id")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .returns<EvidenceRequestRow[]>(),
      supabase
        .from("findings")
        .select("id, control_id, status")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .in("status", ["open", "in_progress"])
        .returns<FindingRow[]>(),
      supabase
        .from("control_tests")
        .select("id, control_id, result, updated_at")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .returns<ControlTestRow[]>(),
    ]);

  const controls = controlsResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const profileById = new Map(profiles.map((item) => [item.id, item]));
  const attestationsByControlId = new Map<string, AttestationRow[]>();
  const requestsByControlId = new Map<string, EvidenceRequestRow[]>();
  const findingsByControlId = new Map<string, FindingRow[]>();
  const latestTestByControlId = new Map<string, ControlTestRow>();

  for (const attestation of attestationsResult.data ?? []) {
    const bucket = attestationsByControlId.get(attestation.control_id) ?? [];
    bucket.push(attestation);
    attestationsByControlId.set(attestation.control_id, bucket);
  }

  for (const request of requestsResult.data ?? []) {
    const bucket = requestsByControlId.get(request.control_id) ?? [];
    bucket.push(request);
    requestsByControlId.set(request.control_id, bucket);
  }

  for (const finding of findingsResult.data ?? []) {
    const bucket = findingsByControlId.get(finding.control_id) ?? [];
    bucket.push(finding);
    findingsByControlId.set(finding.control_id, bucket);
  }

  for (const test of testsResult.data ?? []) {
    if (!latestTestByControlId.has(test.control_id)) {
      latestTestByControlId.set(test.control_id, test);
    }
  }

  const rows = controls
    .map((control) => {
      const attestations = (attestationsByControlId.get(control.id) ?? []).sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
      const latestAttestation = attestations[0] ?? null;
      const requests = requestsByControlId.get(control.id) ?? [];
      const openRequests = requests.filter((request) => isOpenEvidenceRequest(request.status));
      const overdueEvidenceRequests = openRequests.filter((request) => isPastDate(request.due_date)).length;
      const missingEvidenceRequests = openRequests.filter((request) => !request.evidence_id).length;
      const overdueAttestations =
        latestAttestation && latestAttestation.status === "pending" && isPastDate(latestAttestation.due_date)
          ? 1
          : 0;
      const openFindings = (findingsByControlId.get(control.id) ?? []).length;
      const latestTest = latestTestByControlId.get(control.id) ?? null;
      const health = deriveControlAssuranceHealth({
        overdueAttestations,
        overdueEvidenceRequests,
        openFindings,
        latestTestResult: latestTest?.result ?? null,
        effectivenessStatus: control.effectiveness_status,
      });

      return {
        control,
        ownerLabel: control.owner_profile_id ? profileLabel(profileById.get(control.owner_profile_id)) : "-",
        latestAttestation,
        missingAttestation: !latestAttestation || latestAttestation.status === "pending",
        overdueAttestations,
        openRequestCount: openRequests.length,
        overdueEvidenceRequests,
        missingEvidenceRequests,
        openFindings,
        latestTest,
        health,
      };
    })
    .filter((row) => (ownerId ? row.control.owner_profile_id === ownerId : true))
    .filter((row) => (healthFilter ? row.health === healthFilter : true))
    .filter((row) => {
      if (focusFilter === "overdue") {
        return row.overdueAttestations > 0 || row.overdueEvidenceRequests > 0;
      }
      if (focusFilter === "missing_attestations") {
        return row.missingAttestation;
      }
      if (focusFilter === "missing_evidence") {
        return row.missingEvidenceRequests > 0;
      }
      return true;
    });

  const overdueControls = rows.filter(
    (row) => row.overdueAttestations > 0 || row.overdueEvidenceRequests > 0,
  ).length;
  const missingAttestations = rows.filter((row) => row.missingAttestation).length;
  const missingEvidence = rows.filter((row) => row.missingEvidenceRequests > 0).length;
  const healthyControls = rows.filter((row) => row.health === "healthy").length;
  const atRiskControls = rows.filter((row) => row.health === "at_risk").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Control assurance</h1>
        <p className="text-sm text-muted-foreground">
          Manager view across attestations, evidence collection, findings, and testing posture.
        </p>
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <div className="grid gap-3 md:grid-cols-5">
        <article className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue controls</p>
          <p className="mt-2 text-xl font-semibold">{overdueControls}</p>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Missing attestations</p>
          <p className="mt-2 text-xl font-semibold">{missingAttestations}</p>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Missing evidence</p>
          <p className="mt-2 text-xl font-semibold">{missingEvidence}</p>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Healthy controls</p>
          <p className="mt-2 text-xl font-semibold">{healthyControls}</p>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">At risk controls</p>
          <p className="mt-2 text-xl font-semibold">{atRiskControls}</p>
        </article>
      </div>

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <select
          name="health"
          aria-label="Filter by health"
          defaultValue={healthFilter}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All health states</option>
          <option value="healthy">Healthy</option>
          <option value="at_risk">At risk</option>
        </select>
        <select
          name="focus"
          aria-label="Filter by focus"
          defaultValue={focusFilter}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All controls</option>
          <option value="overdue">Overdue controls</option>
          <option value="missing_attestations">Missing attestations</option>
          <option value="missing_evidence">Missing evidence</option>
        </select>
        <select
          name="ownerId"
          aria-label="Filter by owner"
          defaultValue={ownerId}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All owners</option>
          {profiles.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {profileLabel(owner)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium"
        >
          Apply filters
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <caption className="sr-only">Control assurance results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Control
              </th>
              <th scope="col" className="px-4 py-3">
                Owner
              </th>
              <th scope="col" className="px-4 py-3">
                Latest attestation
              </th>
              <th scope="col" className="px-4 py-3">
                Evidence
              </th>
              <th scope="col" className="px-4 py-3">
                Findings
              </th>
              <th scope="col" className="px-4 py-3">
                Latest test
              </th>
              <th scope="col" className="px-4 py-3">
                Health
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.control.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/controls/${row.control.id}`}
                    className="font-medium hover:underline"
                  >
                    {row.control.code} - {row.control.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.ownerLabel}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.latestAttestation ? (
                    <>
                      <div>{toLabel(row.latestAttestation.status)}</div>
                      <div className="text-xs">
                        due {row.latestAttestation.due_date}
                        {row.overdueAttestations > 0 ? " (overdue)" : ""}
                      </div>
                    </>
                  ) : (
                    "None"
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.openRequestCount} open
                  {row.overdueEvidenceRequests > 0
                    ? ` / ${row.overdueEvidenceRequests} overdue`
                    : ""}
                  {row.missingEvidenceRequests > 0
                    ? ` / ${row.missingEvidenceRequests} missing`
                    : ""}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.openFindings}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.latestTest ? toLabel(row.latestTest.result) : "None"}
                </td>
                <td className="px-4 py-3 capitalize">{toLabel(row.health)}</td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                  No controls match the current assurance filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
