import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardList, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState, StatusBadge } from "@/components/empty-state";
import { Pagination, usePagination } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { filterLogs, formatDate, formatDuration, formatTime } from "@/lib/log-utils";
import { DEFAULT_LOG_FILTERS, type LogFilters, type VisitorLogWithVisitor } from "@/lib/types";
import { checkOutVisit, deleteLog, fetchLogs, queryKeys, updateLog } from "@/lib/visitor-service";

export const Route = createFileRoute("/_authenticated/logbook")({
  head: () => ({
    meta: [
      { title: "Visitor Logbook — Office Visitor Logbook" },
      { name: "description", content: "Search, filter, edit, and check out every recorded office visit." },
      { property: "og:title", content: "Visitor Logbook" },
      { property: "og:description", content: "Search, filter, edit, and check out office visits." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LogbookPage,
});

function LogbookPage() {
  const queryClient = useQueryClient();
  const { data: logs = [], isLoading } = useQuery({ queryKey: queryKeys.logs, queryFn: fetchLogs });
  const [filters, setFilters] = useState<LogFilters>(DEFAULT_LOG_FILTERS);
  const [editing, setEditing] = useState<VisitorLogWithVisitor | null>(null);
  const [deleting, setDeleting] = useState<VisitorLogWithVisitor | null>(null);
  const { page, setPage, slice } = usePagination(12);

  const companies = useMemo(
    () => [...new Set(logs.map((log) => log.visitor?.company ?? "—"))].sort(),
    [logs],
  );
  const offices = useMemo(() => [...new Set(logs.map((log) => log.office_to_visit))].sort(), [logs]);
  const filtered = useMemo(() => filterLogs(logs, filters), [logs, filters]);
  const rows = slice(filtered);
  const filtersActive =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.company !== "all" ||
    filters.office !== "all" ||
    filters.from !== null ||
    filters.to !== null ||
    filters.sort !== "newest";

  const patch = (next: Partial<LogFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  };

  const checkOut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => checkOutVisit(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
      toast.success("Visitor checked out");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Check-out failed"),
  });

  const save = useMutation({
    mutationFn: async (values: { office_to_visit: string; purpose: string; remarks: string }) => {
      if (!editing) return;
      await updateLog(editing.id, {
        office_to_visit: values.office_to_visit,
        purpose: values.purpose,
        remarks: values.remarks || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
      setEditing(null);
      toast.success("Visit log updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
      setDeleting(null);
      toast.success("Visit log deleted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed"),
  });

  return (
    <AppShell title="Visitor Logbook" description={`${filtered.length} matching visit records`}>
      <section className="surface-panel p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, RFID, program, office, purpose…"
              value={filters.search}
              maxLength={120}
              onChange={(event) => patch({ search: event.target.value })}
            />
          </div>
          <Select value={filters.status} onValueChange={(value) => patch({ status: value as LogFilters["status"] })}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="inside">Inside</SelectItem>
              <SelectItem value="checked_out">Checked out</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.company} onValueChange={(value) => patch({ company: value })}>
            <SelectTrigger><SelectValue placeholder="Program" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All programs</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company} value={company}>{company}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.office} onValueChange={(value) => patch({ office: value })}>
            <SelectTrigger><SelectValue placeholder="Office visited" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All offices</SelectItem>
              {offices.map((office) => (
                <SelectItem key={office} value={office}>{office}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">From date</Label>
            <Input type="date" value={filters.from ?? ""} onChange={(event) => patch({ from: event.target.value || null })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">To date</Label>
            <Input type="date" value={filters.to ?? ""} onChange={(event) => patch({ to: event.target.value || null })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sort by</Label>
            <Select value={filters.sort} onValueChange={(value) => patch({ sort: value as LogFilters["sort"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name">Visitor name</SelectItem>
                <SelectItem value="time_in">Time in</SelectItem>
                <SelectItem value="time_out">Time out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtersActive ? (
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setFilters(DEFAULT_LOG_FILTERS)}>
            Clear filters
          </Button>
        ) : null}
      </section>

      <section className="surface-panel mt-6 overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No visits match these filters" description="Try widening the date range or clearing the search." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visitor</TableHead>
                    <TableHead>Office visited</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Date &amp; time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        <span className="flex flex-col leading-tight">
                          {log.visitor?.full_name ?? "Unknown"}
                          <span className="text-xs font-normal text-muted-foreground">{log.visitor?.company ?? "—"}</span>
                        </span>
                      </TableCell>
                      <TableCell>{log.office_to_visit}</TableCell>
                      <TableCell>{log.purpose}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatDate(log.visit_date)} · {formatTime(log.time_in)}
                        {log.time_out ? ` – ${formatTime(log.time_out)}` : ""}
                        {log.duration_minutes ? (
                          <span className="text-muted-foreground"> · {formatDuration(log.duration_minutes)}</span>
                        ) : null}
                      </TableCell>
                      <TableCell><StatusBadge status={log.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {log.status === "inside" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={checkOut.isPending}
                              onClick={() => checkOut.mutate({ id: log.id, name: log.visitor?.full_name ?? "Visitor" })}
                            >
                              Check out
                            </Button>
                          ) : null}
                          <Button size="icon" variant="ghost" aria-label="Edit log" onClick={() => setEditing(log)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Delete log" onClick={() => setDeleting(log)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination total={filtered.length} pageSize={12} page={page} onPageChange={setPage} />
          </>
        )}
      </section>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit visit log</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              id="edit-log"
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                save.mutate({
                  office_to_visit: String(data.get("office_to_visit") ?? "").trim(),
                  purpose: String(data.get("purpose") ?? "").trim(),
                  remarks: String(data.get("remarks") ?? "").trim(),
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-office">Office or person visited</Label>
                <Input id="edit-office" name="office_to_visit" defaultValue={editing.office_to_visit} maxLength={120} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-purpose">Purpose</Label>
                <Input id="edit-purpose" name="purpose" defaultValue={editing.purpose} maxLength={120} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-remarks">Remarks</Label>
                <Textarea id="edit-remarks" name="remarks" defaultValue={editing.remarks ?? ""} rows={3} maxLength={500} />
              </div>
            </form>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" form="edit-log" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this visit log?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the visit record for {deleting?.visitor?.full_name ?? "this visitor"}. The
              visitor profile is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting.id)}>Delete log</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
