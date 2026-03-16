import { controlEffectivenessOptions } from "@/lib/validators/control";
import { attestationDisplayStatus, toLabel } from "@/lib/control-assurance/health";
import { controlAttestationStatusOptions } from "@/lib/validators/control-assurance";

type ProfileOption = {
  id: string;
  label: string;
};

type ControlAttestationItem = {
  id: string;
  cycleName: string;
  dueDate: string;
  status: "pending" | "submitted" | "reviewed";
  ownerProfileId: string | null;
  ownerLabel: string;
  attestedEffectivenessStatus: string | null;
  ownerComment: string | null;
  reviewComment: string | null;
  attestedAt: string | null;
  reviewedAt: string | null;
};

type ControlAttestationsSectionProps = {
  canEdit: boolean;
  controlId: string;
  defaultOwnerProfileId: string | null;
  profiles: ProfileOption[];
  attestations: ControlAttestationItem[];
  createAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
};

function InputDate({
  id,
  name,
  defaultValue,
}: {
  id?: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <input
      id={id}
      name={name}
      type="date"
      defaultValue={defaultValue}
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
    />
  );
}

export function ControlAttestationsSection({
  canEdit,
  controlId,
  defaultOwnerProfileId,
  profiles,
  attestations,
  createAction,
  updateAction,
}: ControlAttestationsSectionProps) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight">Attestations</h2>

      {canEdit ? (
        <form action={createAction} className="mt-4 grid gap-3 rounded-lg border p-4 md:grid-cols-3">
          <input type="hidden" name="controlId" value={controlId} />
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="cycleName" className="text-sm font-medium">
              Cycle
            </label>
            <input
              id="cycleName"
              name="cycleName"
              required
              maxLength={120}
              placeholder="Quarterly owner attestation"
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="attestationDueDate" className="text-sm font-medium">
              Due date
            </label>
            <InputDate
              id="attestationDueDate"
              name="dueDate"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div className="space-y-1 md:col-span-3">
            <label htmlFor="attestationOwnerProfileId" className="text-sm font-medium">
              Owner
            </label>
            <select
              id="attestationOwnerProfileId"
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
          <div className="md:col-span-3">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
            >
              Launch attestation cycle
            </button>
          </div>
        </form>
      ) : null}

      {attestations.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No attestations launched yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {attestations.map((item) => (
            <li key={item.id} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{item.cycleName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                status {toLabel(attestationDisplayStatus({ status: item.status, dueDate: item.dueDate }))} | due{" "}
                {item.dueDate} | owner {item.ownerLabel}
              </p>
              {item.attestedEffectivenessStatus ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  declared effectiveness {toLabel(item.attestedEffectivenessStatus)}
                  {item.attestedAt
                    ? ` on ${new Date(item.attestedAt).toLocaleString()}`
                    : ""}
                </p>
              ) : null}
              {item.reviewedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  reviewed {new Date(item.reviewedAt).toLocaleString()}
                </p>
              ) : null}
              {item.ownerComment ? (
                <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                  owner note: {item.ownerComment}
                </p>
              ) : null}
              {item.reviewComment ? (
                <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                  review note: {item.reviewComment}
                </p>
              ) : null}

              {canEdit ? (
                <form action={updateAction} className="mt-3 grid gap-3 rounded-md border p-3 md:grid-cols-4">
                  <input type="hidden" name="attestationId" value={item.id} />
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Status</label>
                    <select
                      name="status"
                      defaultValue={item.status}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                    >
                      {controlAttestationStatusOptions.map((status) => (
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
                    <label className="text-xs font-medium">Effectiveness</label>
                    <select
                      name="attestedEffectivenessStatus"
                      defaultValue={item.attestedEffectivenessStatus ?? ""}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                    >
                      <option value="">Not declared</option>
                      {controlEffectivenessOptions.map((status) => (
                        <option key={status} value={status}>
                          {toLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-medium">Owner comment</label>
                    <textarea
                      name="ownerComment"
                      defaultValue={item.ownerComment ?? ""}
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
                      Update attestation
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
