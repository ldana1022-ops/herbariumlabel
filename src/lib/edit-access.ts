import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Specimens are read-only by default. Edit rights come ONLY from an open
 * request (pending / in_progress) assigned to the current user — the exact
 * same rule the database enforces through RLS.
 */
export async function fetchEditableSpecimenIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("requests")
    .select("specimen_id, request_samples(specimen_id)")
    .eq("assigned_to", userId)
    .in("status", ["pending", "in_progress"]);
  if (error) throw new Error(error.message);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.specimen_id) ids.add(row.specimen_id);
    for (const link of (row.request_samples ?? []) as { specimen_id: string }[]) {
      ids.add(link.specimen_id);
    }
  }
  return [...ids];
}

export function useEditableSpecimens() {
  const { user, isSuperAdmin } = useAuth();
  const userId = user?.id ?? null;

  const { data: ids = [], isLoading } = useQuery({
    queryKey: ["editable-specimens", userId],
    queryFn: () => fetchEditableSpecimenIds(userId as string),
    enabled: Boolean(userId) && !isSuperAdmin,
    staleTime: 10_000,
  });

  return useMemo(() => {
    const set = new Set(ids);
    return {
      isLoading,
      isSuperAdmin,
      editableIds: set,
      /** true when the current user may edit this specimen right now. */
      canEditSpecimen: (id: string) => isSuperAdmin || set.has(id),
      hasAnyEditable: isSuperAdmin || set.size > 0,
    };
  }, [ids, isLoading, isSuperAdmin]);
}
