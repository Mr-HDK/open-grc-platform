"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  buildEvidenceMutation,
  buildEvidenceStoragePath,
  evidenceFormSchema,
  evidenceIdSchema,
} from "@/lib/validators/evidence";

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

function parseEvidencePayload(formData: FormData) {
  return evidenceFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    riskId: formData.get("riskId"),
    controlId: formData.get("controlId"),
    actionPlanId: formData.get("actionPlanId"),
  });
}

function getEvidenceFile(formData: FormData) {
  const fileValue = formData.get("file");

  if (!(fileValue instanceof File)) {
    return { error: "File is required.", file: null } as const;
  }

  if (!fileValue.size) {
    return { error: "Empty files are not allowed.", file: null } as const;
  }

  if (fileValue.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    return { error: "File exceeds the 25 MB limit.", file: null } as const;
  }

  return { error: null, file: fileValue } as const;
}

export async function createEvidenceAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");

  const parsed = parseEvidencePayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/evidence/new?error=${encodeMessage(parsed.error.issues[0]?.message ?? "Invalid evidence payload")}`,
    );
  }

  const fileResult = getEvidenceFile(formData);

  if (fileResult.error || !fileResult.file) {
    redirect(`/dashboard/evidence/new?error=${encodeMessage(fileResult.error ?? "Invalid file")}`);
  }

  const file = fileResult.file;
  const path = buildEvidenceStoragePath(profile.id, file.name);

  const supabase = await createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from("evidence")
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    redirect(`/dashboard/evidence/new?error=${encodeMessage(uploadError.message)}`);
  }

  const { error: insertError } = await supabase.from("evidence").insert(
    buildEvidenceMutation(
      parsed.data,
      {
        fileName: file.name,
        filePath: path,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      },
      profile.id,
    ),
  );

  if (insertError) {
    await supabase.storage.from("evidence").remove([path]);
    redirect(`/dashboard/evidence/new?error=${encodeMessage(insertError.message)}`);
  }

  redirect("/dashboard/evidence");
}

export async function archiveEvidenceAction(formData: FormData) {
  await requireSessionProfile("manager");

  const evidenceIdResult = evidenceIdSchema.safeParse(formData.get("evidenceId"));

  if (!evidenceIdResult.success) {
    redirect("/dashboard/evidence?error=invalid_id");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("evidence")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", evidenceIdResult.data)
    .is("archived_at", null);

  if (error) {
    redirect(`/dashboard/evidence?error=${encodeMessage(error.message)}`);
  }

  redirect("/dashboard/evidence");
}
