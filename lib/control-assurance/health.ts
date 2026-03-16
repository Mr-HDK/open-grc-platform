import type {
  ControlAttestationStatus,
  ControlEvidenceRequestStatus,
} from "@/lib/validators/control-assurance";

export type AssuranceHealth = "healthy" | "at_risk";

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function toLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function isPastDate(date: string | null | undefined, referenceDate = todayIso()) {
  return Boolean(date && date < referenceDate);
}

export function isOpenAttestation(status: ControlAttestationStatus) {
  return status !== "reviewed";
}

export function attestationDisplayStatus(input: {
  status: ControlAttestationStatus;
  dueDate: string;
  referenceDate?: string;
}) {
  if (input.status === "pending" && isPastDate(input.dueDate, input.referenceDate)) {
    return "overdue";
  }

  return input.status;
}

export function isOpenEvidenceRequest(status: ControlEvidenceRequestStatus) {
  return !["accepted", "waived"].includes(status);
}

export function evidenceRequestDisplayStatus(input: {
  status: ControlEvidenceRequestStatus;
  dueDate: string;
  referenceDate?: string;
}) {
  if (isOpenEvidenceRequest(input.status) && isPastDate(input.dueDate, input.referenceDate)) {
    return "overdue";
  }

  return input.status;
}

export function deriveControlAssuranceHealth(input: {
  overdueAttestations: number;
  overdueEvidenceRequests: number;
  openFindings: number;
  latestTestResult: string | null;
  effectivenessStatus: string;
}) {
  const atRisk =
    input.overdueAttestations > 0 ||
    input.overdueEvidenceRequests > 0 ||
    input.openFindings > 0 ||
    input.latestTestResult === "failed" ||
    input.latestTestResult === "partial" ||
    input.effectivenessStatus !== "effective";

  return (atRisk ? "at_risk" : "healthy") as AssuranceHealth;
}
