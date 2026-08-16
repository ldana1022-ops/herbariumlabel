import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, FileSpreadsheet, FileText, Pencil, Plus, Printer, Trash2, Upload } from "lucide-react";
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
  deleteSpecimen,
  fetchSpecimens,
  formatDate,
  isDetermined,
  type Specimen,
} from "@/lib/specimens";

export const Route = createFileRoute("/specimens/")({
  validateSearch: (search: Record<string, unknown>): { focus?: string } =>
    typeof search['focus'] === "string" ? { focus: search['focus'] as string } : {},
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
  const { t, f } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { size } = useLabelSize();
  const { can } = useAuth();
  const canEdit = can("edit");
  const canImport = can("import");
  const canDelete = can("delete");
  const { data = [], isLoading } = useQuery({ queryKey: ["specimens"], queryFn: fetchSpecimens });

  const [q, setQ] = useState("");
  const [family, setFamily] = useState(ALL);
  const [region, setRegion] = useState(ALL);
  const [collector, setCollector] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Specimen | null>(null);

  const unique = (fn: (s: Specimen) => string | null) =>
    [...new Set(data.map(fn).filter((v): v is string => Boolean(v)))].sort();

  const collectorOptions = useMemo(
    () =>
      [
        ...new Set(
          data.flatMap((s) => s.collectors.split(";").map((c) => c.trim())).filter(Boolean),
        ),
      ].sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.filter((s) => {
      if (needle) {
        const hay = [
          s.accession_number,
          s.scientific_name,
          s.family,
          s.local_name,
          s.locality,
          s.region,
          s.collectors,
          s.determination,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (family !== ALL && s.family !== family) return false;
      if (region !== ALL && s.region !== region) return false;
      if (collector !== ALL && !s.collectors.includes(collector)) return false;
      if (statusFilter === "determined" && !isDetermined(s)) return false;
      if (statusFilter === "undetermined" && isDetermined(s)) return false;
      if (from && s.collection_date < from) return false;
      if (to && s.collection_date > to) return false;
      return true;
    });
  }, [data, q, family, region, collector, statusFilter, from, to]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSpecimen(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specimens"] });
      toast.success(t("deleted"));
      setPendingDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selected.includes(s.id));

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
          <h2 className="text-xl font-semibold text-foreground">Herbarium Specimens Database</h2>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
            <Button asChild size="sm">
              <Link to="/specimens/new">
                <Plus className="size-4" />
                {t("newSpecimen")}
              </Link>
            </Button>
            ) : null}
            {canImport ? (
            <Button
              size="sm"
              variant="outline"
              asChild
            >
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("all")}</SelectItem>
                  {unique((s) => s.family).map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("region")}</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("all")}</SelectItem>
                  {unique((s) => s.region).map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("collector")}</Label>
              <Select value={collector} onValueChange={setCollector}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("all")}</SelectItem>
                  {collectorOptions.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("status")}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("all")}</SelectItem>
                  <SelectItem value="determined">Determined</SelectItem>
                  <SelectItem value="undetermined">Undetermined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from">{t("dateFrom")}</Label>
              <Input id="from" type="date" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">{t("dateTo")}</Label>
              <Input id="to" type="date" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" onClick={clearFilters}>{t("clearFilters")}</Button>
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
                  <th key={h} className="whitespace-nowrap border-b border-border p-2 text-start font-semibold">
                    {f(h)}
                  </th>
                ))}
                <th className="border-b border-border p-2 text-start font-semibold">{t("status")}</th>
                <th className="border-b border-border p-2 text-start font-semibold">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={headers.length + 3} className="p-6 text-center text-muted-foreground">
                    {t("loading")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={headers.length + 3} className="p-6 text-center text-muted-foreground">
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
                    <td className="whitespace-nowrap p-2">{s.family}</td>
                    <td className="whitespace-nowrap p-2">{s.local_name ?? "—"}</td>
                    <td className="whitespace-nowrap p-2">{s.locality}</td>
                    <td className="whitespace-nowrap p-2">{s.region ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 tabular-nums">{s.latitude ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 tabular-nums">{s.longitude ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 tabular-nums">{s.altitude_m ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 tabular-nums">{formatDate(s.collection_date)}</td>
                    <td className="whitespace-nowrap p-2">{s.collectors}</td>
                    <td className="whitespace-nowrap p-2">{s.determination ?? "—"}</td>
                    <td className="whitespace-nowrap p-2">{s.determined_by ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 tabular-nums">
                      {formatDate(s.determination_date) || "—"}
                    </td>
                    <td className="p-2">
                      <Badge variant={isDetermined(s) ? "default" : "secondary"}>
                        {isDetermined(s) ? "Determined" : "Undetermined"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap p-2">
                      <div className="flex gap-1">
                        <Button asChild size="icon" variant="ghost" title={t("view")}>
                          <Link to="/specimens/$id" params={{ id: s.id }}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        {canEdit ? (
                        <Button asChild size="icon" variant="ghost" title={t("edit")}>
                          <Link to="/specimens/$id/edit" params={{ id: s.id }}>
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                        ) : null}
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
    </AppLayout>
  );
}