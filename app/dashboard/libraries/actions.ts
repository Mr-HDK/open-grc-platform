"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { getLibraryBundle } from "@/lib/libraries/bundles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyLibraryBundleSchema } from "@/lib/validators/library-bundle";

type RiskRow = {
  id: string;
  title: string;
};

type ControlRow = {
  id: string;
  code: string;
};

type RiskControlRow = {
  risk_id: string;
  control_id: string;
};

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function toDateString(daysFromNow: number | null) {
  if (daysFromNow === null) {
    return null;
  }

  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

export async function applyLibraryBundleAction(formData: FormData) {
  const actor = await requireSessionProfile("admin");

  const parsed = applyLibraryBundleSchema.safeParse({
    bundleId: formData.get("bundleId"),
  });

  if (!parsed.success) {
    redirect(`/dashboard/libraries?error=${encodeMessage(parsed.error.issues[0]?.message)}`);
  }

  const bundle = getLibraryBundle(parsed.data.bundleId);

  if (!bundle) {
    redirect(`/dashboard/libraries?error=${encodeMessage("Selected bundle does not exist.")}`);
  }

  const supabase = await createSupabaseServerClient();

  const riskTitles = bundle.risks.map((risk) => risk.title);
  const controlCodes = bundle.controls.map((control) => control.code.toUpperCase());

  const [
    { data: existingRisks, error: existingRisksError },
    { data: existingControls, error: existingControlsError },
  ] = await Promise.all([
    riskTitles.length > 0
      ? supabase
          .from("risks")
          .select("id, title")
          .eq("organization_id", actor.organizationId)
          .is("deleted_at", null)
          .in("title", riskTitles)
          .returns<RiskRow[]>()
      : Promise.resolve({ data: [], error: null }),
    controlCodes.length > 0
      ? supabase
          .from("controls")
          .select("id, code")
          .eq("organization_id", actor.organizationId)
          .is("deleted_at", null)
          .in("code", controlCodes)
          .returns<ControlRow[]>()
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (existingRisksError || existingControlsError) {
    redirect(
      `/dashboard/libraries?error=${encodeMessage(
        existingRisksError?.message ?? existingControlsError?.message,
      )}`,
    );
  }

  const riskIdByTitle = new Map((existingRisks ?? []).map((risk) => [risk.title, risk.id]));
  const controlIdByCode = new Map(
    (existingControls ?? []).map((control) => [control.code.toUpperCase(), control.id]),
  );

  const risksToInsert = bundle.risks.filter((risk) => !riskIdByTitle.has(risk.title));
  const controlsToInsert = bundle.controls.filter(
    (control) => !controlIdByCode.has(control.code.toUpperCase()),
  );

  let insertedRisks = 0;
  let insertedControls = 0;
  let insertedLinks = 0;

  if (risksToInsert.length > 0) {
    const { data: insertedRiskRows, error: insertRisksError } = await supabase
      .from("risks")
      .insert(
        risksToInsert.map((risk) => ({
          organization_id: actor.organizationId,
          title: risk.title,
          description: risk.description,
          category: risk.category,
          owner_profile_id: actor.id,
          impact: risk.impact,
          likelihood: risk.likelihood,
          status: risk.status,
          due_date: toDateString(risk.dueInDays),
          created_by: actor.id,
          updated_by: actor.id,
        })),
      )
      .select("id, title")
      .returns<RiskRow[]>();

    if (insertRisksError) {
      redirect(`/dashboard/libraries?error=${encodeMessage(insertRisksError.message)}`);
    }

    for (const risk of insertedRiskRows ?? []) {
      riskIdByTitle.set(risk.title, risk.id);
      insertedRisks += 1;
    }
  }

  if (controlsToInsert.length > 0) {
    const { data: insertedControlRows, error: insertControlsError } = await supabase
      .from("controls")
      .insert(
        controlsToInsert.map((control) => ({
          organization_id: actor.organizationId,
          code: control.code.toUpperCase(),
          title: control.title,
          description: control.description,
          owner_profile_id: actor.id,
          control_type: control.controlType,
          review_frequency: control.reviewFrequency,
          effectiveness_status: control.effectivenessStatus,
          next_review_date: toDateString(control.nextReviewInDays),
          created_by: actor.id,
          updated_by: actor.id,
        })),
      )
      .select("id, code")
      .returns<ControlRow[]>();

    if (insertControlsError) {
      redirect(`/dashboard/libraries?error=${encodeMessage(insertControlsError.message)}`);
    }

    for (const control of insertedControlRows ?? []) {
      controlIdByCode.set(control.code.toUpperCase(), control.id);
      insertedControls += 1;
    }
  }

  const desiredLinks: RiskControlRow[] = [];

  for (const control of bundle.controls) {
    const controlId = controlIdByCode.get(control.code.toUpperCase());
    if (!controlId) {
      continue;
    }

    for (const riskTitle of control.linkedRiskTitles) {
      const riskId = riskIdByTitle.get(riskTitle);
      if (!riskId) {
        continue;
      }

      desiredLinks.push({
        risk_id: riskId,
        control_id: controlId,
      });
    }
  }

  const uniqueRiskIds = [...new Set(desiredLinks.map((row) => row.risk_id))];
  const uniqueControlIds = [...new Set(desiredLinks.map((row) => row.control_id))];

  const { data: existingLinks, error: existingLinksError } =
    uniqueRiskIds.length > 0 && uniqueControlIds.length > 0
      ? await supabase
          .from("risk_controls")
          .select("risk_id, control_id")
          .in("risk_id", uniqueRiskIds)
          .in("control_id", uniqueControlIds)
          .returns<RiskControlRow[]>()
      : { data: [], error: null };

  if (existingLinksError) {
    redirect(`/dashboard/libraries?error=${encodeMessage(existingLinksError.message)}`);
  }

  const existingLinkSet = new Set(
    (existingLinks ?? []).map((link) => `${link.risk_id}:${link.control_id}`),
  );

  const linksToInsert = desiredLinks.filter(
    (link) => !existingLinkSet.has(`${link.risk_id}:${link.control_id}`),
  );

  if (linksToInsert.length > 0) {
    const { error: insertLinksError } = await supabase.from("risk_controls").insert(linksToInsert);

    if (insertLinksError) {
      redirect(`/dashboard/libraries?error=${encodeMessage(insertLinksError.message)}`);
    }

    insertedLinks = linksToInsert.length;
  }

  const skippedRisks = bundle.risks.length - insertedRisks;
  const skippedControls = bundle.controls.length - insertedControls;
  const skippedLinks = desiredLinks.length - insertedLinks;

  redirect(
    `/dashboard/libraries?success=bundle_applied&bundle=${encodeURIComponent(bundle.name)}&risksInserted=${insertedRisks}&risksSkipped=${skippedRisks}&controlsInserted=${insertedControls}&controlsSkipped=${skippedControls}&linksInserted=${insertedLinks}&linksSkipped=${skippedLinks}`,
  );
}
