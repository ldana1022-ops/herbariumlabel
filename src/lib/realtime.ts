import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps every signed-in user on the same data: any change to specimens,
 * requests or the print log invalidates the matching caches immediately.
 */
export function useRealtimeSync(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidate = (keys: string[]) => {
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
    };

    const channel = supabase
      .channel(`herbarium-sync-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "herbarium_specimens" }, () =>
        invalidate(["specimens", "specimen"]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () =>
        invalidate(["requests", "editable-specimens", "notifications"]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "request_samples" }, () =>
        invalidate(["request_samples", "editable-specimens"]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "specimen_prints" }, () =>
        invalidate(["specimen-prints"]),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
