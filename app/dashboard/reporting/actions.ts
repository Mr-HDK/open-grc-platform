"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildControlMutation, controlFormSchema } from "@/lib/validators/control";
import { buildRiskMutation, riskFormSchema } from "@/lib/validators/risk";

const MAX_FILE_SIZE_BYTES = 1_000_000;
const MAX_ROWS = 200;

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeRow(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    output[normalizeKey(key)] = value;
  }

  return output;
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = lines[0].split(",").map((header) => normalizeKey(header));

  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      row[header] = cells[index]?.trim() ?? "";
    });

    return row;
  });
}

function parseJson(text: string) {
  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("JSON import expects an array of objects.");
  }

  return parsed.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Each JSON row must be an object.");
    }

    return normalizeRow(row as Record<string, unknown>);
  });
}

function parseRows(text: string, format: string, fileName: string) {
  const lowerFormat = format.toLowerCase();

  if (lowerFormat === "json") {
    return parseJson(text);
  }

  if (lowerFormat === "csv") {
    return parseCsv(text);
  }

  if (fileName.toLowerCase().endsWith(".json")) {
    return parseJson(text);
  }

  return parseCsv(text);
}

function getRowValue(row: Record<string, unknown>, key: string) {
  const value = row[key];

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

export async function importRisksAction(formData: FormData) {
  const actor = await requireSessionProfile("manager");
  const file = formData.get("file");
  const format = String(formData.get("format") ?? "auto");

  if (!(file instanceof File)) {
    redirect(`/dashboard/reporting?error=${encodeMessage("Provide a CSV or JSON file.")}`);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    redirect(`/dashboard/reporting?error=${encodeMessage("File is too large (max 1MB).")}`);
  }

  const text = await file.text();

  let rows: Record<string, unknown>[] = [];

  try {
    rows = parseRows(text, format, file.name).map((row) => normalizeRow(row));
  } catch (error) {
    redirect(`/dashboard/reporting?error=${encodeMessage((error as Error).message)}`);
  }

  if (rows.length === 0) {
    redirect(`/dashboard/reporting?error=${encodeMessage("No rows found to import.")}`);
  }

  if (rows.length > MAX_ROWS) {
    redirect(`/dashboard/reporting?error=${encodeMessage(`Limit imports to ${MAX_ROWS} rows at a time.`)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: owners, error: ownerError } = await supabase
    .from("profiles")
    .select("id, email")
    .order("email");

  if (ownerError) {
    redirect(`/dashboard/reporting?error=${encodeMessage(ownerError.message)}`);
  }

  const ownerByEmail = new Map(
    (owners ?? [])
      .filter((owner) => owner.email)
      .map((owner) => [owner.email.toLowerCase(), owner.id]),
  );

  const errors: string[] = [];
  const records = rows.map((row, index) => {
    const ownerEmail = getRowValue(row, "owner_email") || getRowValue(row, "owner");
    const ownerProfileId = ownerEmail ? ownerByEmail.get(ownerEmail.toLowerCase()) ?? null : null;

    if (ownerEmail && !ownerProfileId) {
      errors.push(`Row ${index + 2}: owner email not found (${ownerEmail}).`);
      return null;
    }

    const parsed = riskFormSchema.safeParse({
      title: getRowValue(row, "title"),
      description: getRowValue(row, "description"),
      category: getRowValue(row, "category"),
      ownerProfileId,
      impact: getRowValue(row, "impact"),
      likelihood: getRowValue(row, "likelihood"),
      status: getRowValue(row, "status"),
      dueDate: getRowValue(row, "due_date"),
    });

    if (!parsed.success) {
      errors.push(`Row ${index + 2}: ${parsed.error.issues[0]?.message ?? "Invalid data."}`);
      return null;
    }

    const mutation = buildRiskMutation(parsed.data, actor.id);

    return {
      ...mutation,
      organization_id: actor.organizationId,
      created_by: actor.id,
    };
  });

  if (errors.length > 0) {
    redirect(`/dashboard/reporting?error=${encodeMessage(`${errors[0]} (${errors.length} errors)`)}`);
  }

  const filteredRecords = records.filter(Boolean) as Record<string, unknown>[];

  if (filteredRecords.length === 0) {
    redirect(`/dashboard/reporting?error=${encodeMessage("No valid rows to import.")}`);
  }

  const { error: insertError } = await supabase.from("risks").insert(filteredRecords);

  if (insertError) {
    redirect(`/dashboard/reporting?error=${encodeMessage(insertError.message)}`);
  }

  redirect(`/dashboard/reporting?success=${encodeURIComponent(`Imported ${filteredRecords.length} risks.`)}`);
}

export async function importControlsAction(formData: FormData) {
  const actor = await requireSessionProfile("manager");
  const file = formData.get("file");
  const format = String(formData.get("format") ?? "auto");

  if (!(file instanceof File)) {
    redirect(`/dashboard/reporting?error=${encodeMessage("Provide a CSV or JSON file.")}`);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    redirect(`/dashboard/reporting?error=${encodeMessage("File is too large (max 1MB).")}`);
  }

  const text = await file.text();

  let rows: Record<string, unknown>[] = [];

  try {
    rows = parseRows(text, format, file.name).map((row) => normalizeRow(row));
  } catch (error) {
    redirect(`/dashboard/reporting?error=${encodeMessage((error as Error).message)}`);
  }

  if (rows.length === 0) {
    redirect(`/dashboard/reporting?error=${encodeMessage("No rows found to import.")}`);
  }

  if (rows.length > MAX_ROWS) {
    redirect(`/dashboard/reporting?error=${encodeMessage(`Limit imports to ${MAX_ROWS} rows at a time.`)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: owners, error: ownerError } = await supabase
    .from("profiles")
    .select("id, email")
    .order("email");

  if (ownerError) {
    redirect(`/dashboard/reporting?error=${encodeMessage(ownerError.message)}`);
  }

  const ownerByEmail = new Map(
    (owners ?? [])
      .filter((owner) => owner.email)
      .map((owner) => [owner.email.toLowerCase(), owner.id]),
  );

  const errors: string[] = [];
  const records = rows.map((row, index) => {
    const ownerEmail = getRowValue(row, "owner_email") || getRowValue(row, "owner");
    const ownerProfileId = ownerEmail ? ownerByEmail.get(ownerEmail.toLowerCase()) ?? null : null;

    if (ownerEmail && !ownerProfileId) {
      errors.push(`Row ${index + 2}: owner email not found (${ownerEmail}).`);
      return null;
    }

    const parsed = controlFormSchema.safeParse({
      code: getRowValue(row, "code"),
      title: getRowValue(row, "title"),
      description: getRowValue(row, "description"),
      controlType: getRowValue(row, "control_type"),
      reviewFrequency: getRowValue(row, "review_frequency"),
      effectivenessStatus: getRowValue(row, "effectiveness_status"),
      ownerProfileId,
      nextReviewDate: getRowValue(row, "next_review_date"),
    });

    if (!parsed.success) {
      errors.push(`Row ${index + 2}: ${parsed.error.issues[0]?.message ?? "Invalid data."}`);
      return null;
    }

    const mutation = buildControlMutation(parsed.data, actor.id);

    return {
      ...mutation,
      organization_id: actor.organizationId,
      created_by: actor.id,
    };
  });

  if (errors.length > 0) {
    redirect(`/dashboard/reporting?error=${encodeMessage(`${errors[0]} (${errors.length} errors)`)}`);
  }

  const filteredRecords = records.filter(Boolean) as Record<string, unknown>[];

  if (filteredRecords.length === 0) {
    redirect(`/dashboard/reporting?error=${encodeMessage("No valid rows to import.")}`);
  }

  const { error: insertError } = await supabase.from("controls").insert(filteredRecords);

  if (insertError) {
    redirect(`/dashboard/reporting?error=${encodeMessage(insertError.message)}`);
  }

  redirect(`/dashboard/reporting?success=${encodeURIComponent(`Imported ${filteredRecords.length} controls.`)}`);
}
