export type PriorityStatus = "pending" | "in_progress" | "done";
export type RankedPriority = { score: number; title: string };

export function sortPriorities<T extends RankedPriority>(items: T[], limit = 5): T[] {
  return [...items]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "es"))
    .slice(0, limit);
}

export function nextPriorityStatus(status: PriorityStatus): PriorityStatus {
  if (status === "pending") return "in_progress";
  if (status === "in_progress") return "done";
  return "pending";
}
