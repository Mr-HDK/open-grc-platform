import Link from "next/link";

import { controlEvidenceRequestStatusOptions } from "@/lib/validators/control-assurance";
import { evidenceRequestDisplayStatus, toLabel } from "@/lib/control-assurance/health";

type ProfileOption = {
  id: string;
  label: string;
};

type AttestationOption = {
  id: string;
  label: string;
};

type EvidenceOption = {
  id: string;
  label: string;
};

type ControlEvidenceRequestItem = {
  id: string;
  title: string;
  description: string | null;
  status: "requested" | "submitted" | "accepted" | "rejected" | "waived";
  dueDate: string;
  ownerProfileId: string | null;
  ownerLabel: string;
  controlAttestationId: string | null;
  controlAttestationLabel: string | null;
  evidenceId: string | null;
  evidenceLabel: string | null;
  responseNotes: string | null;
  reviewComment: string | null;
  evidenceDownloadUrl: string | null;
};

type ControlEvidenceRequestsSectionProps = {
  canEdit: boolean;
  controlId: string;
  defaultOwnerProfileId: string | null;
  profiles: ProfileOption[];
  attestations: AttestationOption[];
  evidenceOptions: EvidenceOption[];
  requests: ControlEvidenceRequestItem[];
  createAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
};

export function ControlEvidenceRequestsSection({
  canEdit,
  controlId,
  defaultOwnerProfileId,
  profiles,
  attestations,
  evidenceOptions,
  requests,
  createAction,
  updateAction,
}: ControlEvidenceRequestsSectionProps) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight">Evidence requests</h2>

      {canEdit ? (
        <form action={createAction} className="mt-4 space-y-4 rounded-lg border p-4">
          <input type="hidden" name="controlId" value={controlId} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label htmlFor="evidenceRequestTitle" className="text-sm font-medium">
                Title
              </label>
              <input
                id="evidenceRequestTitle"
                name="title"
                required
                maxLength={180}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="controlAttestationId" className="text-sm font-medium">
                Related attestation
              </label>
              <select
                id="controlAttestationId"
                name="controlAttestationId"
                defaultValue=""
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">None</option>
                {attestations.map((attestation) => (
                  <option key={attestation.id} value={attestation.id}>
                    {attestation.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="requestDueDate" className="text-sm font-medium">
                Due date
              </label>
              <input
                id="requestDueDate"
                name="dueDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="requestOwnerProfileId" className="text-sm font-medium">
                Owner
              </label>
              <select
                id="requestOwnerProfileId"
                name="ownerProfileId"
                defaultValue={defaultOwnerProfileId ?? ""}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="requestEvidenceId" className="text-sm font-medium">
                Existing evidence
              </label>
              <select
                id="requestEvidenceId"
                name="evidenceId"
                defaultValue=""
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">None</option>
                {evidenceOptions.map((evidence) => (
                  <option key={evidence.id} value={evidence.id}>
                    {evidence.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label htmlFor="requestDescription" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="requestDescription"
                name="description"
                maxLength={4000}
                className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label htmlFor="requestResponseNotes" className="text-sm font-medium">
                Owner note
              </label>
              <textarea
                id="requestResponseNotes"
                name="responseNotes"
                maxLength={4000}
                className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
          >
            Add evidence request
          </button>
        </form>
      ) : null}

      {requests.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No evidence requests logged yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {requests.map((item) => (
            <li key={item.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    status {toLabel(evidenceRequestDisplayStatus({ status: item.status, dueDate: item.dueDate }))} | due{" "}
                    {item.dueDate} | owner {item.ownerLabel}
                    {item.controlAttestationLabel ? ` | ${item.controlAttestationLabel}` : ""}
                  </p>
                </div>
                {canEdit ? (
                  <Link
                    href={`/dashboard/evidence/new?controlId=${controlId}&controlEvidenceRequestId=${item.id}`}
                    className="text-xs font-medium text-muted-foreground underline"
                  >
                    Upload evidence
                  </Link>
                ) : null}
              </div>
              {item.description ? (
                <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              {item.responseNotes ? (
                <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                  owner note: {item.responseNotes}
                </p>
              ) : null}
              {item.reviewComment ? (
                <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                  review note: {item.reviewComment}
                </p>
              ) : null}
              {item.evidenceLabel ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  linked evidence:{" "}
                  {item.evidenceDownloadUrl ? (
                    <a
                      href={item.evidenceDownloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {item.evidenceLabel}
                    </a>
                  ) : (
                    item.evidenceLabel
                  )}
                </p>
              ) : null}

              {canEdit ? (
                <form action={updateAction} className="mt-3 grid gap-3 rounded-md border p-3 md:grid-cols-4">
                  <input type="hidden" name="evidenceRequestId" value={item.id} />
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Status</label>
                    <select
                      name="status"
                      defaultValue={item.status}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                    >
                      {controlEvidenceRequestStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {toLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Due date</label>
                    <input
                      name="dueDate"
                      type="date"
                      defaultValue={item.dueDate}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Owner</label>
                    <select
                      name="ownerProfileId"
                      defaultValue={item.ownerProfileId ?? ""}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                    >
                      <option value="">Unassigned</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Evidence</label>
                    <select
                      name="evidenceId"
                      defaultValue={item.evidenceId ?? ""}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                    >
                      <option value="">None</option>
                      {evidenceOptions.map((evidence) => (
                        <option key={evidence.id} value={evidence.id}>
                          {evidence.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-medium">Owner note</label>
                    <textarea
                      name="responseNotes"
                      defaultValue={item.responseNotes ?? ""}
                      maxLength={4000}
                      className="min-h-[78px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-medium">Review comment</label>
                    <textarea
                      name="reviewComment"
                      defaultValue={item.reviewComment ?? ""}
                      maxLength={4000}
                      className="min-h-[78px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white"
                    >
                      Update request
                    </button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
