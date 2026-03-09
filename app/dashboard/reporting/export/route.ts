import { NextResponse } from "next/server";

import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export async function GET(request: Request) {
  await requireSessionProfile("manager");

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const format = (searchParams.get("format") ?? "csv").toLowerCase();

  if (type !== "risks" && type !== "controls") {
    return NextResponse.json({ error: "Invalid export type." }, { status: 400 });
  }

  if (format !== "csv" && format !== "json") {
    return NextResponse.json({ error: "Invalid export format." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: owners, error: ownerError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .order("email");

  if (ownerError) {
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }

  const ownerById = new Map(
    (owners ?? []).map((owner) => [owner.id, owner.full_name ? `${owner.full_name}` : owner.email]),
  );
  const ownerEmailById = new Map((owners ?? []).map((owner) => [owner.id, owner.email]));

  if (type === "risks") {
    const { data: risks, error } = await supabase
      .from("risks")
      .select(
        "id, title, description, category, owner_profile_id, impact, likelihood, score, level, status, due_date, created_at, updated_at",
      )
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
      return new NextResponse(JSON.stringify(rows, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=risks.json",
        },
      });
    }

    const csv = toCsv(rows, [
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
    ]);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=risks.csv",
      },
    });
  }

  const { data: controls, error } = await supabase
    .from("controls")
    .select(
      "id, code, title, description, control_type, review_frequency, effectiveness_status, owner_profile_id, next_review_date, created_at, updated_at",
    )
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
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=controls.json",
      },
    });
  }

  const csv = toCsv(rows, [
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
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=controls.csv",
    },
  });
}
