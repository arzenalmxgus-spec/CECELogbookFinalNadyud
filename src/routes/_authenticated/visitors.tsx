import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Pencil, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Pagination, usePagination } from "@/components/pagination-bar";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeUid } from "@/lib/rfid-service";
import type { Visitor } from "@/lib/types";
import {
  createVisitor,
  deleteVisitor,
  fetchLogs,
  fetchVisitors,
  queryKeys,
  updateVisitor,
} from "@/lib/visitor-service";

export const Route = createFileRoute("/_authenticated/visitors")({
  head: () => ({
    meta: [
      { title: "Visitors — Office Visitor Logbook" },
      { name: "description", content: "Manage visitor profiles and their assigned RFID cards." },
      { property: "og:title", content: "Visitors — Office Visitor Logbook" },
      { property: "og:description", content: "Manage visitor profiles and RFID card assignments." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VisitorsPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(120),
  rfid_uid: z.string().trim().max(64).optional().or(z.literal("")),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  contact_number: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
});

function VisitorsPage() {
  const queryClient = useQueryClient();
  const { data: visitors = [], isLoading } = useQuery({ queryKey: queryKeys.visitors, queryFn: fetchVisitors });
  const { data: logs = [] } = useQuery({ queryKey: queryKeys.logs, queryFn: fetchLogs });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Visitor | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Visitor | null>(null);
  const { page, setPage, slice } = usePagination(12);

  const visitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    logs.forEach((log) => counts.set(log.visitor_id, (counts.get(log.visitor_id) ?? 0) + 1));
    return counts;
  }, [logs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return visitors;
    return visitors.filter((visitor) =>
      [visitor.full_name, visitor.rfid_uid, visitor.company, visitor.email, visitor.contact_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [visitors, search]);

  const rows = slice(filtered);
  const open = creating || Boolean(editing);

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const parsed = schema.safeParse({
        full_name: form.get("full_name"),
        rfid_uid: form.get("rfid_uid"),
        company: form.get("company"),
        contact_number: form.get("contact_number"),
        email: form.get("email"),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const payload = {
        full_name: parsed.data.full_name,
        rfid_uid: parsed.data.rfid_uid ? normalizeUid(parsed.data.rfid_uid) : null,
        company: parsed.data.company || null,
        contact_number: parsed.data.contact_number || null,
        email: parsed.data.email || null,
      };
      if (editing) await updateVisitor(editing.id, payload);
      else await createVisitor(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visitors });
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
      setEditing(null);
      setCreating(false);
      toast.success("Visitor saved");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save visitor"),
  });

  const remove = useMutation({
    mutationFn: (visitor: Visitor) => deleteVisitor(visitor.id, visitor.full_name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visitors });
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
      setDeleting(null);
      toast.success("Visitor deleted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed"),
  });

  return (
    <AppShell
      title="Visitors"
      description={`${visitors.length} registered visitor profiles`}
      actions={
        <Button size="sm" onClick={() => { setEditing(null); setCreating(true); }}>
          <UserPlus className="size-4" /> New visitor
        </Button>
      }
    >
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 pr-9"
          maxLength={120}
          placeholder="Search name, RFID UID, program…"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => { setSearch(""); setPage(1); }}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <section className="surface-panel mt-6 overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No visitors found"
            description="Register a visitor here, or scan an unknown RFID card at the check-in desk."
            action={<Button size="sm" onClick={() => setCreating(true)}>Register a visitor</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full name</TableHead>
                    <TableHead>RFID UID</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Visits</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((visitor) => (
                    <TableRow key={visitor.id}>
                      <TableCell className="font-medium">{visitor.full_name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {visitor.rfid_uid ?? <span className="text-muted-foreground">No card</span>}
                      </TableCell>
                      <TableCell>{visitor.company ?? "—"}</TableCell>
                      <TableCell>
                        <span className="flex flex-col leading-tight">
                          <span>{visitor.contact_number ?? "—"}</span>
                          {visitor.email ? (
                            <span className="max-w-[220px] truncate text-xs text-muted-foreground">{visitor.email}</span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">{visitCounts.get(visitor.id) ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" aria-label="Edit visitor" onClick={() => { setCreating(false); setEditing(visitor); }}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Delete visitor" onClick={() => setDeleting(visitor)}>
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

      <Dialog open={open} onOpenChange={(next) => { if (!next) { setEditing(null); setCreating(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit visitor" : "Register visitor"}</DialogTitle>
          </DialogHeader>
          <form
            id="visitor-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="v-name">Full name *</Label>
              <Input id="v-name" name="full_name" defaultValue={editing?.full_name ?? ""} maxLength={120} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="v-rfid">RFID card UID</Label>
              <Input id="v-rfid" name="rfid_uid" defaultValue={editing?.rfid_uid ?? ""} maxLength={64} placeholder="Scan or type the card UID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-company">Program</Label>
              <Input id="v-company" name="company" defaultValue={editing?.company ?? ""} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-contact">Contact number</Label>
              <Input id="v-contact" name="contact_number" defaultValue={editing?.contact_number ?? ""} maxLength={40} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="v-email">Email</Label>
              <Input id="v-email" name="email" type="email" defaultValue={editing?.email ?? ""} maxLength={255} />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button>
            <Button type="submit" form="visitor-form" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save visitor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the visitor profile and every visit log linked to it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting)}>Delete visitor</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
