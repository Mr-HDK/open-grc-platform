"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  frameworkControlIdSchema,
  frameworkRequirementIdsSchema,
} from "@/lib/validators/framework-mapping";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

type IdRow = {
  id: string;
};

export async function saveFrameworkMappingsAction(formData: FormData) {
  await requireSessionProfile("admin");

  const controlIdResult = frameworkControlIdSchema.safeParse(formData.get("controlId"));

  if (!controlIdResult.success) {
    redirect("/dashboard/frameworks?error=invalid_control_id");
  }

  const requirementIdsResult = frameworkRequirementIdsSchema.safeParse(
    formData.getAll("requirementIds").map((value) => String(value)),
  );

  if (!requirementIdsResult.success) {
    redirect(
      `/dashboard/frameworks?controlId=${controlIdResult.data}&error=${encodeMessage(requirementIdsResult.error.issues[0]?.message ?? "Invalid requirement ids")}`,
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: control } = await supabase
    .from("controls")
    .select("id")
    .eq("id", controlIdResult.data)
    .is("deleted_at", null)
    .maybeSingle<IdRow>();

  if (!control) {
    redirect(`/dashboard/frameworks?error=${encodeMessage("Selected control does not exist or is archived.")}`);
  }

  if (requirementIdsResult.data.length > 0) {
    const { data: requirements } = await supabase
      .from("framework_requirements")
      .select("id")
      .in("id", requirementIdsResult.data)
      .returns<IdRow[]>();

    if ((requirements ?? []).length !== requirementIdsResult.data.length) {
      redirect(
        `/dashboard/frameworks?controlId=${controlIdResult.data}&error=${encodeMessage("One or more framework requirements are invalid.")}`,
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("control_framework_mappings")
    .delete()
    .eq("control_id", controlIdResult.data);

  if (deleteError) {
    redirect(
      `/dashboard/frameworks?controlId=${controlIdResult.data}&error=${encodeMessage(deleteError.message)}`,
    );
  }

  if (requirementIdsResult.data.length > 0) {
    const { error: insertError } = await supabase.from("control_framework_mappings").insert(
      requirementIdsResult.data.map((requirementId) => ({
        control_id: controlIdResult.data,
        framework_requirement_id: requirementId,
      })),
    );

    if (insertError) {
      redirect(
        `/dashboard/frameworks?controlId=${controlIdResult.data}&error=${encodeMessage(insertError.message)}`,
      );
    }
  }

  redirect(`/dashboard/frameworks?controlId=${controlIdResult.data}&success=mappings_updated`);
}
