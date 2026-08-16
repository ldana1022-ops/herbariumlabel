// Sign-in has been removed from this application: every visitor has full access.
// This module keeps a tiny permission shim so UI code can stay unchanged.
import type { ReactNode } from "react";

export type Permission = "view" | "edit" | "print" | "import" | "delete" | "manageUsers";

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  return {
    can: (_permission: Permission) => true,
  };
}
