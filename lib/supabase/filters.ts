function quotePostgrestValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildIlikeOrFilter(columns: string[], rawTerm: string) {
  const term = rawTerm.trim().replace(/\s+/g, " ");

  if (!term) {
    return null;
  }

  const pattern = quotePostgrestValue(`%${term}%`);
  return columns.map((column) => `${column}.ilike.${pattern}`).join(",");
}
