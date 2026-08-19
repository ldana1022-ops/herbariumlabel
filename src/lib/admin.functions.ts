import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin, actorLabel } from "@/lib/admin.server";


/** Creates the profile row on first sign-in and bootstraps the first Super Admin. */
export const ensureAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName?: string }) =>
    z.object({ fullName: z.string().trim().max(120).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = (context.claims as { email?: string }).email ?? null;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("profiles").insert({
        id: userId,
        email,
        full_name: data.fullName && data.fullName.length > 0 ? data.fullName : email,
      });
    }

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) === 0) {
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    return { isActive: profile?.is_active !== false };
  });

/** Records a successful login in the audit log and notifies Super Admins. */
export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.is_active === false) return { active: false };

    const name = profile?.full_name || profile?.email || "A user";
    await supabaseAdmin.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", userId);
    await supabaseAdmin.from("activity_log").insert({
      actor_id: userId,
      actor_name: name,
      action: "login",
      record_label: profile?.email ?? null,
      record_id: userId,
    });

    const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const rows = (admins ?? []).map((a: { user_id: string }) => ({
      user_id: a.user_id,
      actor_id: userId,
      actor_name: name,
      action: "login",
      title: "New Login",
      body: `${name} logged in`,
      record_label: profile?.email ?? null,
      record_id: userId,
    }));
    if (rows.length > 0) await supabaseAdmin.from("notifications").insert(rows);
    return { active: true };
  });

/** Logs client-side events that have no database trigger (export, label edits). */
export const logEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { action: string; label?: string }) =>
    z
      .object({
        action: z.enum(["export", "import", "edit_label"]),
        label: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    const name = profile?.full_name || profile?.email || "A user";
    const titles: Record<string, string> = {
      export: "Data Exported",
      import: "Excel Imported",
      edit_label: "Label Edited",
    };
    const verbs: Record<string, string> = {
      export: "exported data",
      import: "imported an Excel file",
      edit_label: "edited a label",
    };

    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      actor_name: name,
      action: data.action,
      record_label: data.label ?? null,
    });

    const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const rows = (admins ?? []).map((a: { user_id: string }) => ({
      user_id: a.user_id,
      actor_id: context.userId,
      actor_name: name,
      action: data.action,
      title: titles[data.action] ?? data.action,
      body: `${name} ${verbs[data.action] ?? data.action}${data.label ? ` (${data.label})` : ""}`,
      record_label: data.label ?? null,
    }));
    if (rows.length > 0) await supabaseAdmin.from("notifications").insert(rows);
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roles }, { data: perms }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: true }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("user_permissions").select("*"),
    ]);

    return (profiles ?? []).map((p: any) => ({
      ...p,
      role: (roles ?? []).some((r: any) => r.user_id === p.id && r.role === "admin")
        ? "super_admin"
        : "user",
      permissions: (perms ?? []).find((x: any) => x.user_id === p.id) ?? null,
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; fullName: string }) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        fullName: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "CREATE_FAILED");

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, email: data.email, full_name: data.fullName });

    return { id: created.user.id };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; fullName?: string; isActive?: boolean }) =>
    z
      .object({
        userId: z.string().uuid(),
        fullName: z.string().trim().min(1).max(120).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (targetRole && data.isActive === false) throw new Error("CANNOT_DISABLE_SUPER_ADMIN");

    const patch: { full_name?: string; is_active?: boolean } = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", data.userId)
      .maybeSingle();
    const actorName = await actorLabel(supabaseAdmin, context.userId);
    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      actor_name: actorName,
      action: data.isActive === undefined ? "edit_user" : data.isActive ? "enable_user" : "disable_user",
      record_label: profile?.email ?? data.userId,
      record_id: data.userId,
      new_value: patch as Record<string, string | boolean>,
    });
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (targetRole) throw new Error("CANNOT_DELETE_SUPER_ADMIN");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .maybeSingle();

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      actor_name: await actorLabel(supabaseAdmin, context.userId),
      action: "delete_user",
      record_label: profile?.email ?? data.userId,
      record_id: data.userId,
    });
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      actor_name: await actorLabel(supabaseAdmin, context.userId),
      action: "reset_password",
      record_id: data.userId,
    });
    await supabaseAdmin.from("notifications").insert({
      user_id: data.userId,
      actor_id: context.userId,
      actor_name: await actorLabel(supabaseAdmin, context.userId),
      action: "reset_password",
      title: "Password Reset",
      body: "Your password was reset by the administrator",
    });
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; superAdmin: boolean }) =>
    z.object({ userId: z.string().uuid(), superAdmin: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.superAdmin) throw new Error("CANNOT_DEMOTE_SELF");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.superAdmin) {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: data.userId, role: "admin" },
        { onConflict: "user_id,role" },
      );
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    }

    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      actor_name: await actorLabel(supabaseAdmin, context.userId),
      action: "permission_changed",
      record_id: data.userId,
      new_value: { role: data.superAdmin ? "super_admin" : "user" },
    });
    return { ok: true };
  });


/** Active users directory (id + display name) for request assignment. */
export const listDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });
    return (data ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => ({
      id: p.id,
      name: p.full_name || p.email || p.id,
    }));
  });
