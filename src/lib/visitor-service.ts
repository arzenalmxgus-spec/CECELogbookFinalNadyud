/**
 * Offline-first visitor + visit log service.
 *
 * Reads resolve from the IndexedDB mirror so the logbook keeps working with no
 * connection. Writes go straight to PostgreSQL when online; otherwise they are
 * applied optimistically to the mirror and queued in the outbox, then replayed
 * automatically once the browser is back online.
 */
import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/lib/audit";
import {
  OUTBOX_STORE,
  VISITOR_STORE,
  VISIT_LOG_STORE,
  idbDelete,
  idbGetAll,
  idbPut,
  idbReplaceAll,
  type OutboxEntity,
  type OutboxEntry,
} from "@/lib/offline-db";
import type { AuditLog, Visitor, VisitorLogWithVisitor } from "@/lib/types";

const LOG_SELECT = "*, visitor:visitors(*)";

export const queryKeys = {
  visitors: ["visitors"] as const,
  logs: ["visitor-logs"] as const,
  audit: ["audit-logs"] as const,
};

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

async function queue(entity: OutboxEntity, op: OutboxEntry["op"], recordId: string, payload: unknown) {
  await idbPut<OutboxEntry>(OUTBOX_STORE, {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    entity,
    op,
    recordId,
    payload,
    createdAt: Date.now(),
  });
}

async function outboxFor(entity: OutboxEntity): Promise<OutboxEntry[]> {
  const entries = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
  return entries.filter((entry) => (entry.entity ?? "students") === entity).sort((a, b) => a.createdAt - b.createdAt);
}

