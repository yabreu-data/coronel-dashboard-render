function parseSurveyDate(value: string): Date | null {
  const local = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (local) return new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]), Number(local[4] || 0), Number(local[5] || 0), Number(local[6] || 0));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isWithinDateRange(value: string, fromDate: string, toDate: string): boolean {
  const date = parseSurveyDate(value);
  if (!date) return false;
  const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
  const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
  if (from && to && from > to) return false;
  return (!from || date >= from) && (!to || date <= to);
}
