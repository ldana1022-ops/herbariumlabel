import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listDirectory } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";
import { useRealtimeSync } from "@/lib/realtime";
import { useI18n } from "@/lib/i18n";
import { bulkUpdateStatus, fetchSpecimens } from "@/lib/specimens";
import { Barcode } from "@/components/Barcode";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "الطلبات | معشبة NCVC" },
      {
        name: "description",
        content: "إنشاء ومتابعة طلبات العمل على عينات المعشبة بين مستخدمي النظام.",
      },
      { property: "og:title", content: "الطلبات | معشبة NCVC" },
      {
        property: "og:description",
        content: "إنشاء ومتابعة طلبات العمل على عينات المعشبة النباتية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

type RequestStatus = "pending" | "in_progress" | "completed" | "rejected";

type RequestRow = {
  id: string;
  request_number: string;
  specimen_id: string | null;
  assigned_to: string;
  created_by: string | null;
  request_type: string;
  message: string | null;
  due_date: string | null;
  status: RequestStatus;
  status_changed_by: string | null;
  status_changed_at: string | null;
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

/** Upper bound so one request can never blow up a page render. */
const MAX_SAMPLES_PER_REQUEST = 200;

function RequestsPage() {
  const { t, lang } = useI18n();
  useRealtimeSync(true);
  const { user, can, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const directory = useServerFn(listDirectory);

  const [assignedTo, setAssignedTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [specimenSearch, setSpecimenSearch] = useState("");
  const [requestType, setRequestType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

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

  // Request ↔ specimen links (RLS only returns rows of requests the user may see).
  const { data: links = [] } = useQuery({
    queryKey: ["request_samples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_samples")
        .select("request_id, specimen_id, created_at")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
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

  const specimenById = useMemo(() => new Map(specimens.map((s) => [s.id, s])), [specimens]);

  const samplesByRequest = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of links) {
      const list = map.get(link.request_id) ?? [];
      if (!list.includes(link.specimen_id)) list.push(link.specimen_id);
      map.set(link.request_id, list);
    }
    // Legacy single-specimen requests keep working even without a link row.
    for (const r of requests) {
      if (!map.has(r.id) && r.specimen_id) map.set(r.id, [r.specimen_id]);
    }
    return map;
  }, [links, requests]);

  const searchResults = useMemo(() => {
    const q = specimenSearch.trim().toLowerCase();
    const base = q
      ? specimens.filter(
          (s) =>
            s.serial_number.toLowerCase().includes(q) ||
            s.scientific_name.toLowerCase().includes(q) ||
            (s.family ?? "").toLowerCase().includes(q),
        )
      : specimens;
    return base.slice(0, 50);
  }, [specimens, specimenSearch]);

  const toggleSpecimen = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SAMPLES_PER_REQUEST) {
        toast.error(t("samplesCount"));
        return prev;
      }
      return [...prev, id];
    });
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .insert({
          assigned_to: assignedTo,
          created_by: user?.id ?? null,
          // Keep the legacy column populated for single-specimen requests.
          specimen_id: selectedIds.length === 1 ? selectedIds[0]! : null,
          request_type: requestType.trim(),
          message: message.trim() || null,
          due_date: dueDate || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      if (selectedIds.length > 0) {
        // Deduplicated by the unique (request_id, specimen_id) constraint too.
        const unique = Array.from(new Set(selectedIds));
        const { error: linkError } = await supabase
          .from("request_samples")
          .insert(unique.map((specimen_id) => ({ request_id: data.id, specimen_id })));
        if (linkError) throw new Error(linkError.message);
      }
    },
    onSuccess: () => {
      toast.success(t("requestCreated"));
      setSelectedIds([]);
      setSpecimenSearch("");
      setRequestType("");
      setDueDate("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["request_samples"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
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

  const completeRequest = useMutation({
    mutationFn: async ({ id, specimenIds }: { id: string; specimenIds: string[] }) => {
      // Mark the samples first: edit rights end as soon as the request closes.
      if (specimenIds.length > 0) await bulkUpdateStatus(specimenIds, "completed");
      const { error } = await supabase
        .from("requests")
        .update({ status: "completed" })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(t("requestCompleted"));
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["specimens"] });
      void queryClient.invalidateQueries({ queryKey: ["editable-specimens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.name ?? "—";
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
                  {users.filter((u) => u.id !== user?.id).length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      {t("noRecipients")}
                    </div>
                  ) : (
                    users
                      .filter((u) => u.id !== user?.id)
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("requestType")}</Label>
              <Input value={requestType} onChange={(e) => setRequestType(e.target.value)} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("selectSamples")}</Label>
              <Input
                value={specimenSearch}
                onChange={(e) => setSpecimenSearch(e.target.value)}
                placeholder={t("searchSample")}
              />
              <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                {searchResults.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">{t("noResults")}</p>
                ) : (
                  searchResults.map((s) => {
                    const checked = selectedIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSpecimen(s.id)}
                        className={`flex w-full items-center gap-2 border-b border-border px-3 py-2 text-start text-sm last:border-0 hover:bg-secondary ${
                          checked ? "bg-secondary" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          tabIndex={-1}
                          className="size-4 shrink-0 accent-primary"
                        />
                        <span className="font-mono text-xs">{s.serial_number}</span>
                        <span className="truncate italic">{s.scientific_name}</span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="space-y-1 pt-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("selectedSamples")} ({selectedIds.length})
                </p>
                {selectedIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("noSamplesSelected")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedIds.map((id) => {
                      const s = specimenById.get(id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
                        >
                          <span className="font-mono">{s?.serial_number ?? id.slice(0, 8)}</span>
                          <button
                            type="button"
                            aria-label={t("removeSample")}
                            onClick={() => toggleSpecimen(id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
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
                <TableHead>{t("requestNumber")}</TableHead>
                <TableHead>{t("requestType")}</TableHead>
                <TableHead>{t("requestFrom")}</TableHead>
                <TableHead>{t("assignedTo")}</TableHead>
                <TableHead>{t("requestSamples")}</TableHead>
                <TableHead>{t("dueDate")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    …
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    {t("noRequests")}
                  </TableCell>
                </TableRow>
              ) : (
                requests.flatMap((r) => {
                  const isRecipient = r.assigned_to === user?.id && can("receiveRequests");
                  const sampleIds = samplesByRequest.get(r.id) ?? [];
                  const isOpen = expanded === r.id;
                  const rows = [
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {r.request_number}
                      </TableCell>
                      <TableCell className="text-sm">
                        <p className="font-medium">{r.request_type}</p>
                        {r.message ? (
                          <p className="text-xs text-muted-foreground">{r.message}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {nameOf(r.created_by)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {nameOf(r.assigned_to)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sampleIds.length === 0 ? (
                          "—"
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => setExpanded(isOpen ? null : r.id)}
                          >
                            {sampleIds.length}
                            {isOpen ? (
                              <ChevronUp className="size-3" />
                            ) : (
                              <ChevronDown className="size-3" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {r.due_date ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}
                          >
                            {t(STATUS_KEYS[r.status])}
                          </span>

                          {r.status_changed_by ? (
                            <span className="text-[11px] text-muted-foreground">
                              {t("statusChangedBy")}: {nameOf(r.status_changed_by)}
                              {r.status_changed_at
                                ? ` · ${new Date(r.status_changed_at).toLocaleString(locale)}`
                                : ""}
                            </span>
                          ) : null}

                          {isRecipient && r.status === "pending" ? (
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                disabled={updateStatus.isPending}
                                onClick={() =>
                                  updateStatus.mutate({ id: r.id, status: "in_progress" })
                                }
                              >
                                {t("acceptRequest")}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs"
                                disabled={updateStatus.isPending}
                                onClick={() =>
                                  updateStatus.mutate({ id: r.id, status: "rejected" })
                                }
                              >
                                {t("rejectRequest")}
                              </Button>
                            </div>
                          ) : null}

                          {isRecipient && r.status === "in_progress" ? (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              disabled={completeRequest.isPending}
                              onClick={() =>
                                completeRequest.mutate({ id: r.id, specimenIds: sampleIds })
                              }
                            >
                              {t("completeRequestSamples")}
                            </Button>
                          ) : null}

                          {isSuperAdmin && !isRecipient ? (
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
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(r.created_at).toLocaleDateString(locale)}
                      </TableCell>
                    </TableRow>,
                  ];

                  if (isOpen && sampleIds.length > 0) {
                    rows.push(
                      <TableRow key={`${r.id}-samples`} className="bg-muted/30">
                        <TableCell colSpan={8} className="p-3">
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {sampleIds.map((id) => {
                              const s = specimenById.get(id);
                              return (
                                <div
                                  key={id}
                                  className="rounded-md border border-border bg-card p-2 text-sm"
                                >
                                  <p className="font-mono text-xs">{s?.serial_number ?? "—"}</p>
                                  <p className="italic">{s?.scientific_name ?? "—"}</p>
                                  {s?.serial_number ? (
                                    <Barcode
                                      value={s.serial_number}
                                      widthMm={40}
                                      heightMm={10}
                                      displayValue
                                      className="mt-1"
                                    />
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </TableCell>
                      </TableRow>,
                    );
                  }

                  return rows;
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
