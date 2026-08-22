import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth, type DataScope } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createUser,
  deleteUser,
  listUsers,
  resendInvite,
  resetUserPassword,
  setPermissions,
  setUserRole,
  updateUser,
} from "@/lib/admin.functions";
import { isStrongPassword, isValidEmail } from "@/lib/password";


export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "إدارة المستخدمين | معشبة NCVC" },
      {
        name: "description",
        content: "إدارة حسابات المستخدمين والصلاحيات ونطاق البيانات في نظام إدارة عينات المعشبة.",
      },
      { property: "og:title", content: "إدارة المستخدمين | معشبة NCVC" },
      { property: "og:description", content: "إضافة المستخدمين وتعديل صلاحياتهم وتعطيل الحسابات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

type PermsRow = {
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
} | null;

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  role: "super_admin" | "user";
  permissions: PermsRow;
  email_confirmed: boolean;
  banned: boolean;
};


type Draft = {
  dataScope: DataScope;
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
};

function toDraft(p: PermsRow): Draft {
  return {
    dataScope: p?.data_scope ?? "own",
    canAdd: Boolean(p?.can_add),
    canEdit: Boolean(p?.can_edit),
    canDelete: Boolean(p?.can_delete),
    canImport: Boolean(p?.can_import),
    canExport: Boolean(p?.can_export),
    canEditSamples: Boolean(p?.can_edit_samples),
    canEditLabels: Boolean(p?.can_edit_labels),
    canChangeStatus: Boolean(p?.can_change_status),
    canSendRequests: Boolean(p?.can_send_requests),
    canReceiveRequests: p?.can_receive_requests ?? true,
  };
}

