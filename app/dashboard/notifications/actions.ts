"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { syncReminderEvents } from "@/lib/notifications/sync";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

export async function runReminderSyncAction() {
  const profile = await requireSessionProfile("manager");
  let successMessage = "";

  try {
    const summary = await syncReminderEvents(profile.organizationId);
    successMessage = `${summary.upserted} refreshed, ${summary.resolved} resolved, ${summary.active} active reminders.`;
  } catch (error) {
    redirect(`/dashboard/notifications?error=${encodeMessage((error as Error).message)}`);
  }

  redirect(`/dashboard/notifications?success=${encodeURIComponent(successMessage)}`);
}
