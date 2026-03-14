import { queryDirect } from "@/lib/db/direct";

export type ReminderSyncSummary = {
  upserted: number;
  resolved: number;
  active: number;
};

type SummaryRow = {
  summary: ReminderSyncSummary | null;
};

function normalizeSummary(value: ReminderSyncSummary | null | undefined): ReminderSyncSummary {
  return {
    upserted: typeof value?.upserted === "number" ? value.upserted : 0,
    resolved: typeof value?.resolved === "number" ? value.resolved : 0,
    active: typeof value?.active === "number" ? value.active : 0,
  };
}

export async function syncReminderEvents(targetOrganizationId?: string | null) {
  const result = await queryDirect<SummaryRow>(
    "select public.sync_notification_events($1::uuid) as summary",
    [targetOrganizationId ?? null],
  );

  return normalizeSummary(result.rows[0]?.summary);
}
