import { format, parseISO } from "date-fns";
import type { LogFilters, VisitorLogWithVisitor } from "@/lib/types";

export function formatTime(value: string | null): string {
  if (!value) return "—";
  return format(parseISO(value), "h:mm a");
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return format(parseISO(value), "MMM d, yyyy");
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function filterLogs(logs: VisitorLogWithVisitor[], filters: LogFilters) {
  const term = filters.search.trim().toLowerCase();

  const result = logs.filter((log) => {
    if (filters.status !== "all" && log.status !== filters.status) return false;
    if (filters.from && log.visit_date < filters.from) return false;
    if (filters.to && log.visit_date > filters.to) return false;
    if (filters.company !== "all" && (log.visitor?.company ?? "—") !== filters.company) return false;
    if (filters.office !== "all" && log.office_to_visit !== filters.office) return false;
    if (!term) return true;
    const haystack = [
      log.visitor?.full_name,
      log.visitor?.rfid_uid,
      log.visitor?.company,
      log.visitor?.email,
      log.office_to_visit,
      log.purpose,
      log.remarks,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  const sorted = [...result];
  switch (filters.sort) {
    case "oldest":
      sorted.sort((a, b) => a.time_in.localeCompare(b.time_in));
      break;
    case "name":
      sorted.sort((a, b) => (a.visitor?.full_name ?? "").localeCompare(b.visitor?.full_name ?? ""));
      break;
    case "time_in":
      sorted.sort((a, b) => b.time_in.localeCompare(a.time_in));
      break;
    case "time_out":
      sorted.sort((a, b) => (b.time_out ?? "").localeCompare(a.time_out ?? ""));
      break;
    default:
      sorted.sort((a, b) => b.time_in.localeCompare(a.time_in));
  }
  return sorted;
}

export function summarize(logs: VisitorLogWithVisitor[]) {
  const inside = logs.filter((log) => log.status === "inside").length;
  const durations = logs
    .map((log) => log.duration_minutes)
    .filter((value): value is number => typeof value === "number");
  const avgDuration = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : null;

  const purposeCounts = new Map<string, number>();
  logs.forEach((log) => purposeCounts.set(log.purpose, (purposeCounts.get(log.purpose) ?? 0) + 1));
  const topPurpose =
    [...purposeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return {
    total: logs.length,
    inside,
    avgDuration,
    topPurpose,
    purposeCounts: [...purposeCounts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  };
}
