export type BirthdayCampaignMetricLog = {
  promotion: string | null;
  outcome: string;
  recoveryResult: string | null;
  promotionRedeemed: number;
  callDate?: Date | string;
};

export type BirthdayCampaignMetric = {
  name: string;
  offered: number;
  accepted: number;
  redeemed: number;
  acceptanceRate: number;
  redemptionRate: number;
};

export type BirthdayCampaignMonthMetric = BirthdayCampaignMetric & { month: string; label: string };

const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const isCampaignAccepted = (log: BirthdayCampaignMetricLog) =>
  normalize(`${log.outcome} ${log.recoveryResult ?? ""}`).includes("acept");

const summarizeLogs = (name: string, offeredLogs: BirthdayCampaignMetricLog[]): BirthdayCampaignMetric => {
  const accepted = offeredLogs.filter(isCampaignAccepted).length;
  const redeemed = offeredLogs.filter((log) => Boolean(log.promotionRedeemed)).length;
  const offered = offeredLogs.length;
  return { name, offered, accepted, redeemed, acceptanceRate: offered ? Math.round((accepted / offered) * 100) : 0, redemptionRate: offered ? Math.round((redeemed / offered) * 100) : 0 };
};
const metricFor = (name: string, logs: BirthdayCampaignMetricLog[]): BirthdayCampaignMetric => summarizeLogs(name, logs.filter((log) => log.promotion === name));

export function getBirthdayCampaignMetrics(campaignNames: string[], logs: BirthdayCampaignMetricLog[]): BirthdayCampaignMetric[] {
  const names = Array.from(new Set([...campaignNames.filter(Boolean), ...logs.map((log) => log.promotion).filter((name): name is string => Boolean(name))]));
  return names.map((name) => metricFor(name, logs)).sort((a, b) => b.redeemed - a.redeemed || b.accepted - a.accepted || b.offered - a.offered);
}

export function getBirthdayCampaignMonthlyMetrics(logs: BirthdayCampaignMetricLog[], campaignName?: string): BirthdayCampaignMonthMetric[] {
  const byMonth = new Map<string, BirthdayCampaignMetricLog[]>();
  logs.filter((log) => log.promotion && (!campaignName || log.promotion === campaignName)).forEach((log) => {
    const date = log.callDate instanceof Date ? log.callDate : new Date(log.callDate || "");
    if (Number.isNaN(date.getTime())) return;
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(month, [...(byMonth.get(month) ?? []), log]);
  });
  return Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, monthLogs]) => {
    const name = campaignName || "Todas las campañas";
    const metric = campaignName ? metricFor(campaignName, monthLogs) : summarizeLogs(name, monthLogs);
    return { ...metric, name, month, label: new Intl.DateTimeFormat("es-PE", { month: "short", year: "numeric" }).format(new Date(`${month}-01T12:00:00`)) };
  });
}