function UsersPage() {
  const { t, lang } = useI18n();
  const { isSuperAdmin, loading, user } = useAuth();
  const queryClient = useQueryClient();

  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const update = useServerFn(updateUser);
  const remove = useServerFn(deleteUser);
  const resetPw = useServerFn(resetUserPassword);
  const savePerms = useServerFn(setPermissions);
  const changeRole = useServerFn(setUserRole);
  const resend = useServerFn(resendInvite);

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [form, setForm] = useState({ email: "", fullName: "", superAdmin: false });
  const [newPerms, setNewPerms] = useState<Draft>(toDraft(null));

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    enabled: isSuperAdmin,
    queryFn: async () => (await list({ data: undefined as never })) as unknown as UserRow[],
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  const fail = (e: unknown) => {
    const msg = (e as Error).message || "";
    if (msg.includes("EMAIL_EXISTS")) return void toast.error(t("emailAlreadyUsed"));
    toast.error(msg || t("noPermission"));
  };

  const createMut = useMutation({
    mutationFn: async () => {
      if (!isValidEmail(form.email)) throw new Error(t("invalidEmailFormat"));
      return (await create({
        data: {
          email: form.email,
          fullName: form.fullName,
          superAdmin: form.superAdmin,
          permissions: newPerms,
        },
      })) as unknown as { user?: UserRow; error?: string };
    },
    onSuccess: (res) => {
      if (res?.error || !res?.user) {
        fail(new Error(res?.error ?? "CREATE_FAILED"));
        return;
      }
      const row = res.user;
      toast.success(t("userCreated"));
      // Show the new account immediately, without waiting for a refetch.
      queryClient.setQueryData<UserRow[]>(["admin-users"], (prev) =>
        prev ? [...prev.filter((u) => u.id !== row.id), row] : [row],
      );
      setForm({ email: "", fullName: "", superAdmin: false });
      setNewPerms(toDraft(null));
      refresh();
    },
    onError: fail,
  });


  const resendMut = useMutation({
    mutationFn: (row: UserRow) => resend({ data: { userId: row.id } }),
    onSuccess: () => toast.success(t("inviteSent")),
    onError: fail,
  });

  const toggleActive = useMutation({
    mutationFn: (row: UserRow) => update({ data: { userId: row.id, isActive: !row.is_active } }),

    onSuccess: () => {
      toast.success(t("userUpdated"));
      refresh();
    },
    onError: fail,
  });

  const deleteMut = useMutation({
    mutationFn: (row: UserRow) => remove({ data: { userId: row.id } }),
    onSuccess: () => {
      toast.success(t("userDeleted"));
      refresh();
    },
    onError: fail,
  });

  const roleMut = useMutation({
    mutationFn: (row: UserRow) =>
      changeRole({ data: { userId: row.id, superAdmin: row.role !== "super_admin" } }),
    onSuccess: () => {
      toast.success(t("roleUpdated"));
      refresh();
    },
    onError: fail,
  });

  const resetMut = useMutation({
    mutationFn: async (row: UserRow) => {
      const pw = window.prompt(t("newPassword") ?? "");
      if (!pw) return null;
      if (!isStrongPassword(pw)) throw new Error(t("weakPassword"));
      return resetPw({ data: { userId: row.id, password: pw } });
    },
    onSuccess: (res) => {
      if (res) toast.success(t("passwordUpdated"));
    },
    onError: fail,
  });

  const permsMut = useMutation({
    mutationFn: (payload: Draft & { userId: string }) => savePerms({ data: payload }),
    onSuccess: () => {
      toast.success(t("permissionsSaved"));
      setOpenId(null);
      setDraft(null);
      refresh();
    },
    onError: fail,
  });

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </AppLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">{t("noPermission")}</p>
      </AppLayout>
    );
  }

  const fmt = (value: string | null) =>
    value ? new Date(value).toLocaleString(lang === "ar" ? "ar-SA" : "en-GB") : "—";

  const actionFields: Array<{ key: keyof Draft; label: string }> = [
    { key: "canAdd", label: t("permAdd") },
    { key: "canEdit", label: t("permEdit") },
    { key: "canDelete", label: t("permDelete") },
    { key: "canImport", label: t("permImport") },
    { key: "canExport", label: t("permExport") },
    { key: "canEditSamples", label: t("permEditSamples") },
    { key: "canEditLabels", label: t("permEditLabels") },
    { key: "canChangeStatus", label: t("permChangeStatus") },
    { key: "canSendRequests", label: t("permSendRequests") },
    { key: "canReceiveRequests", label: t("permReceiveRequests") },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">{t("users")}</h2>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t("addUser")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="new-name">{t("name")}</Label>
                  <Input
                    id="new-name"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-email">{t("email")}</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-role">{t("role")}</Label>
                  <Select
                    value={form.superAdmin ? "super_admin" : "user"}
                    onValueChange={(v) => setForm({ ...form, superAdmin: v === "super_admin" })}
                  >
                    <SelectTrigger id="new-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t("user")}</SelectItem>
                      <SelectItem value="super_admin">{t("superAdmin")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1 sm:max-w-xs">
                <Label>{t("dataPermissions")}</Label>
                <Select
                  value={newPerms.dataScope}
                  onValueChange={(v) => setNewPerms({ ...newPerms, dataScope: v as DataScope })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("scopeAll")}</SelectItem>
                    <SelectItem value="selected">{t("scopeSelected")}</SelectItem>
                    <SelectItem value="own">{t("scopeOwn")}</SelectItem>
                    <SelectItem value="admin_only">{t("scopeAdminOnly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("actionPermissions")}</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {actionFields.map((field) => (
                    <label key={`new-${field.key}`} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={Boolean(newPerms[field.key])}
                        onCheckedChange={(v) => setNewPerms({ ...newPerms, [field.key]: Boolean(v) })}
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={createMut.isPending}>
                  {t("addUser")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("inviteUserHint")}</p>
              </div>
            </form>

          </CardContent>
        </Card>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("lastLogin")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      {t("loading")}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.full_name ?? "—"}</TableCell>
                      <TableCell>{row.email ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={row.role === "super_admin" ? "default" : "secondary"}>
                          {row.role === "super_admin" ? t("superAdmin") : t("user")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={row.is_active && !row.banned ? "outline" : "destructive"}>
                            {row.is_active && !row.banned ? t("active") : t("disabled")}
                          </Badge>
                          <Badge variant={row.email_confirmed ? "secondary" : "outline"}>
                            {row.email_confirmed ? t("verifiedStatus") : t("unverifiedStatus")}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmt(row.last_login_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setOpenId(openId === row.id ? null : row.id);
                              setDraft(toDraft(row.permissions));
                            }}
                          >
                            {t("permissions")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={row.role === "super_admin"}
                            onClick={() => toggleActive.mutate(row)}
                          >
                            {row.is_active ? t("disable") : t("enable")}
                          </Button>
                          {row.email_confirmed ? null : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resendMut.isPending}
                              onClick={() => resendMut.mutate(row)}
                            >
                              {t("resendInvite")}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => resetMut.mutate(row)}>
                            {t("resetUserPassword")}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            disabled={row.id === user?.id}
                            onClick={() => roleMut.mutate(row)}
                          >
                            {row.role === "super_admin" ? t("revokeSuperAdmin") : t("makeSuperAdmin")}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={row.role === "super_admin"}
                            onClick={() => {
                              if (window.confirm(t("confirmDelete"))) deleteMut.mutate(row);
                            }}
                          >
                            {t("delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {openId && draft ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {t("permissions")} — {users.find((u) => u.id === openId)?.email ?? ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 sm:max-w-xs">
                <Label>{t("dataPermissions")}</Label>
                <Select
                  value={draft.dataScope}
                  onValueChange={(v) => setDraft({ ...draft, dataScope: v as DataScope })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("scopeAll")}</SelectItem>
                    <SelectItem value="selected">{t("scopeSelected")}</SelectItem>
                    <SelectItem value="own">{t("scopeOwn")}</SelectItem>
                    <SelectItem value="admin_only">{t("scopeAdminOnly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("actionPermissions")}</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {actionFields.map((field) => (
                    <label key={field.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={Boolean(draft[field.key])}
                        onCheckedChange={(v) => setDraft({ ...draft, [field.key]: Boolean(v) })}
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  disabled={permsMut.isPending}
                  onClick={() => permsMut.mutate({ ...draft, userId: openId })}
                >
                  {t("save")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpenId(null);
                    setDraft(null);
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );
}
