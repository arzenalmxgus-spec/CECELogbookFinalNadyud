import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { isAfter, startOfMonth, startOfToday, subDays } from "date-fns";
import { ClipboardList, DoorOpen, LogIn, ScanLine, UserCheck, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { EmptyState, StatusBadge } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatTime, summarize } from "@/lib/log-utils";
import { fetchLogs, queryKeys } from "@/lib/visitor-service";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Office Visitor Logbook" },
      { name: "description", content: "Live visitor counts, trends, and recent activity for the office logbook." },
      { property: "og:title", content: "Dashboard — Office Visitor Logbook" },
      { property: "og:description", content: "Live visitor counts, trends, and recent activity." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function DashboardPage() {
  const { data: logs = [], isLoading } = useQuery({ queryKey: queryKeys.logs, queryFn: fetchLogs });

  const today = startOfToday();
  const weekStart = subDays(today, 6);
  const monthStart = startOfMonth(today);

  const inRange = (value: string, from: Date) => isAfter(new Date(value), from);
  const todayCount = logs.filter((log) => inRange(log.time_in, today)).length;
  const weekCount = logs.filter((log) => inRange(log.time_in, weekStart)).length;
  const monthCount = logs.filter((log) => inRange(log.time_in, monthStart)).length;
  const stats = summarize(logs);

  const trend = Array.from({ length: 7 }).map((_, index) => {
    const day = subDays(today, 6 - index);
    const next = subDays(today, 5 - index);
    return {
      day: day.toLocaleDateString(undefined, { weekday: "short" }),
      visits: logs.filter((log) => {
        const at = new Date(log.time_in);
        return at >= day && at < next;
      }).length,
    };
  });

  const purposes = stats.purposeCounts.slice(0, 5);
  const recent = logs.slice(0, 6);

  return (
    <AppShell
      title="Dashboard"
      description="Live overview of today's visitor activity"
      actions={
        <Button asChild size="sm">
          <Link to="/check-in">
            <ScanLine className="size-4" /> Register Visitor
          </Link>
        </Button>
      }
    >
      <div className="stagger-children grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visitors Today" value={todayCount} icon={LogIn} loading={isLoading} />
        <StatCard label="Visitors This Week" value={weekCount} icon={Users} loading={isLoading} hint="Last 7 days" />
        <StatCard label="Visitors This Month" value={monthCount} icon={ClipboardList} loading={isLoading} />
        <StatCard
          label="Currently Inside"
          value={stats.inside}
          icon={DoorOpen}
          loading={isLoading}
          hint={`Avg visit ${formatDuration(stats.avgDuration)}`}
        />
      </div>

      <div className="stagger-children mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="surface-panel hover-lift p-5">
          <h2 className="text-sm font-semibold">Visitor trend — last 7 days</h2>
          {isLoading ? (
            <Skeleton className="mt-4 h-64 w-full" />
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      color: "var(--color-popover-foreground)",
                    }}
                  />
                  <Bar dataKey="visits" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="surface-panel hover-lift p-5">
          <h2 className="text-sm font-semibold">Most common visit purposes</h2>
          {isLoading ? (
            <Skeleton className="mt-4 h-64 w-full" />
          ) : purposes.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No visits yet" description="Purposes appear once visits are recorded." />
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={purposes} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={3}>
                    {purposes.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      color: "var(--color-popover-foreground)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-3 space-y-1.5">
            {purposes.map((entry, index) => (
              <li key={entry.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                {entry.name}
                <span className="ml-auto tabular-nums text-foreground">{entry.value}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="surface-panel animate-rise mt-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Recent visitor logs</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/logbook">View logbook</Link>
          </Button>
        </div>
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="No visits recorded yet"
            description="Scan an RFID card at the front desk to record the first visit."
            action={
              <Button asChild size="sm">
                <Link to="/check-in">Scan a card</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors duration-200 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{log.visitor?.full_name ?? "Unknown visitor"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {log.office_to_visit} · {log.purpose}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  In {formatTime(log.time_in)} · Out {formatTime(log.time_out)}
                </p>
                <StatusBadge status={log.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
