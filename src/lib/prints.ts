import { supabase } from "@/integrations/supabase/client";

export type PrintRecord = {
  specimen_id: string;
  serial_number: string | null;
  first_printed_at: string;
  last_printed_at: string;
  print_count: number;
};

/** Fetch the print log (one row per specimen). */
export async function fetchPrintRecords(): Promise<PrintRecord[]> {
  const { data, error } = await supabase
    .from("specimen_prints")
    .select("specimen_id, serial_number, first_printed_at, last_printed_at, print_count")
    .order("last_printed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PrintRecord[];
}

/**
 * Record a successful print for the given specimens.
 * Re-printing keeps the existing row (no duplicates) and bumps the counter.
 */
export async function recordPrints(
  specimens: { id: string; serial_number: string }[],
): Promise<void> {
  const unique = new Map(specimens.map((s) => [s.id, s]));
  if (unique.size === 0) return;

  const existing = await fetchPrintRecords();
  const known = new Map(existing.map((r) => [r.specimen_id, r]));
  const now = new Date().toISOString();

  const toInsert = [...unique.values()]
    .filter((s) => !known.has(s.id))
    .map((s) => ({
      specimen_id: s.id,
      serial_number: s.serial_number,
      first_printed_at: now,
      last_printed_at: now,
      print_count: 1,
    }));

  if (toInsert.length > 0) {
    // upsert (ignore duplicates) so two concurrent prints of the same
    // specimen cannot fail with a unique-violation error
    const { error } = await supabase
      .from("specimen_prints")
      .upsert(toInsert, { onConflict: "specimen_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  for (const s of unique.values()) {
    const row = known.get(s.id);
    if (!row) continue;
    const { error } = await supabase
      .from("specimen_prints")
      .update({ last_printed_at: now, print_count: row.print_count + 1 })
      .eq("specimen_id", s.id);
    if (error) throw new Error(error.message);
  }
}
