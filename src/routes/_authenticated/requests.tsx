import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listDirectory } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fetchSpecimens } from "@/lib/specimens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
import { BackButton } from "@/components/BackButton";
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "الطلبات | معشبة NCVC" },
      { name: "description", content: "إنشاء ومتابعة طلبات العمل على عينات المعشبة بين مستخدمي النظام." },
      { property: "og:title", content: "الطلبات | معشبة NCVC" },
      { property: "og:description", content: "إنشاء ومتابعة طلبات العمل على عينات المعشبة النباتية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

type RequestStatus = "pending" | "in_progress" | "completed" | "rejected";

type RequestRow = {
  id: string;
  specimen_id: string | null;
  assigned_to: string;
  created_by: string | null;
  request_type: string;
  message: string | null;
  due_date: string | null;
  status: RequestStatus;
  created_at: string;
};

const STATUS_KEYS = {
  pending: "statusPending",
  in_progress: "statusInProgress",
  completed: "statusCompleted",
  rejected: "statusRejected",
} as const;

const STATUS_CLASS: Record<RequestStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-destructive/10 text-destructive",
};

function RequestsPage() {
  const { t, lang } = useI18n();
  const { user, can, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const directory = useServerFn(listDirectory);

  const [assignedTo, setAssignedTo] = useState("");
  const [specimenId, setSpecimenId] = useState("");
  const [requestType, setRequestType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as RequestRow[];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["directory"],
    queryFn: () => directory({ data: undefined }),
  });

  const { data: specimens = [] } = useQuery({
    queryKey: ["specimens"],
    queryFn: fetchSpecimens,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("requests").insert({
        assigned_to: assignedTo,
        created_by: user?.id ?? null,
        specimen_id: specimenId || null,
        request_type: requestType.trim(),
        message: message.trim() || null,
        due_date: dueDate || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(t("requestCreated"));
      setSpecimenId("");
      setRequestType("");
      setDueDate("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RequestStatus }) => {
      const { error } = await supabase.from("requests").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(t("requestUpdated"));
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.name ?? "—";
  const specimenOf = (id: string | null) => {
    const s = specimens.find((x) => x.id === id);
    return s ? `${s.serial_number} — ${s.scientific_name}` : "—";
  };
  const locale = lang === "ar" ? "ar-SA" : "en-GB";

  return (
    <div className="space-y-4">
      <BackButton />
      <h2 className="text-lg font-semibold">{t("requests")}</h2>

      {can("sendRequests") ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t("createRequest")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("assignedTo")}</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder={t("assignedTo")} />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.id !== user?.id)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("database")}</Label>
              <Select value={specimenId} onValueChange={setSpecimenId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("database")} />
                </SelectTrigger>
                <SelectContent>
                  {specimens.slice(0, 200).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.serial_number} — {s.scientific_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("requestType")}</Label>
              <Input value={requestType} onChange={(e) => setRequestType(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("dueDate")}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("message")}</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Button
                disabled={!assignedTo || requestType.trim().length === 0 || create.isPending}
                onClick={() => create.mutate()}
              >
                {t("createRequest")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("requestType")}</TableHead>
                <TableHead>{t("database")}</TableHead>
                <TableHead>{t("assignedTo")}</TableHead>
                <TableHead>{t("dueDate")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    …
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {t("noRequests")}
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((r) => {
                  const editable =
                    isSuperAdmin || (r.assigned_to === user?.id && can("receiveRequests"));
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        <p className="font-medium">{r.request_type}</p>
                        {r.message ? (
                          <p className="text-xs text-muted-foreground">{r.message}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">{specimenOf(r.specimen_id)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{nameOf(r.assigned_to)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{r.due_date ?? "—"}</TableCell>
                      <TableCell>
                        {editable ? (
                          <Select
                            value={r.status}
                            onValueChange={(v) =>
                              updateStatus.mutate({ id: r.id, status: v as RequestStatus })
                            }
                          >
                            <SelectTrigger className="h-8 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS_KEYS) as RequestStatus[]).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {t(STATUS_KEYS[s])}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}
                          >
                            {t(STATUS_KEYS[r.status])}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(r.created_at).toLocaleDateString(locale)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
