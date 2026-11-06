export function getPreviousPeriod(fromDate: string, toDate: string): { from: Date; to: Date } | null {
  if (!fromDate || !toDate || fromDate > toDate) return null;
  const fromStart = new Date(`${fromDate}T00:00:00`);
  const toStart = new Date(`${toDate}T00:00:00`);
  const days = Math.round((toStart.getTime() - fromStart.getTime()) / 86400000) + 1;
  const previousTo = new Date(fromStart);
  previousTo.setDate(previousTo.getDate() - 1);
  previousTo.setHours(23, 59, 59, 999);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - days + 1);
  previousFrom.setHours(0, 0, 0, 0);
  return { from: previousFrom, to: previousTo };
}
