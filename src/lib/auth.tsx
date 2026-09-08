import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Permission =
  | "view"
  | "add"
  | "edit"
  | "delete"
  | "import"
  | "export"
  | "editSamples"
  | "editLabels"
  | "changeStatus"
  | "sendRequests"
  | "receiveRequests"
  | "print"
  | "manageUsers";

export type DataScope = "all" | "selected" | "own" | "admin_only";

export type PermissionRow = {
  user_id: string;
  data_scope: DataScope;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_import: boolean;
  can_export: boolean;
  can_edit_samples: boolean;
  can_edit_labels: boolean;
  can_change_status: boolean;
  can_send_requests: boolean;
  can_receive_requests: boolean;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

type AuthCtx = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  permissions: PermissionRow | null;
  isSuperAdmin: boolean;
  can: (permission: Permission) => boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

async function fetchAccount(userId: string) {
  const [profileRes, rolesRes, permsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("user_permissions").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  return {
    profile: (profileRes.data as Profile | null) ?? null,
    isSuperAdmin: (rolesRes.data ?? []).some((r) => r.role === "admin"),
    permissions: (permsRes.data as PermissionRow | null) ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next ?? null);
      setReady(true);
      // Audit trail: record successful sign-ins; failures are never logged here.
      if (event === "SIGNED_IN" && next) {
        void logAuthEvent({ data: { event: "sign_in" } }).catch(() => undefined);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;

  const { data: account, isLoading } = useQuery({
    queryKey: ["account", userId],
    queryFn: () => fetchAccount(userId as string),
    enabled: Boolean(userId),
  });

  const value = useMemo<AuthCtx>(() => {
    const isSuperAdmin = account?.isSuperAdmin ?? false;
    const p = account?.permissions ?? null;

    const can = (permission: Permission): boolean => {
      if (!userId) return false;
      if (account?.profile && account.profile.is_active === false) return false;
      if (isSuperAdmin) return true;
      switch (permission) {
        case "view":
        case "print":
          return (p?.data_scope ?? "all") !== "admin_only";
        case "add":
          return Boolean(p?.can_add);
        case "edit":
          return Boolean(p?.can_edit && p?.can_edit_samples);
        case "delete":
          return Boolean(p?.can_delete);
        case "import":
          return Boolean(p?.can_import);
        case "export":
          return Boolean(p?.can_export);
        case "editSamples":
          return Boolean(p?.can_edit_samples);
        case "editLabels":
          return Boolean(p?.can_edit_labels);
        case "changeStatus":
          return Boolean(p?.can_change_status);
        case "sendRequests":
          return Boolean(p?.can_send_requests);
        case "receiveRequests":
          return Boolean(p?.can_receive_requests);
        case "manageUsers":
          return false;
        default:
          return false;
      }
    };

    return {
      loading: !ready || (Boolean(userId) && isLoading),
      session,
      user: session?.user ?? null,
      profile: account?.profile ?? null,
      permissions: p,
      isSuperAdmin,
      can,
      signOut: async () => {
        await logAuthEvent({ data: { event: "sign_out" } }).catch(() => undefined);
        await queryClient.cancelQueries();
        queryClient.clear();

        await supabase.auth.signOut();
      },
    };
  }, [account, isLoading, queryClient, ready, session, userId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
