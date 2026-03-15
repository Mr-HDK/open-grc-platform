export function formatAuditCycleLabel(cycle: string) {
  return cycle === "semiannual" ? "Semiannual" : "Annual";
}

export function formatAuditPeriodLabel(planYear: number, cycle: string) {
  return `${formatAuditCycleLabel(cycle)} ${planYear}`;
}
