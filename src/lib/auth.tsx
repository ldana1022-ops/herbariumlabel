import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "editor" | "viewer";

export type Permission = "view" | "edit" | "print" | "import" | "delete" | "manageUsers";

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  admin: ["view", "edit", "print", "import", "delete", "manageUsers"],
  editor: ["view", "edit", "print", "import"],
  viewer: ["view", "print"],
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

async function ensureAccount(user: User): Promise<AppRole | null> {
  await supabase
    .from("profiles")
    .upsert(
      { id: user.id, email: user.email ?? null, full_name: (user.user_metadata?.['full_name'] as string) ?? null },
      { onConflict: "id" },
    );

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roles && roles.length > 0) {
    if (roles.some((r) => r.role === "admin")) return "admin";
    if (roles.some((r) => r.role === "editor")) return "editor";
    return "viewer";
  }

  const { data: adminExists } = await supabase.rpc("admin_exists");
  const desired: AppRole = adminExists ? "viewer" : "admin";
  const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: desired });
  if (error) {
    const { data: retry } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    return (retry?.[0]?.role as AppRole) ?? null;
  }
  return desired;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRole = useCallback(async (u: User | null) => {
    if (!u) {
      setRole(null);
      return;
    }
    try {
      setRole(await ensureAccount(u));
    } catch {
      setRole(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      if (!s?.user) setRole(null);
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadRole(data.session?.user ?? null);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadRole]);

  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId || !session?.user) return;
    void loadRole(session.user);
  }, [userId, loadRole, session?.user]);

  const value = useMemo<AuthCtx>(
    () => ({
      user: session?.user ?? null,
      session,
      role,
      loading,
      can: (permission) => (role ? ROLE_PERMISSIONS[role].includes(permission) : false),
      signOut: async () => {
        await supabase.auth.signOut();
        setRole(null);
      },
      refreshRole: () => loadRole(session?.user ?? null),
    }),
    [session, role, loading, loadRole],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const roleLabel: Record<AppRole, { ar: string; en: string }> = {
  admin: { ar: "مدير النظام", en: "Administrator" },
  editor: { ar: "محرر بيانات", en: "Editor" },
  viewer: { ar: "مطّلع", en: "Viewer" },
};
