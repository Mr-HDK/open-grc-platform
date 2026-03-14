import { NextResponse } from "next/server";

import { requireSessionProfile } from "@/lib/auth/profile";
import { getReportingPack } from "@/lib/reporting/packs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ExportType = "risks" | "controls" | "actions" | "findings" | "report_pack";

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type ControlRefRow = {
  id: string;
  code: string;
  title: string;
};

function escapeCsv(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);

  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]) {
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

export async function GET(request: Request) {
  const profile = await requireSessionProfile("manager");
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as ExportType | null;
  const format = (searchParams.get("format") ?? "csv").toLowerCase();

  if (!type || !["risks", "controls", "actions", "findings", "report_pack"].includes(type)) {
    return NextResponse.json({ error: "Invalid export type." }, { status: 400 });
  }

  if (type === "report_pack") {
    if (format !== "json") {
      return NextResponse.json({ error: "Report packs are exported as JSON." }, { status: 400 });
    }

    const { pack } = await getReportingPack(profile, {
      preset: searchParams.get("preset") ?? undefined,
      owner: searchParams.get("owner") ?? undefined,
      horizon: searchParams.get("horizon") ?? undefined,
    });

    return jsonResponse(pack, `${pack.preset}-report-pack.json`);
  }

  if (format !== "csv" && format !== "json") {
    return NextResponse.json({ error: "Invalid export format." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: owners, error: ownerError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("organization_id", profile.organizationId)
    .order("email")
    .returns<OwnerRow[]>();

  if (ownerError) {
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }

  const ownerById = new Map(
    (owners ?? []).map((owner) => [owner.id, owner.full_name ? owner.full_name : owner.email]),
  );
  const ownerEmailById = new Map((owners ?? []).map((owner) => [owner.id, owner.email]));

  if (type === "risks") {
    const { data: risks, error } = await supabase
      .from("risks")
      .select(
        "id, title, description, category, owner_profile_id, impact, likelihood, score, level, status, due_date, created_at, updated_at",
      )
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (risks ?? []).map((risk) => ({
      id: risk.id,
      title: risk.title,
      description: risk.description,
      category: risk.category,
      owner_name: risk.owner_profile_id ? ownerById.get(risk.owner_profile_id) ?? "" : "",
      owner_email: risk.owner_profile_id ? ownerEmailById.get(risk.owner_profile_id) ?? "" : "",
      impact: risk.impact,
      likelihood: risk.likelihood,
      score: risk.score,
      level: risk.level,
      status: risk.status,
      due_date: risk.due_date ?? "",
      created_at: risk.created_at,
      updated_at: risk.updated_at,
    }));

    if (format === "json") {
      return jsonResponse(rows, "risks.json");
    }

    return csvResponse(
      toCsv(rows, [
        "id",
        "title",
        "description",
        "category",
        "owner_name",
        "owner_email",
        "impact",
        "likelihood",
        "score",
        "level",
        "status",
        "due_date",
        "created_at",
        "updated_at",
      ]),
      "risks.csv",
    );
  }

  if (type === "controls") {
    const { data: controls, error } = await supabase
      .from("controls")
      .select(
        "id, code, title, description, control_type, review_frequency, effectiveness_status, owner_profile_id, next_review_date, created_at, updated_at",
      )
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (controls ?? []).map((control) => ({
      id: control.id,
      code: control.code,
      title: control.title,
      description: control.description,
      control_type: control.control_type,
      review_frequency: control.review_frequency,
      effectiveness_status: control.effectiveness_status,
      owner_name: control.owner_profile_id ? ownerById.get(control.owner_profile_id) ?? "" : "",
      owner_email: control.owner_profile_id ? ownerEmailById.get(control.owner_profile_id) ?? "" : "",
      next_review_date: control.next_review_date ?? "",
      created_at: control.created_at,
      updated_at: control.updated_at,
    }));

    if (format === "json") {
      return jsonResponse(rows, "controls.json");
    }

    return csvResponse(
      toCsv(rows, [
        "id",
        "code",
        "title",
        "description",
        "control_type",
        "review_frequency",
        "effectiveness_status",
        "owner_name",
        "owner_email",
        "next_review_date",
        "created_at",
        "updated_at",
      ]),
      "controls.csv",
    );
  }

  if (type === "actions") {
    const { data: actions, error } = await supabase
      .from("action_plans")
      .select(
        "id, title, description, owner_profile_id, status, priority, target_date, completed_at, risk_id, control_id, created_at, updated_at",
      )
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (actions ?? []).map((action) => ({
      id: action.id,
      title: action.title,
      description: action.description,
      owner_name: action.owner_profile_id ? ownerById.get(action.owner_profile_id) ?? "" : "",
      owner_email: action.owner_profile_id ? ownerEmailById.get(action.owner_profile_id) ?? "" : "",
      status: action.status,
      priority: action.priority,
      target_date: action.target_date,
      completed_at: action.completed_at ?? "",
      risk_id: action.risk_id ?? "",
      control_id: action.control_id ?? "",
      created_at: action.created_at,
      updated_at: action.updated_at,
    }));

    if (format === "json") {
      return jsonResponse(rows, "action-plans.json");
    }

    return csvResponse(
      toCsv(rows, [
        "id",
        "title",
        "description",
        "owner_name",
        "owner_email",
        "status",
        "priority",
        "target_date",
        "completed_at",
        "risk_id",
        "control_id",
        "created_at",
        "updated_at",
      ]),
      "action-plans.csv",
    );
  }

  const [{ data: findings, error }, { data: controls }] = await Promise.all([
    supabase
      .from("findings")
      .select(
        "id, title, description, owner_profile_id, status, severity, due_date, control_id, source_control_test_id, resolved_by_control_test_id, created_at, updated_at",
      )
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("controls")
      .select("id, code, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<ControlRefRow[]>(),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const controlById = new Map(
    (controls ?? []).map((control) => [control.id, `${control.code} - ${control.title}`]),
  );

  const rows = (findings ?? []).map((finding) => ({
    id: finding.id,
    title: finding.title,
    description: finding.description,
    control: controlById.get(finding.control_id) ?? finding.control_id,
    owner_name: finding.owner_profile_id ? ownerById.get(finding.owner_profile_id) ?? "" : "",
    owner_email: finding.owner_profile_id ? ownerEmailById.get(finding.owner_profile_id) ?? "" : "",
    status: finding.status,
    severity: finding.severity,
    due_date: finding.due_date ?? "",
    source_control_test_id: finding.source_control_test_id ?? "",
    resolved_by_control_test_id: finding.resolved_by_control_test_id ?? "",
    created_at: finding.created_at,
    updated_at: finding.updated_at,
  }));

  if (format === "json") {
    return jsonResponse(rows, "findings.json");
  }

  return csvResponse(
    toCsv(rows, [
      "id",
      "title",
      "description",
      "control",
      "owner_name",
      "owner_email",
      "status",
      "severity",
      "due_date",
      "source_control_test_id",
      "resolved_by_control_test_id",
      "created_at",
      "updated_at",
    ]),
    "findings.csv",
  );
}
