"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  buildEvidenceMutation,
  buildEvidenceStoragePath,
  evidenceFormSchema,
  evidenceIdSchema,
} from "@/lib/validators/evidence";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
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

type IdRow = {
  id: string;
};

async function validateEvidenceLinks(input: {
  riskId: string | null;
  controlId: string | null;
  actionPlanId: string | null;
}) {
  const supabase = await createSupabaseServerClient();

  if (input.riskId) {
    const { data: risk } = await supabase
      .from("risks")
      .select("id")
      .eq("id", input.riskId)
      .is("deleted_at", null)
      .maybeSingle<IdRow>();

    if (!risk) {
      return "Selected risk does not exist or is archived.";
    }
  }

  if (input.controlId) {
    const { data: control } = await supabase
      .from("controls")
      .select("id")
      .eq("id", input.controlId)
      .is("deleted_at", null)
      .maybeSingle<IdRow>();

    if (!control) {
      return "Selected control does not exist or is archived.";
    }
  }

  if (input.actionPlanId) {
    const { data: actionPlan } = await supabase
      .from("action_plans")
      .select("id")
      .eq("id", input.actionPlanId)
      .is("deleted_at", null)
      .maybeSingle<IdRow>();

    if (!actionPlan) {
      return "Selected action plan does not exist or is archived.";
    }
  }

  return null;
}

export async function createEvidenceAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");

  const parsed = parseEvidencePayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/evidence/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted evidence fields are invalid.")}`,
    );
  }

  const fileResult = getEvidenceFile(formData);

  if (fileResult.error || !fileResult.file) {
    redirect(`/dashboard/evidence/new?error=${encodeMessage(fileResult.error, "Invalid file.")}`);
  }

  const linksError = await validateEvidenceLinks(parsed.data);

  if (linksError) {
    redirect(`/dashboard/evidence/new?error=${encodeMessage(linksError)}`);
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
