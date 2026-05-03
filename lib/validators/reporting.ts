import { z } from "zod";

import { issueSeverityOptions, issueTypeOptions } from "@/lib/validators/issue";

export const reportingPresetOptions = [
  "management",
  "audit_committee",
  "compliance",
] as const;

export const reportingHorizonOptions = [30, 60, 90, 180] as const;
export const reportingStatusFocusOptions = [
  "all",
  "attention_required",
  "overdue",
  "resolved",
] as const;

export const reportingExportTypeOptions = [
  "risks",
  "issues",
  "actions",
  "findings",
  "controls",
  "control_health",
  "framework_gaps",
  "vendors",
  "policy_coverage",
  "audits",
  "report_pack",
] as const;

export type ReportingPreset = (typeof reportingPresetOptions)[number];
export type ReportingHorizon = (typeof reportingHorizonOptions)[number];
export type ReportingStatusFocus = (typeof reportingStatusFocusOptions)[number];
export type ReportingExportType = (typeof reportingExportTypeOptions)[number];

const optionalUuidField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Identifier must be a valid UUID.",
  });

export const reportingFiltersSchema = z.object({
  preset: z.enum(reportingPresetOptions).default("management"),
  ownerId: optionalUuidField,
  horizonDays: z.coerce.number().refine((value) => reportingHorizonOptions.includes(value as ReportingHorizon), {
    message: "Horizon is invalid.",
  }),
  issueType: z
    .union([z.enum(issueTypeOptions), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
  severity: z
    .union([z.enum(issueSeverityOptions), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
  statusFocus: z.enum(reportingStatusFocusOptions).default("all"),
  savedViewId: optionalUuidField,
});

export const reportingSavedViewSchema = z.object({
  name: z.string().trim().min(3).max(120),
  preset: z.enum(reportingPresetOptions),
  ownerId: optionalUuidField,
  horizonDays: z.coerce.number().refine((value) => reportingHorizonOptions.includes(value as ReportingHorizon), {
    message: "Horizon is invalid.",
  }),
  issueType: z
    .union([z.enum(issueTypeOptions), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
  severity: z
    .union([z.enum(issueSeverityOptions), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
  statusFocus: z.enum(reportingStatusFocusOptions),
});

export const reportingSavedViewIdSchema = z.string().uuid("Saved view identifier is invalid.");

export const reportingExportRequestSchema = z.object({
  type: z.enum(reportingExportTypeOptions),
  format: z.enum(["csv", "json"]).default("csv"),
  preset: z.enum(reportingPresetOptions).default("management"),
  ownerId: optionalUuidField,
  horizonDays: z.coerce.number().refine((value) => reportingHorizonOptions.includes(value as ReportingHorizon), {
    message: "Horizon is invalid.",
  }),
  issueType: z
    .union([z.enum(issueTypeOptions), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
  severity: z
    .union([z.enum(issueSeverityOptions), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
  statusFocus: z.enum(reportingStatusFocusOptions).default("all"),
  savedViewId: optionalUuidField,
});

export type ReportingFiltersInput = z.infer<typeof reportingFiltersSchema>;
export type ReportingSavedViewInput = z.infer<typeof reportingSavedViewSchema>;
export type ReportingExportRequestInput = z.infer<typeof reportingExportRequestSchema>;
