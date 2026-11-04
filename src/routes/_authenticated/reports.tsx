import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from "date-fns";
import { DoorOpen, FileBarChart, FileSpreadsheet, FileText, Timer, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState, StatusBadge } from "@/components/empty-state";
import { Pagination, usePagination } from "@/components/pagination-bar";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportCsv, exportExcel, exportPdf } from "@/lib/export-service";
import { formatDate, formatDuration, formatTime, summarize } from "@/lib/log-utils";
import { fetchLogs, queryKeys } from "@/lib/visitor-service";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Office Visitor Logbook" },
      { name: "description", content: "Generate and export visitor reports to Excel, PDF, or CSV for any period." },
      { property: "og:title", content: "Reports — Office Visitor Logbook" },
      { property: "og:description", content: "Export visitor reports to Excel, PDF, or CSV." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

type Preset = "today" | "yesterday" | "week" | "month" | "year" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
  { id: "custom", label: "Custom Range" },
];

function rangeFor(preset: Preset, customFrom: string, customTo: string) {
  const now = new Date();
  const iso = (date: Date) => format(date, "yyyy-MM-dd");
  switch (preset) {
    case "today":
      return { from: iso(now), to: iso(now) };
    case "yesterday":
      return { from: iso(subDays(now, 1)), to: iso(subDays(now, 1)) };
    case "week":
      return { from: iso(startOfWeek(now, { weekStartsOn: 1 })), to: iso(endOfWeek(now, { weekStartsOn: 1 })) };
    case "month":
      return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) };
    case "year":
      return { from: iso(startOfYear(now)), to: iso(endOfYear(now)) };
    default:
      return { from: customFrom || "0000-01-01", to: customTo || "9999-12-31" };
  }
}

function ReportsPage() {
  const { data: logs = [], isLoading } = useQuery({ queryKey: queryKeys.logs, queryFn: fetchLogs });
  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { page, setPage, slice } = usePagination(15);

  const range = rangeFor(preset, customFrom, customTo);
  const filtered = useMemo(
    () => logs.filter((log) => log.visit_date >= range.from && log.visit_date <= range.to),
    [logs, range.from, range.to],
  );
  const stats = summarize(filtered);
  const periodLabel =
    preset === "custom"
      ? `${customFrom || "start"} to ${customTo || "today"}`
      : PRESETS.find((item) => item.id === preset)!.label;
  const rows = slice(filtered);

  async function runExport(kind: "xlsx" | "pdf" | "csv") {
    if (filtered.length === 0) {
      toast.error("There are no records in this period to export.");
      return;
    }
    setBusy(kind);
    try {
      if (kind === "xlsx") await exportExcel(filtered, periodLabel);
      if (kind === "pdf") await exportPdf(filtered, periodLabel);
      if (kind === "csv") await exportCsv(filtered, periodLabel);
      toast.success(`Report exported (${kind.toUpperCase()})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Reports" description={`${filtered.length} visits in the selected period`}>
      <section className="surface-panel p-5">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={preset === item.id ? "default" : "outline"}
              onClick={() => { setPreset(item.id); setPage(1); }}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {preset === "custom" ? (
          <div className="mt-4 grid max-w-md gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
          <Button onClick={() => runExport("xlsx")} disabled={busy !== null}>
            <FileSpreadsheet className="size-4" /> Export Excel
          </Button>
          <Button variant="outline" onClick={() => runExport("pdf")} disabled={busy !== null}>
            <FileText className="size-4" /> Export PDF
          </Button>
          <Button variant="outline" onClick={() => runExport("csv")} disabled={busy !== null}>
            <FileBarChart className="size-4" /> Export CSV
          </Button>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Visitors" value={stats.total} icon={Users} loading={isLoading} />
        <StatCard label="Currently Inside" value={stats.inside} icon={DoorOpen} loading={isLoading} />
        <StatCard label="Average Visit Duration" value={formatDuration(stats.avgDuration)} icon={Timer} loading={isLoading} />
        <StatCard label="Most Common Purpose" value={stats.topPurpose} icon={FileBarChart} loading={isLoading} />
      </div>

      <section className="surface-panel mt-6 overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={FileBarChart} title="No visits in this period" description="Choose a different period or custom date range." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visitor</TableHead>
                    <TableHead>RFID UID</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Office visited</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.visitor?.full_name ?? "Unknown"}</TableCell>
                      <TableCell className="font-mono text-xs">{log.visitor?.rfid_uid ?? "—"}</TableCell>
                      <TableCell>{log.visitor?.company ?? "—"}</TableCell>
                      <TableCell>{log.office_to_visit}</TableCell>
                      <TableCell>{log.purpose}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(log.visit_date)}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatTime(log.time_in)}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatTime(log.time_out)}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatDuration(log.duration_minutes)}</TableCell>
                      <TableCell><StatusBadge status={log.status} /></TableCell>
                      <TableCell className="max-w-[220px] truncate">{log.remarks ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination total={filtered.length} pageSize={15} page={page} onPageChange={setPage} />
          </>
        )}
      </section>
    </AppShell>
  );
}
