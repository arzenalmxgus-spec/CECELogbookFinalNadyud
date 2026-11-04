import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { GraduationCap, Pencil, Plus, Search, Trash2, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/log-utils";
import {
  createStudent,
  deleteStudent,
  studentKeys,
  updateStudent,
  fetchStudents,
} from "@/lib/student-service";
import { STUDENT_PROGRAMS, STUDENT_YEAR_LEVELS, formatYearLevel, type Student } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students — Office Visitor Logbook" },
      { name: "description", content: "Manage student records: programs, year levels, and enrolment details." },
      { property: "og:title", content: "Students — Office Visitor Logbook" },
      { property: "og:description", content: "Create, search, and manage student records — even offline." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentsPage,
});

const PAGE_SIZE = 12;

const schema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(120),
  program: z.string().trim().min(2, "Program is required").max(120),
  year_level: z.coerce.number().int().min(1, "Year level is required").max(10),
});

function StudentsPage() {
  const queryClient = useQueryClient();
  const { data: students = [], isLoading } = useQuery({
    queryKey: studentKeys.all,
    queryFn: fetchStudents,
  });

  const [search, setSearch] = useState("");
  const [program, setProgram] = useState("all");
  const [year, setYear] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [formProgram, setFormProgram] = useState<string>(STUDENT_PROGRAMS[0]);
  const [formYear, setFormYear] = useState<string>("1");
  const { page, setPage, slice } = usePagination(PAGE_SIZE);

  const programs = useMemo(() => {
    const set = new Set<string>(STUDENT_PROGRAMS);
    students.forEach((student) => set.add(student.program));
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((student) => {
      if (program !== "all" && student.program !== program) return false;
      if (year !== "all" && String(student.year_level) !== year) return false;
      if (!term) return true;
      return `${student.full_name} ${student.program} ${student.year_level}`.toLowerCase().includes(term);
    });
  }, [students, search, program, year]);

  const rows = slice(filtered);
  const dialogOpen = creating || Boolean(editing);

  function openCreate() {
    setEditing(null);
    setFormProgram(STUDENT_PROGRAMS[0]);
    setFormYear("1");
    setCreating(true);
  }

  function openEdit(student: Student) {
    setCreating(false);
    setFormProgram(student.program);
    setFormYear(String(student.year_level));
    setEditing(student);
  }

  function closeDialog() {
    setCreating(false);
    setEditing(null);
  }

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const parsed = schema.safeParse({
        full_name: form.get("full_name"),
        program: formProgram,
        year_level: formYear,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      if (editing) await updateStudent(editing.id, parsed.data);
      else await createStudent(parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.all });
      closeDialog();
      toast.success(navigator.onLine ? "Student saved" : "Saved offline — will sync when you reconnect");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save student"),
  });

  const remove = useMutation({
    mutationFn: (student: Student) => deleteStudent(student.id, student.full_name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.all });
      setDeleting(null);
      toast.success(navigator.onLine ? "Student deleted" : "Deleted offline — will sync when you reconnect");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed"),
  });

  return (
    <AppShell
      title="Students"
      description={`${students.length} student records`}
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> New student
        </Button>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 pr-9"
            maxLength={120}
            placeholder="Search name or program…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <Select
          value={program}
          onValueChange={(value) => {
            setProgram(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-56" aria-label="Filter by program">
            <SelectValue placeholder="All programs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            {programs.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={year}
          onValueChange={(value) => {
            setYear(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-40" aria-label="Filter by year level">
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {STUDENT_YEAR_LEVELS.map((level) => (
              <SelectItem key={level} value={String(level)}>
                {formatYearLevel(level)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {search || program !== "all" || year !== "all" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setProgram("all");
              setYear("all");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <section className="surface-panel mt-6 overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No students found"
            description="Add a student record, or adjust the search and filters above."
            action={
              <Button size="sm" onClick={openCreate}>
                Add a student
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full name</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Year level</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {student.full_name}
                          {student._pending ? (
                            <Badge variant="outline" className="text-[10px]">
                              Pending sync
                            </Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>{student.program}</TableCell>
                      <TableCell className="tabular-nums">{formatYearLevel(student.year_level)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(student.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Edit student"
                            onClick={() => openEdit(student)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete student"
                            onClick={() => setDeleting(student)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination total={filtered.length} pageSize={PAGE_SIZE} page={page} onPageChange={setPage} />
          </>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={(next) => (next ? null : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle>
          </DialogHeader>
          <form
            id="student-form"
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="s-name">Full name *</Label>
              <Input
                id="s-name"
                name="full_name"
                defaultValue={editing?.full_name ?? ""}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-program">Program *</Label>
              <Select value={formProgram} onValueChange={setFormProgram}>
                <SelectTrigger id="s-program">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-year">Year level *</Label>
              <Select value={formYear} onValueChange={setFormYear}>
                <SelectTrigger id="s-year">
                  <SelectValue placeholder="Select a year level" />
                </SelectTrigger>
                <SelectContent>
                  {STUDENT_YEAR_LEVELS.map((level) => (
                    <SelectItem key={level} value={String(level)}>
                      {formatYearLevel(level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} type="button">
              Cancel
            </Button>
            <Button form="student-form" type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(next) => (next ? null : setDeleting(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student record?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{deleting?.full_name}” from the student list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove.mutate(deleting)}
              disabled={remove.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
