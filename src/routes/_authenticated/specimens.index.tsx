import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  FileSpreadsheet,
  FileText,
  ImageUp,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Upload,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { exportSpecimensToExcel } from "@/lib/export-excel";
import { exportLabelsToWord } from "@/lib/export-word";
import { useLabelSize } from "@/lib/label-size";
import {
  BULK_EDITABLE_FIELDS,
  bulkDeleteSpecimens,
  bulkUpdateField,
  bulkUpdateStatus,
  deleteSpecimen,
  fetchAllMatchingSpecimens,
  fetchMatchingSpecimenIds,
  fetchSpecimenFacets,
  fetchSpecimensByIds,
  fetchSpecimensPage,
  formatDate,
  SPECIMENS_PAGE_SIZE,
  updateSpecimenStatus,
  type BulkEditableField,
  type Specimen,
  type SpecimenFilters,
} from "@/lib/specimens";
import { StatusSelect } from "@/components/StatusSelect";
import { useEditableSpecimens } from "@/lib/edit-access";
import { STATUS_ORDER, type SpecimenStatus } from "@/lib/specimen-status";
import { isAllowedImage, uploadSpecimenImage } from "@/lib/specimen-image";

function RowImageUploadButton({ specimen }: { specimen: Specimen }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isAllowedImage(file)) {
      toast.error(t("imageInvalid"));
      return;
    }
    setBusy(true);
    try {
      await uploadSpecimenImage(specimen.id, file);
      queryClient.invalidateQueries({ queryKey: ["specimens"] });
      queryClient.invalidateQueries({ queryKey: ["specimen", specimen.id] });
      queryClient.invalidateQueries({ queryKey: ["specimen-image"] });
      toast.success(t("imageUploaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("imageInvalid"));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Button
        size="icon"
        variant="ghost"
        disabled={busy}
        title={specimen.image_url ? t("replaceImage") : t("uploadImage")}
        onClick={() => fileInput.current?.click()}
      >
        <ImageUp className="size-4" />
      </Button>
    </>
  );
}

export const Route = createFileRoute("/_authenticated/specimens/")({
  validateSearch: (search: Record<string, unknown>): { focus?: string } =>
    typeof search["focus"] === "string" ? { focus: search["focus"] as string } : {},
  head: () => ({
    meta: [
      { title: "قاعدة بيانات عينات المعشبة | NCVC" },
      {
        name: "description",
        content: "جدول شامل لعينات المعشبة النباتية مع البحث والتصفية والطباعة وتصدير Excel.",
      },
      { property: "og:title", content: "قاعدة بيانات عينات المعشبة | NCVC" },
      {
        property: "og:description",
        content: "استعراض وبحث وتصفية عينات المعشبة النباتية وطباعة ملصقاتها.",
      },
    ],
  }),
  component: SpecimensPage,
});

const ALL = "__all__";

function SpecimensPage() {
  const { t, f, lang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { size } = useLabelSize();
  const { can } = useAuth();
  const { canEditSpecimen, isSuperAdmin, hasAnyEditable } = useEditableSpecimens();
  const canImport = can("import");
  const canDelete = isSuperAdmin;

  const [q, setQ] = useState("");
  const [family, setFamily] = useState(ALL);
  const [region, setRegion] = useState(ALL);
  const [collector, setCollector] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Specimen | null>(null);
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const editableSelected = selected.filter((id) => canEditSpecimen(id));

  const filters = useMemo<SpecimenFilters>(
    () => ({
      q,
      family: family === ALL ? "" : family,
      region: region === ALL ? "" : region,
      collector: collector === ALL ? "" : collector,
      status: statusFilter === ALL ? "" : (statusFilter as SpecimenStatus),
      from,
      to,
    }),
    [q, family, region, collector, statusFilter, from, to],
  );

  // Changing a filter always goes back to the first page.
  const filtersKey = JSON.stringify(filters);
  const lastFiltersKey = useRef(filtersKey);
  if (lastFiltersKey.current !== filtersKey) {
    lastFiltersKey.current = filtersKey;
    if (page !== 0) setPage(0);
  }

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["specimens", "page", filtersKey, page],
    queryFn: () => fetchSpecimensPage(filters, page),
    placeholderData: (prev) => prev,
  });
  const rows = pageData?.rows ?? [];
  const total = pageData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / SPECIMENS_PAGE_SIZE));

  const { data: facets } = useQuery({
    queryKey: ["specimen-facets"],
    queryFn: fetchSpecimenFacets,
    staleTime: 60_000,
  });
  const familyOptions = facets?.families ?? [];
  const regionOptions = facets?.regions ?? [];
  const collectorOptions = facets?.collectors ?? [];


  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SpecimenStatus }) =>
      updateSpecimenStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specimens"] });
      toast.success(t("statusUpdated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSpecimen(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specimens"] });
      toast.success(t("deleted"));
      setPendingDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const notifyBulk = (
    key: "bulkDeleted" | "bulkStatusUpdated" | "bulkFieldUpdated",
    affected: number,
    total: number,
  ) => {
    queryClient.invalidateQueries({ queryKey: ["specimens"] });
    toast.success(t(key).replace("{n}", String(affected)));
    if (affected < total) {
      toast.warning(
        t("bulkPartial").replace("{n}", String(affected)).replace("{total}", String(total)),
      );
    }
  };

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: SpecimenStatus }) =>
      bulkUpdateStatus(ids, status).then((n) => ({ n, total: ids.length })),
    onSuccess: ({ n, total }) => notifyBulk("bulkStatusUpdated", n, total),
    onError: (e: Error) => toast.error(e.message === "NO_SELECTION" ? t("noSelection") : e.message),
  });

  const bulkFieldMutation = useMutation({
    mutationFn: ({
      ids,
      field,
      value,
    }: {
      ids: string[];
      field: BulkEditableField;
      value: string;
    }) => bulkUpdateField(ids, field, value).then((n) => ({ n, total: ids.length })),
    onSuccess: ({ n, total }) => notifyBulk("bulkFieldUpdated", n, total),
    onError: (e: Error) => toast.error(e.message === "NO_SELECTION" ? t("noSelection") : e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteSpecimens(ids).then((n) => ({ n, total: ids.length })),
    onSuccess: ({ n, total }) => {
      notifyBulk("bulkDeleted", n, total);
      setSelected([]);
      setBulkDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message === "NO_SELECTION" ? t("noSelection") : e.message),
  });

  const allVisibleSelected = rows.length > 0 && rows.every((s) => selected.includes(s.id));

  /** Export the whole filtered result set, not only the visible page. */
  const exportFiltered = async () => {
    setBusy(true);
    try {
      exportSpecimensToExcel(await fetchAllMatchingSpecimens(filters));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportSelectedLabels = async () => {
    setBusy(true);
    try {
      exportLabelsToWord(await fetchSpecimensByIds(selected), size);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const selectAllMatching = async () => {
    setBusy(true);
    try {
      setSelected(await fetchMatchingSpecimenIds(filters));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };


  const clearFilters = () => {
    setQ("");
    setFamily(ALL);
    setRegion(ALL);
    setCollector(ALL);
    setStatusFilter(ALL);
    setFrom("");
    setTo("");
  };

  const headers = [
    "accession_number",
    "scientific_name",
    "family",
    "local_name",
    "locality",
    "region",
    "latitude",
    "longitude",
    "altitude_m",
    "collection_date",
    "collectors",
    "determination",
    "determined_by",
    "determination_date",
  ];

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-foreground">{t("database")}</h2>
          <div className="flex flex-wrap gap-2">
            {can("add") ? (
              <Button asChild size="sm">
                <Link to="/specimens/new">
                  <Plus className="size-4" />
                  {t("newSpecimen")}
                </Link>
              </Button>
            ) : null}
            {canImport ? (
              <Button size="sm" variant="outline" asChild>
                <Link to="/specimens/import">
                  <Upload className="size-4" />
                  {t("importExcel")}
                </Link>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportSpecimensToExcel(filtered)}
              disabled={filtered.length === 0}
            >
              <FileSpreadsheet className="size-4" />
              {t("exportExcel")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selected.length === 0}
              onClick={() =>
                exportLabelsToWord(
                  data.filter((s) => selected.includes(s.id)),
                  size,
                )
              }
            >
              <FileText className="size-4" />
              {t("exportWord")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selected.length === 0}
              onClick={() => navigate({ to: "/print", search: { ids: selected.join(",") } })}
            >
              <Printer className="size-4" />
              {t("printMultiple")} {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          </div>
        </div>

        {!isSuperAdmin ? (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            {t("readOnlyNotice")}
          </p>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("filters")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="q">{t("search")}</Label>
              <Input
                id="q"
                autoFocus={Route.useSearch().focus === "search"}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("family")}</Label>
              <Select value={family} onValueChange={setFamily}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("all")}</SelectItem>
                  {unique((s) => s.family).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("region")}</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("all")}</SelectItem>
                  {unique((s) => s.region).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("collector")}</Label>
              <Select value={collector} onValueChange={setCollector}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("all")}</SelectItem>
                  {collectorOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("status")}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("all")}</SelectItem>
                  {STATUS_ORDER.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {lang === "en" ? m.en : m.ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from">{t("dateFrom")}</Label>
              <Input
                id="from"
                type="date"
                dir="ltr"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">{t("dateTo")}</Label>
              <Input
                id="to"
                type="date"
                dir="ltr"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" onClick={clearFilters}>
                {t("clearFilters")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {t("resultsCount")}: <strong className="text-foreground">{filtered.length}</strong>
          </span>
          {selected.length > 0 ? (
            <span>
              {selected.length} {t("selected")}
            </span>
          ) : null}
        </div>

        {selected.length > 0 && (hasAnyEditable || canDelete) ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t("bulkActions")} — {selected.length} {t("selected")}
              </CardTitle>
              {hasAnyEditable && editableSelected.length < selected.length ? (
                <p className="text-xs text-muted-foreground">{t("readOnlyNotice")}</p>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {hasAnyEditable ? (
                <div className="space-y-1.5">
                  <Label>{t("bulkChangeStatus")}</Label>
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (editableSelected.length === 0) {
                        toast.error(t("noEditRights"));
                        return;
                      }
                      bulkStatusMutation.mutate({
                        ids: editableSelected,
                        status: v as SpecimenStatus,
                      });
                    }}
                    disabled={bulkStatusMutation.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("bulkChangeStatus")} />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {lang === "en" ? m.en : m.ar}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {hasAnyEditable ? (
                <>
                  <div className="space-y-1.5">
                    <Label>{t("bulkUpdateField")}</Label>
                    <Select value={bulkField} onValueChange={setBulkField}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("bulkChooseField")} />
                      </SelectTrigger>
                      <SelectContent>
                        {BULK_EDITABLE_FIELDS.map((field) => (
                          <SelectItem key={field} value={field}>
                            {f(field)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bulk-value">{t("bulkNewValue")}</Label>
                    <Input
                      id="bulk-value"
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      dir={bulkField === "determination_date" ? "ltr" : undefined}
                      type={bulkField === "determination_date" ? "date" : "text"}
                    />
                  </div>
                </>
              ) : null}
              <div className="flex flex-wrap items-end gap-2">
                {hasAnyEditable ? (
                  <Button
                    size="sm"
                    disabled={bulkFieldMutation.isPending}
                    onClick={() => {
                      if (!bulkField) {
                        toast.error(t("bulkValueRequired"));
                        return;
                      }
                      if (editableSelected.length === 0) {
                        toast.error(t("noEditRights"));
                        return;
                      }
                      bulkFieldMutation.mutate({
                        ids: editableSelected,
                        field: bulkField as BulkEditableField,
                        value: bulkValue,
                      });
                    }}
                  >
                    {t("bulkApply")}
                  </Button>
                ) : null}

                {canDelete ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={bulkDeleteMutation.isPending}
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    {t("bulkDelete")}
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                  {t("clearSelection")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full min-w-[1400px] border-collapse text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="w-10 border-b border-border p-2">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) =>
                      setSelected(checked ? filtered.map((s) => s.id) : [])
                    }
                    aria-label="select all"
                  />
                </th>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap border-b border-border p-2 text-start font-semibold"
                  >
                    {f(h)}
                  </th>
                ))}
                <th className="border-b border-border p-2 text-start font-semibold">
                  {t("status")}
                </th>
                <th className="border-b border-border p-2 text-start font-semibold">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={headers.length + 3}
                    className="p-6 text-center text-muted-foreground"
                  >
                    {t("loading")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={headers.length + 3}
                    className="p-6 text-center text-muted-foreground"
                  >
                    {t("noResults")}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-2">
                      <Checkbox
                        checked={selected.includes(s.id)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                          )
                        }
                        aria-label={s.accession_number}
                      />
                    </td>
                    <td className="whitespace-nowrap p-2 font-medium">{s.accession_number}</td>
                    <td className="whitespace-nowrap p-2 italic">{s.scientific_name}</td>
                    <td className="whitespace-nowrap p-2">{s.family ?? "—"}</td>
                    <td className="whitespace-nowrap p-2">
                      {[s.local_name, s.local_name_ar].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="whitespace-nowrap p-2">{s.locality ?? "—"}</td>
                    <td className="whitespace-nowrap p-2">{s.region ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 tabular-nums">{s.latitude ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 tabular-nums">{s.longitude ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 tabular-nums">{s.altitude_m ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 tabular-nums">
                      {formatDate(s.collection_date)}
                    </td>
                    <td className="whitespace-nowrap p-2">{s.collectors ?? "—"}</td>
                    <td className="whitespace-nowrap p-2">{s.determination ?? "—"}</td>
                    <td className="whitespace-nowrap p-2">{s.determined_by ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 tabular-nums">
                      {formatDate(s.determination_date) || "—"}
                    </td>
                    <td className="p-2">
                      <StatusSelect
                        value={s.status}
                        disabled={!canEditSpecimen(s.id) || statusMutation.isPending}
                        onChange={(status) => statusMutation.mutate({ id: s.id, status })}
                      />
                    </td>
                    <td className="whitespace-nowrap p-2">
                      <div className="flex gap-1">
                        <Button asChild size="icon" variant="ghost" title={t("view")}>
                          <Link to="/specimens/$id" params={{ id: s.id }}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        {canEditSpecimen(s.id) ? (
                          <Button asChild size="icon" variant="ghost" title={t("edit")}>
                            <Link to="/specimens/$id/edit" params={{ id: s.id }}>
                              <Pencil className="size-4" />
                            </Link>
                          </Button>
                        ) : null}
                        {canEditSpecimen(s.id) ? <RowImageUploadButton specimen={s} /> : null}

                        <Button asChild size="icon" variant="ghost" title={t("printLabel")}>
                          <Link to="/print" search={{ ids: s.id }}>
                            <Printer className="size-4" />
                          </Link>
                        </Button>
                        {canDelete ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t("delete")}
                            onClick={() => setPendingDelete(s)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteBody")} ({pendingDelete?.accession_number})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bulkConfirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bulkConfirmDeleteBody").replace("{n}", String(selected.length))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selected.length === 0) {
                  toast.error(t("noSelection"));
                  return;
                }
                bulkDeleteMutation.mutate(selected);
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
