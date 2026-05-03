import { NextResponse } from "next/server";

import { requireSessionProfile } from "@/lib/auth/profile";
import {
  getReportingPack,
  isReportingExportType,
  type ReportingExportRow,
} from "@/lib/reporting/packs";
import { reportingExportRequestSchema } from "@/lib/validators/reporting";

function escapeCsv(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);

  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
}

function toCsv(rows: ReportingExportRow[]) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  if (columns.length === 0) {
    return "";
  }

  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","));

  return [header, ...lines].join("\n");
}

function jsonResponse(payload: unknown, fileName: string) {
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename=${fileName}`,
    },
  });
}

function csvResponse(payload: string, fileName: string) {
  return new NextResponse(payload, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=${fileName}`,
    },
  });
}

const fileNames: Record<string, string> = {
  risks: "risks",
  issues: "issues",
  actions: "action-plans",
  findings: "findings",
  controls: "controls",
  control_health: "control-health",
  framework_gaps: "framework-gaps",
  vendors: "critical-vendors",
  policy_coverage: "policy-coverage",
  audits: "audit-engagements",
  report_pack: "report-pack",
};

export async function GET(request: Request) {
  const profile = await requireSessionProfile("manager");
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type");
  if (!isReportingExportType(type)) {
    return NextResponse.json({ error: "Invalid export type." }, { status: 400 });
  }

  const format = (searchParams.get("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "json") {
    return NextResponse.json({ error: "Invalid export format." }, { status: 400 });
  }

  const parsedRequest = reportingExportRequestSchema.safeParse({
    type,
    format,
    preset: searchParams.get("preset") ?? "management",
    ownerId: searchParams.get("owner"),
    horizonDays: searchParams.get("horizon") ?? 30,
    issueType: searchParams.get("issueType"),
    severity: searchParams.get("severity"),
    statusFocus: searchParams.get("statusFocus") ?? searchParams.get("status") ?? "all",
    savedViewId: searchParams.get("view"),
  });

  const hasSavedView = Boolean(searchParams.get("view"));
  if (!parsedRequest.success && !hasSavedView) {
    return NextResponse.json(
      { error: parsedRequest.error.issues[0]?.message ?? "Invalid export request." },
      { status: 400 },
    );
  }

  if (type === "report_pack") {
    if (format !== "json") {
      return NextResponse.json({ error: "Report packs are exported as JSON." }, { status: 400 });
    }

    const { pack } = await getReportingPack(profile, {
      preset: searchParams.get("preset") ?? undefined,
      owner: searchParams.get("owner") ?? undefined,
      horizon: searchParams.get("horizon") ?? undefined,
      issueType: searchParams.get("issueType") ?? undefined,
      severity: searchParams.get("severity") ?? undefined,
      statusFocus: searchParams.get("statusFocus") ?? searchParams.get("status") ?? undefined,
      view: searchParams.get("view") ?? undefined,
    });

    return jsonResponse(pack, `${pack.preset}-${fileNames.report_pack}.json`);
  }

  const { datasets } = await getReportingPack(profile, {
    preset: searchParams.get("preset") ?? undefined,
    owner: searchParams.get("owner") ?? undefined,
    horizon: searchParams.get("horizon") ?? undefined,
    issueType: searchParams.get("issueType") ?? undefined,
    severity: searchParams.get("severity") ?? undefined,
    statusFocus: searchParams.get("statusFocus") ?? searchParams.get("status") ?? undefined,
    view: searchParams.get("view") ?? undefined,
  });

  const rows = datasets[type];
  const fileStem = fileNames[type];

  if (format === "json") {
    return jsonResponse(rows, `${fileStem}.json`);
  }

  return csvResponse(toCsv(rows), `${fileStem}.csv`);
}
