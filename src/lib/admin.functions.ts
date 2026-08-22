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

const permsSchema = z.object({
  dataScope: z.enum(["all", "selected", "own", "admin_only"]),
  canAdd: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canImport: z.boolean(),
  canExport: z.boolean(),
  canEditSamples: z.boolean(),
  canEditLabels: z.boolean(),
  canChangeStatus: z.boolean(),
  canSendRequests: z.boolean(),
  canReceiveRequests: z.boolean(),
});

type PermsInput = z.infer<typeof permsSchema>;

function permsRow(userId: string, p: PermsInput) {
  return {
    user_id: userId,
    data_scope: p.dataScope,
    can_add: p.canAdd,
    can_edit: p.canEdit,
    can_delete: p.canDelete,
    can_import: p.canImport,
    can_export: p.canExport,
    can_edit_samples: p.canEditSamples,
    can_edit_labels: p.canEditLabels,
    can_change_status: p.canChangeStatus,
    can_send_requests: p.canSendRequests,
    can_receive_requests: p.canReceiveRequests,
  };
}

/** Reads verification/ban state straight from the real auth accounts. */
async function authIndex(admin: any) {
  const map = new Map<string, { emailConfirmed: boolean; banned: boolean; invitedAt: string | null }>();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users ?? [];
    for (const u of users) {
      map.set(u.id, {
        emailConfirmed: Boolean(u.email_confirmed_at),
        banned: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
        invitedAt: u.invited_at ?? null,
      });
    }
    if (users.length < 200) break;
  }
  return map;
}

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roles }, { data: perms }, auth] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: true }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("user_permissions").select("*"),
      authIndex(supabaseAdmin),
    ]);

    return (profiles ?? []).map((p: any) => ({
      ...p,
      role: (roles ?? []).some((r: any) => r.user_id === p.id && r.role === "admin")
        ? "super_admin"
        : "user",
      permissions: (perms ?? []).find((x: any) => x.user_id === p.id) ?? null,
      email_confirmed: auth.get(p.id)?.emailConfirmed ?? false,
      banned: auth.get(p.id)?.banned ?? false,
    }));
  });

/**
 * Creates a real authentication account for the email the admin entered and
 * sends the invite/verification email. Role and permissions are stored in the
 * same call so the new account is usable immediately.
 */
export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { email: string; fullName: string; superAdmin: boolean; permissions: PermsInput }) =>
      z
        .object({
          email: z.string().trim().toLowerCase().email().max(255),
          fullName: z.string().trim().min(1).max(120),
          superAdmin: z.boolean(),
          permissions: permsSchema,
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reject duplicates before touching the auth API.
    const existingAuth = await authIndex(supabaseAdmin);
    const { data: dupProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", data.email)
      .maybeSingle();
    if (dupProfile) throw new Error("EMAIL_EXISTS");

    const siteUrl = process.env["SITE_URL"] ?? process.env["VITE_PUBLIC_SITE_URL"] ?? null;
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName },
      ...(siteUrl ? { redirectTo: `${siteUrl}/auth` } : {}),
    });

    if (error || !invited?.user) {
      const msg = (error?.message ?? "").toLowerCase();
      if (msg.includes("already been registered") || msg.includes("already exists")) {
        throw new Error("EMAIL_EXISTS");
      }
      throw new Error(error?.message ?? "CREATE_FAILED");
    }

    const userId = invited.user.id;
    if (existingAuth.has(userId)) throw new Error("EMAIL_EXISTS");

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email: data.email, full_name: data.fullName, is_active: true });

    if (data.superAdmin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    }

    await supabaseAdmin
      .from("user_permissions")
      .upsert(permsRow(userId, data.permissions), { onConflict: "user_id" });

    const actorName = await actorLabel(supabaseAdmin, context.userId);
    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      actor_name: actorName,
      action: "create_user",
      record_label: data.email,
      record_id: userId,
      new_value: { role: data.superAdmin ? "super_admin" : "user", ...permsRow(userId, data.permissions) },
    });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    const { data: savedPerms } = await supabaseAdmin
      .from("user_permissions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      ...(profile ?? { id: userId, email: data.email, full_name: data.fullName, is_active: true }),
      role: data.superAdmin ? "super_admin" : "user",
      permissions: savedPerms ?? null,
      email_confirmed: false,
      banned: false,
    };
  });

/** Re-sends the invite / verification email to a user who has not activated yet. */
export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .maybeSingle();
    if (!profile?.email) throw new Error("USER_NOT_FOUND");

    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(profile.email);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      actor_name: await actorLabel(supabaseAdmin, context.userId),
      action: "resend_invite",
      record_label: profile.email,
      record_id: data.userId,
    });
    return { ok: true };
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

/** Saves the data scope and action permissions of a single user. */
export const setPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      dataScope: "all" | "selected" | "own" | "admin_only";
      canAdd: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canImport: boolean;
      canExport: boolean;
      canEditSamples: boolean;
      canEditLabels: boolean;
      canChangeStatus: boolean;
      canSendRequests: boolean;
      canReceiveRequests: boolean;
    }) =>
      z
        .object({
          userId: z.string().uuid(),
          dataScope: z.enum(["all", "selected", "own", "admin_only"]),
          canAdd: z.boolean(),
          canEdit: z.boolean(),
          canDelete: z.boolean(),
          canImport: z.boolean(),
          canExport: z.boolean(),
          canEditSamples: z.boolean(),
          canEditLabels: z.boolean(),
          canChangeStatus: z.boolean(),
          canSendRequests: z.boolean(),
          canReceiveRequests: z.boolean(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const row = {
      user_id: data.userId,
      data_scope: data.dataScope,
      can_add: data.canAdd,
      can_edit: data.canEdit,
      can_delete: data.canDelete,
      can_import: data.canImport,
      can_export: data.canExport,
      can_edit_samples: data.canEditSamples,
      can_edit_labels: data.canEditLabels,
      can_change_status: data.canChangeStatus,
      can_send_requests: data.canSendRequests,
      can_receive_requests: data.canReceiveRequests,
    };

    const { error } = await supabaseAdmin
      .from("user_permissions")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    const actorName = await actorLabel(supabaseAdmin, context.userId);
    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      actor_name: actorName,
      action: "permission_changed",
      record_id: data.userId,
      new_value: row,
    });
    await supabaseAdmin.from("notifications").insert({
      user_id: data.userId,
      actor_id: context.userId,
      actor_name: actorName,
      action: "permission_changed",
      title: "Permissions Updated",
      body: `${actorName} updated your permissions`,
    });
    return { ok: true };
  });
