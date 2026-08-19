/* Server-only helpers for admin server functions. */

/** Throws unless the user holds the Super Admin role. */
export async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("FORBIDDEN");
  return true;
}

/** Human-readable label for an actor id. */
export async function actorLabel(admin: any, userId: string): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name || data?.email || "System";
}
