import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth, roleLabel, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "إدارة المستخدمين | نظام إدارة ملصقات المعشبة" },
      {
        name: "description",
        content: "إدارة صلاحيات مستخدمي نظام المعشبة النباتية: مدير، محرر بيانات، مطّلع.",
      },
      { property: "og:title", content: "إدارة المستخدمين | نظام إدارة ملصقات المعشبة" },
      { property: "og:description", content: "منح وتعديل صلاحيات المستخدمين داخل النظام." },
    ],
  }),
  component: UsersPage,
});

type Row = { id: string; email: string | null; full_name: string | null; role: AppRole | null };

async function fetchUsers(): Promise<Row[]> {
  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name").order("created_at"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (pErr) throw pErr;
  if (rErr) throw rErr;
  return (profiles ?? []).map((p) => ({
    ...p,
    role: (roles ?? []).find((r) => r.user_id === p.id)?.role ?? null,
  }));
}

function UsersPage() {
  const { t, lang } = useI18n();
  const { can, user, refreshRole } = useAuth();
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: fetchUsers, enabled: can("manageUsers") });

  const mutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: async (_d, vars) => {
      toast.success(t("roleUpdated"));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      if (vars.userId === user?.id) await refreshRole();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!can("manageUsers")) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">{t("noPermission")}</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-xs text-muted-foreground">
                    <th className="p-2 text-start">{t("fullName")}</th>
                    <th className="p-2 text-start">{t("email")}</th>
                    <th className="p-2 text-start">{t("role")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="p-2">{row.full_name || "—"}</td>
                      <td className="p-2" dir="ltr">{row.email || "—"}</td>
                      <td className="p-2">
                        <Select
                          value={row.role ?? undefined}
                          onValueChange={(value) =>
                            mutation.mutate({ userId: row.id, role: value as AppRole })
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder={t("role")} />
                          </SelectTrigger>
                          <SelectContent>
                            {(["admin", "editor", "viewer"] as AppRole[]).map((r) => (
                              <SelectItem key={r} value={r}>
                                {roleLabel[r][lang]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}