async function localVisitors(): Promise<Visitor[]> {
  const rows = await idbGetAll<Visitor>(VISITOR_STORE);
  return rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

async function localLogs(): Promise<VisitorLogWithVisitor[]> {
  const rows = await idbGetAll<VisitorLogWithVisitor>(VISIT_LOG_STORE);
  const visitors = await idbGetAll<Visitor>(VISITOR_STORE);
  const byId = new Map(visitors.map((visitor) => [visitor.id, visitor]));
  return rows
    .map((row) => ({ ...row, visitor: row.visitor ?? byId.get(row.visitor_id) ?? null }))
    .sort((a, b) => b.time_in.localeCompare(a.time_in));
}

async function refreshVisitorCache(): Promise<void> {
  const { data, error } = await supabase.from("visitors").select("*").order("full_name", { ascending: true });
  if (error) throw error;
  const pendingIds = new Set((await outboxFor("visitors")).map((entry) => entry.recordId));
  const local = await idbGetAll<Visitor>(VISITOR_STORE);
  const keepLocal = local.filter((row) => pendingIds.has(row.id));
  const server = ((data ?? []) as Visitor[]).filter((row) => !pendingIds.has(row.id));
  await idbReplaceAll<Visitor>(VISITOR_STORE, [...server, ...keepLocal]);
}

async function refreshLogCache(): Promise<void> {
  const { data, error } = await supabase
    .from("visitor_logs")
    .select(LOG_SELECT)
    .order("time_in", { ascending: false })
    .limit(2000);
  if (error) throw error;
  const pendingIds = new Set((await outboxFor("visitor_logs")).map((entry) => entry.recordId));
  const local = await idbGetAll<VisitorLogWithVisitor>(VISIT_LOG_STORE);
  const keepLocal = local.filter((row) => pendingIds.has(row.id));
  const server = ((data ?? []) as unknown as VisitorLogWithVisitor[]).filter((row) => !pendingIds.has(row.id));
  await idbReplaceAll<VisitorLogWithVisitor>(VISIT_LOG_STORE, [...server, ...keepLocal]);
}

export async function fetchVisitors(): Promise<Visitor[]> {
  if (isOnline()) {
    try {
      await refreshVisitorCache();
    } catch {
      /* fall back to the cached mirror */
    }
  }
  return localVisitors();
}

export async function fetchLogs(): Promise<VisitorLogWithVisitor[]> {
  if (isOnline()) {
    try {
      await refreshLogCache();
    } catch {
      /* fall back to the cached mirror */
    }
  }
  return localLogs();
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as AuditLog[];
}

export async function findVisitorByRfid(uid: string): Promise<Visitor | null> {
  if (!isOnline()) {
    const visitors = await idbGetAll<Visitor>(VISITOR_STORE);
    return visitors.find((visitor) => visitor.rfid_uid === uid) ?? null;
  }
  const { data, error } = await supabase.from("visitors").select("*").eq("rfid_uid", uid).maybeSingle();
  if (error) throw error;
  return (data as Visitor) ?? null;
}

export interface VisitorInput {
  rfid_uid: string | null;
  full_name: string;
  company: string | null;
  contact_number: string | null;
  email: string | null;
}

export interface VisitInput {
  office_to_visit: string;
  purpose: string;
  remarks: string | null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

function normalizeVisitor<T extends Partial<VisitorInput>>(input: T): T {
  return {
    ...input,
    ...(input.full_name !== undefined ? { full_name: input.full_name.trim() } : {}),
    ...(input.rfid_uid !== undefined ? { rfid_uid: clean(input.rfid_uid)?.toUpperCase() ?? null } : {}),
    ...(input.company !== undefined ? { company: clean(input.company) } : {}),
    ...(input.contact_number !== undefined ? { contact_number: clean(input.contact_number) } : {}),
    ...(input.email !== undefined ? { email: clean(input.email)?.toLowerCase() ?? null } : {}),
  };
}

async function assertRfidAvailable(uid: string | null, ignoreId?: string) {
  if (!uid) return;
  if (!isOnline()) {
    const clash = (await idbGetAll<Visitor>(VISITOR_STORE)).find(
      (row) => row.rfid_uid === uid && row.id !== ignoreId,
    );
    if (clash) throw new Error(`That RFID card is already assigned to ${clash.full_name}.`);
    return;
  }
  const { data, error } = await supabase.from("visitors").select("id, full_name").eq("rfid_uid", uid);
  if (error) throw error;
  const clash = (data ?? []).find((row) => row.id !== ignoreId);
  if (clash) {
    throw new Error(`That RFID card is already assigned to ${clash.full_name}.`);
  }
}

export async function createVisitor(input: VisitorInput): Promise<Visitor> {
  const payload = normalizeVisitor(input) as VisitorInput;
  if (!payload.full_name) throw new Error("Full name is required.");
  await assertRfidAvailable(payload.rfid_uid);

  if (!isOnline()) {
    const record: Visitor = {
      id: newId(),
      ...payload,
      created_by: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      _pending: true,
    };
    await idbPut<Visitor>(VISITOR_STORE, record);
    await queue("visitors", "create", record.id, record);
    return record;
  }

  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("visitors")
    .insert({ ...payload, created_by: auth.user?.id ?? null })
    .select("*")
    .single();
  if (error) throw error;
  await idbPut<Visitor>(VISITOR_STORE, data as Visitor);
  await recordAudit("visitor_registered", `Registered visitor "${payload.full_name}"`);
  if (payload.rfid_uid) {
    await recordAudit("rfid_registered", `Linked RFID ${payload.rfid_uid} to "${payload.full_name}"`);
  }
  return data as Visitor;
}

async function patchLocalVisitor(id: string, patch: Partial<Visitor>) {
  const existing = (await idbGetAll<Visitor>(VISITOR_STORE)).find((row) => row.id === id);
  if (!existing) return;
  await idbPut<Visitor>(VISITOR_STORE, { ...existing, ...patch, id, updated_at: nowIso() });
}

export async function updateVisitor(id: string, input: Partial<VisitorInput>): Promise<void> {
  const payload = normalizeVisitor(input);
  if (payload.full_name !== undefined && !payload.full_name) throw new Error("Full name is required.");
  if (payload.rfid_uid !== undefined) await assertRfidAvailable(payload.rfid_uid ?? null, id);

  if (!isOnline()) {
    await patchLocalVisitor(id, { ...payload, _pending: true });
    await queue("visitors", "update", id, payload);
    return;
  }

  const { error } = await supabase.from("visitors").update(payload).eq("id", id);
  if (error) throw error;
  await patchLocalVisitor(id, { ...payload, _pending: false });
  await recordAudit("visitor_updated", `Updated visitor profile ${payload.full_name ?? id}`);
}

export async function deleteVisitor(id: string, name: string): Promise<void> {
  if (!isOnline()) {
    const logs = await idbGetAll<VisitorLogWithVisitor>(VISIT_LOG_STORE);
    await Promise.all(logs.filter((log) => log.visitor_id === id).map((log) => idbDelete(VISIT_LOG_STORE, log.id)));
    await idbDelete(VISITOR_STORE, id);
    await queue("visitors", "delete", id, null);
    return;
  }

  const { error } = await supabase.from("visitors").delete().eq("id", id);
  if (error) throw error;
  await idbDelete(VISITOR_STORE, id);
  await recordAudit("visitor_deleted", `Deleted visitor "${name}" and their visit history`);
}

export async function checkInVisitor(visitorId: string, visit: VisitInput): Promise<void> {
  const office = visit.office_to_visit.trim();
  const purpose = visit.purpose.trim();
  if (!office) throw new Error("Office to visit is required.");
  if (!purpose) throw new Error("Purpose of visit is required.");

  if (!isOnline()) {
    const logs = await idbGetAll<VisitorLogWithVisitor>(VISIT_LOG_STORE);
    if (logs.some((log) => log.visitor_id === visitorId && !log.time_out)) {
      throw new Error("This visitor already has an open visit that has not been checked out.");
    }
    const visitor = (await idbGetAll<Visitor>(VISITOR_STORE)).find((row) => row.id === visitorId) ?? null;
    const timeIn = nowIso();
    const record: VisitorLogWithVisitor = {
      id: newId(),
      visitor_id: visitorId,
      office_to_visit: office,
      purpose,
      remarks: clean(visit.remarks),
      visit_date: timeIn.slice(0, 10),
      time_in: timeIn,
      time_out: null,
      duration_minutes: null,
      status: "inside",
      created_by: null,
      created_at: timeIn,
      updated_at: timeIn,
      visitor,
      _pending: true,
    };
    await idbPut<VisitorLogWithVisitor>(VISIT_LOG_STORE, record);
    await queue("visitor_logs", "create", record.id, {
      visitor_id: visitorId,
      office_to_visit: office,
      purpose,
      remarks: record.remarks,
      time_in: timeIn,
    });
    return;
  }

  const { data: open, error: openError } = await supabase
    .from("visitor_logs")
    .select("id")
    .eq("visitor_id", visitorId)
    .is("time_out", null)
    .limit(1);
  if (openError) throw openError;
  if (open && open.length > 0) {
    throw new Error("This visitor already has an open visit that has not been checked out.");
  }

  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("visitor_logs").insert({
    visitor_id: visitorId,
    office_to_visit: office,
    purpose,
    remarks: clean(visit.remarks),
    created_by: auth.user?.id ?? null,
  });
  if (error) throw error;
  await recordAudit("visit_checked_in", `Checked in visitor ${visitorId} to ${office}`);
}

async function patchLocalLog(id: string, patch: Partial<VisitorLogWithVisitor>) {
  const existing = (await idbGetAll<VisitorLogWithVisitor>(VISIT_LOG_STORE)).find((row) => row.id === id);
  if (!existing) return;
  await idbPut<VisitorLogWithVisitor>(VISIT_LOG_STORE, { ...existing, ...patch, id, updated_at: nowIso() });
}

export async function checkOutVisit(logId: string, visitorName: string): Promise<void> {
  const timeOut = nowIso();

  if (!isOnline()) {
    const existing = (await idbGetAll<VisitorLogWithVisitor>(VISIT_LOG_STORE)).find((row) => row.id === logId);
    const minutes = existing
      ? Math.max(0, Math.round((Date.parse(timeOut) - Date.parse(existing.time_in)) / 60000))
      : null;
    await patchLocalLog(logId, {
      time_out: timeOut,
      duration_minutes: minutes,
      status: "checked_out",
      _pending: true,
    });
    await queue("visitor_logs", "update", logId, { time_out: timeOut });
    return;
  }

  const { error } = await supabase.from("visitor_logs").update({ time_out: timeOut }).eq("id", logId);
  if (error) throw error;
  await recordAudit("visit_checked_out", `Checked out "${visitorName}"`);
}

export async function updateLog(logId: string, patch: Partial<VisitInput>): Promise<void> {
  if (!isOnline()) {
    await patchLocalLog(logId, { ...patch, _pending: true });
    await queue("visitor_logs", "update", logId, patch);
    return;
  }

  const { error } = await supabase.from("visitor_logs").update(patch).eq("id", logId);
  if (error) throw error;
  await recordAudit("log_updated", `Updated visit log ${logId}`);
}

export async function deleteLog(logId: string): Promise<void> {
  if (!isOnline()) {
    await idbDelete(VISIT_LOG_STORE, logId);
    await queue("visitor_logs", "delete", logId, null);
    return;
  }

  const { error } = await supabase.from("visitor_logs").delete().eq("id", logId);
  if (error) throw error;
  await idbDelete(VISIT_LOG_STORE, logId);
  await recordAudit("log_deleted", `Deleted visit log ${logId}`);
}

let syncing: Promise<number> | null = null;

/** Replays queued visitor + visit log mutations. Returns how many were applied. */
export async function syncPendingVisitorData(): Promise<number> {
  if (!isOnline()) return 0;
  if (syncing) return syncing;

  syncing = (async () => {
    const { data: auth } = await supabase.auth.getUser();
    const createdBy = auth.user?.id ?? null;
    // Visitors first so any queued visit log can reference a synced visitor row.
    const entries = [...(await outboxFor("visitors")), ...(await outboxFor("visitor_logs"))];
    let applied = 0;

    for (const entry of entries) {
      const entity = (entry.entity ?? "students") as OutboxEntity;
      const table = entity === "visitors" ? "visitors" : "visitor_logs";
      try {
        if (entry.op === "create") {
          const payload = (entry.payload ?? {}) as Record<string, unknown>;
          if (entity === "visitors") {
            const visitor = payload as unknown as Visitor;
            const { error } = await supabase.from("visitors").insert({
              id: visitor.id,
              rfid_uid: visitor.rfid_uid,
              full_name: visitor.full_name,
              company: visitor.company,
              contact_number: visitor.contact_number,
              email: visitor.email,
              created_by: createdBy,
            });
            if (error) throw error;
            await recordAudit("visitor_registered", `Synced offline visitor "${visitor.full_name}"`);
          } else {
            const logInsert = { ...payload, created_by: createdBy } as unknown as {
              visitor_id: string;
              office_to_visit: string;
              purpose: string;
            };
            const { error } = await supabase.from("visitor_logs").insert(logInsert);
            if (error) throw error;
            await recordAudit("visit_checked_in", "Synced offline check-in");
          }
        } else if (entry.op === "update") {
          const { error } = await supabase
            .from(table)
            .update(entry.payload as never)
            .eq("id", entry.recordId);
          if (error) throw error;
          await recordAudit(
            entity === "visitors" ? "visitor_updated" : "log_updated",
            "Synced offline edit",
          );
        } else {
          const { error } = await supabase.from(table).delete().eq("id", entry.recordId);
          if (error) throw error;
          await recordAudit(
            entity === "visitors" ? "visitor_deleted" : "log_deleted",
            "Synced offline deletion",
          );
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
        await refreshVisitorCache();
        await refreshLogCache();
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
