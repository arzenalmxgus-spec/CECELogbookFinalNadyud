import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Pagination, usePagination } from "@/components/pagination-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAuditLogs, queryKeys } from "@/lib/visitor-service";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — Office Visitor Logbook" },
      { name: "description", content: "Every administrator action recorded with a timestamp." },
      { property: "og:title", content: "Audit Trail — Office Visitor Logbook" },
      { property: "og:description", content: "Administrator activity history for the visitor logbook." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditPage,
});

const LABELS: Record<string, string> = {
  login: "Sign in",
  logout: "Sign out",
  password_change: "Password change",
  visitor_registered: "Visitor registered",
  rfid_registered: "RFID registered",
  visitor_updated: "Visitor updated",
  visitor_deleted: "Visitor deleted",
  visit_checked_in: "Check in",
  visit_checked_out: "Check out",
  log_updated: "Log updated",
  log_deleted: "Log deleted",
  export_excel: "Excel export",
  export_pdf: "PDF export",
  export_csv: "CSV export",
};

function AuditPage() {
  const { data: entries = [], isLoading } = useQuery({ queryKey: queryKeys.audit, queryFn: fetchAuditLogs });
  const { page, setPage, slice } = usePagination(20);
  const rows = slice(entries);

  return (
    <AppShell title="Audit Trail" description="Administrator actions recorded across the system">
      <section className="surface-panel overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-11 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No activity recorded yet" description="Administrator actions appear here as soon as they happen." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Administrator</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {format(parseISO(entry.created_at), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>{entry.admin_email ?? "—"}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {LABELS[entry.action] ?? entry.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entry.description ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination total={entries.length} pageSize={20} page={page} onPageChange={setPage} />
          </>
        )}
      </section>
    </AppShell>
  );
}
