/**
 * Offline-first student records service.
 *
 * Reads always resolve from the IndexedDB mirror so the page works with no
 * connection. Writes go straight to PostgreSQL when online; otherwise they are
 * applied optimistically to the mirror and queued in the outbox, then replayed
 * automatically once the browser reports it is back online.
 */
import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/lib/audit";
import {
  OUTBOX_STORE,
  STUDENT_STORE,
  idbDelete,
  idbGetAll,
  idbPut,
  idbReplaceAll,
  type OutboxEntry,
} from "@/lib/offline-db";
import type { Student } from "@/lib/types";

export const studentKeys = {
  all: ["students"] as const,
  pending: ["students", "pending"] as const,
};

export interface StudentInput {
  full_name: string;
  program: string;
  year_level: number;
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(input: StudentInput): StudentInput {
  const full_name = input.full_name.trim();
  const program = input.program.trim();
  if (!full_name) throw new Error("Full name is required.");
  if (!program) throw new Error("Program is required.");
  if (!Number.isInteger(input.year_level) || input.year_level < 1 || input.year_level > 10) {
    throw new Error("Year level must be between 1 and 10.");
  }
  return { full_name, program, year_level: input.year_level };
}

async function queue(entry: Omit<OutboxEntry, "key" | "createdAt" | "entity">) {
  await idbPut<OutboxEntry>(OUTBOX_STORE, {
    entity: "students",
    ...entry,
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
  });
}

async function studentOutbox(): Promise<OutboxEntry[]> {
  const entries = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
  return entries.filter((entry) => (entry.entity ?? "students") === "students");
}

export async function pendingCount(): Promise<number> {
  const entries = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
  return entries.length;
}

/** Local mirror, sorted by name. */
async function localStudents(): Promise<Student[]> {
  const rows = await idbGetAll<Student>(STUDENT_STORE);
  return rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** Pulls the server copy into IndexedDB, preserving any records still queued. */
export async function refreshStudentCache(): Promise<void> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;

  const outbox = await studentOutbox();
  const pendingIds = new Set(outbox.map((entry) => entry.recordId));
  const local = await idbGetAll<Student>(STUDENT_STORE);
  const keepLocal = local.filter((row) => pendingIds.has(row.id));
  const server = ((data ?? []) as Student[]).filter((row) => !pendingIds.has(row.id));
  await idbReplaceAll<Student>(STUDENT_STORE, [...server, ...keepLocal]);
}

export async function fetchStudents(): Promise<Student[]> {
  if (isOnline()) {
    try {
      await refreshStudentCache();
    } catch {
      /* fall back to the cached mirror */
    }
  }
  return localStudents();
}

export async function createStudent(input: StudentInput): Promise<void> {
  const payload = normalize(input);

  if (isOnline()) {
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("students")
      .insert({ ...payload, created_by: auth.user?.id ?? null })
      .select("*")
      .single();
    if (error) throw error;
    await idbPut<Student>(STUDENT_STORE, data as Student);
    await recordAudit("student_created", `Added student "${payload.full_name}"`);
    return;
  }

  const record: Student = {
    id: newId(),
    ...payload,
    created_at: nowIso(),
    updated_at: nowIso(),
    _pending: true,
  };
  await idbPut<Student>(STUDENT_STORE, record);
  await queue({ op: "create", recordId: record.id, payload: record });
}

export async function updateStudent(id: string, input: StudentInput): Promise<void> {
  const payload = normalize(input);

  if (isOnline()) {
    const { error } = await supabase.from("students").update(payload).eq("id", id);
    if (error) throw error;
    const existing = (await idbGetAll<Student>(STUDENT_STORE)).find((row) => row.id === id);
    await idbPut<Student>(STUDENT_STORE, {
      ...(existing ?? { id, created_at: nowIso() }),
      ...payload,
      id,
      created_at: existing?.created_at ?? nowIso(),
      updated_at: nowIso(),
      _pending: false,
    });
    await recordAudit("student_updated", `Updated student "${payload.full_name}"`);
    return;
  }

  const existing = (await idbGetAll<Student>(STUDENT_STORE)).find((row) => row.id === id);
  await idbPut<Student>(STUDENT_STORE, {
    ...(existing ?? { id, created_at: nowIso() }),
    ...payload,
    id,
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
    _pending: true,
  });
  await queue({ op: "update", recordId: id, payload });
}

export async function deleteStudent(id: string, name: string): Promise<void> {
  if (isOnline()) {
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) throw error;
    await idbDelete(STUDENT_STORE, id);
    await recordAudit("student_deleted", `Deleted student "${name}"`);
    return;
  }

  await idbDelete(STUDENT_STORE, id);
  await queue({ op: "delete", recordId: id, payload: null });
}

let syncing: Promise<number> | null = null;

/** Replays queued mutations against PostgreSQL. Returns how many were applied. */
export async function syncPendingStudents(): Promise<number> {
  if (!isOnline()) return 0;
  if (syncing) return syncing;

  syncing = (async () => {
    const entries = (await studentOutbox()).sort((a, b) => a.createdAt - b.createdAt);
    let applied = 0;
    const { data: auth } = await supabase.auth.getUser();

    for (const entry of entries) {
      try {
        if (entry.op === "create") {
          const payload = entry.payload as Student;
          const { error } = await supabase.from("students").insert({
            full_name: payload.full_name,
            program: payload.program,
            year_level: payload.year_level,
            created_by: auth.user?.id ?? null,
          });
          if (error) throw error;
          await idbDelete(STUDENT_STORE, entry.recordId);
          await recordAudit("student_created", `Synced offline student "${payload.full_name}"`);
        } else if (entry.op === "update") {
          const payload = entry.payload as StudentInput;
          const { error } = await supabase.from("students").update(payload).eq("id", entry.recordId);
          if (error) throw error;
          await recordAudit("student_updated", `Synced offline edit for "${payload.full_name}"`);
        } else {
          const { error } = await supabase.from("students").delete().eq("id", entry.recordId);
          if (error) throw error;
          await recordAudit("student_deleted", "Synced offline student deletion");
        }
        await idbDelete(OUTBOX_STORE, entry.key);
        applied += 1;
      } catch {
        // Stop on the first failure so ordering is preserved; retried next time.
        break;
      }
    }

    if (applied > 0) {
      try {
        await refreshStudentCache();
      } catch {
        /* best-effort */
      }
    }
    return applied;
  })();

  try {
    return await syncing;
  } finally {
    syncing = null;
  }
}
