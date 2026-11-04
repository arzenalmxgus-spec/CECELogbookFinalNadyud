import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pendingCount, studentKeys, syncPendingStudents } from "@/lib/student-service";
import { queryKeys, syncPendingVisitorData } from "@/lib/visitor-service";

export type ConnectionState = "online" | "offline" | "syncing";

/**
 * Tracks connectivity plus the offline outbox, and replays queued student, visitor,
 * and visit log changes as soon as the connection returns.
 */
export function useSyncStatus() {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(async () => {
    setPending(await pendingCount());
  }, []);

  const runSync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSyncing(true);
    try {
      const students = await syncPendingStudents();
      if (students > 0) {
        await queryClient.invalidateQueries({ queryKey: studentKeys.all });
      }
      const visitorData = await syncPendingVisitorData();
      if (visitorData > 0) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.visitors });
        await queryClient.invalidateQueries({ queryKey: queryKeys.logs });
      }
    } finally {
      setSyncing(false);
      await refreshPending();
    }
  }, [queryClient, refreshPending]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshPending();
    void runSync();

    const handleOnline = () => {
      setOnline(true);
      void runSync();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const interval = window.setInterval(() => {
      void refreshPending();
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(interval);
    };
  }, [refreshPending, runSync]);

  const state: ConnectionState = !online ? "offline" : syncing || pending > 0 ? "syncing" : "online";

  return { state, online, pending, syncing, runSync, refreshPending };
}
