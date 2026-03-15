export function toUtcDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00.000Z`);
}

export function dayDifferenceFromToday(dateValue: string) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const target = toUtcDate(dateValue);
  return Math.floor((target.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
}

export function getIssueAgeDays(createdAt: string) {
  const created = new Date(createdAt);
  const today = new Date();
  const delta = today.getTime() - created.getTime();
  return Math.max(0, Math.floor(delta / (24 * 60 * 60 * 1000)));
}

export function isIssueOverdue(input: { status: string; dueDate: string | null }) {
  if (!input.dueDate) {
    return false;
  }

  if (["resolved", "closed"].includes(input.status)) {
    return false;
  }

  return dayDifferenceFromToday(input.dueDate) < 0;
}
