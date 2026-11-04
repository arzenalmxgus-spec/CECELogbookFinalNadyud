import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/visitor-service";

/**
 * Keeps every open screen in sync: any insert/update/delete on the visitor
 * tables refreshes the cached queries without a manual reload.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("visitor-logbook-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitor_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.logs });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.visitors });
        queryClient.invalidateQueries({ queryKey: queryKeys.logs });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.audit });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
