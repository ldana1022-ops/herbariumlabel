import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileUp, Upload } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import {
  IMPORT_FIELDS,
  autoMap,
  mapRows,
  parseExcelFile,
  type ImportField,
  type MappedRow,
} from "@/lib/import-excel";
import { bulkInsertSpecimens, bulkUpdateSpecimens, fetchSpecimens } from "@/lib/specimens";

export const Route = createFileRoute("/specimens/import")({
  head: () => ({
    meta: [
      { title: "استيراد عينات من Excel | NCVC" },
      {
        name: "description",
        content: "رفع ملف Excel ومطابقة الأعمدة وفحص التكرار ومعاينة البيانات قبل استيرادها.",
      },
      { property: "og:title", content: "استيراد عينات من Excel | NCVC" },
      {
        property: "og:description",
        content: "استيراد بيانات عينات المعشبة من ملفات Excel مع معاينة ومطابقة أعمدة.",
      },
    ],
  }),
  component: ImportPage,
});

const IGNORE = "__ignore__";

function ImportPage() {
  const { t, f } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: existing = [] } = useQuery({ queryKey: ["specimens"], queryFn: fetchSpecimens });

  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<ImportField, string>>(
    {} as Record<ImportField, string>,
  );
  const [dupMode, setDupMode] = useState<"skip" | "update">("skip");
  const [busy, setBusy] = useState(false);

  const existingByAccession = useMemo(
    () => new Map(existing.map((s) => [s.accession_number.trim().toLowerCase(), s.id])),
    [existing],
  );

  const mapped: MappedRow[] = useMemo(
    () => (rows.length > 0 && columns.length > 0 ? mapRows(rows, mapping) : []),
    [rows, columns, mapping],
  );

  const valid = mapped.filter((r) => r.payload);
  const invalid = mapped.filter((r) => !r.payload);
  const duplicates = valid.filter((r) =>
    existingByAccession.has(r.values.accession_number.trim().toLowerCase()),
  );
  const fresh = valid.filter(
    (r) => !existingByAccession.has(r.values.accession_number.trim().toLowerCase()),
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = await parseExcelFile(file);
      setFileName(file.name);
      setColumns(parsed.columns);
      setRows(parsed.rows);
      setMapping(autoMap(parsed.columns));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const runImport = async () => {
    setBusy(true);
    try {
      let inserted = 0;
      let updated = 0;
      if (fresh.length > 0) {
        inserted = await bulkInsertSpecimens(fresh.map((r) => r.payload!));
      }
      if (dupMode === "update" && duplicates.length > 0) {
        updated = await bulkUpdateSpecimens(
          duplicates.map((r) => ({
            id: existingByAccession.get(r.values.accession_number.trim().toLowerCase())!,
            payload: r.payload!,
          })),
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["specimens"] });
      toast.success(`${t("importDone")} (+${inserted} / ~${updated})`);
      navigate({ to: "/specimens" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const previewFields: ImportField[] = [
    "accession_number",
    "scientific_name",
    "family",
    "local_name",
    "local_name_ar",
    "locality",
    "collection_date",
    "collectors",
  ];

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-foreground">{t("importTitle")}</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/specimens">{t("backToList")}</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("chooseFile")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {fileName ? (
              <p className="text-xs text-muted-foreground">
                <FileUp className="me-1 inline size-3.5" />
                {fileName} — {rows.length}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {columns.length > 0 ? (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("columnMapping")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {IMPORT_FIELDS.map((field) => (
                  <div key={field} className="space-y-1.5">
                    <Label>{f(field)}</Label>
                    <Select
                      value={mapping[field] || IGNORE}
                      onValueChange={(v) =>
                        setMapping((prev) => ({ ...prev, [field]: v === IGNORE ? "" : v }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IGNORE}>{t("ignoreColumn")}</SelectItem>
                        {columns.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="default">{t("validRows")}: {valid.length}</Badge>
              <Badge variant="secondary">{t("newRows")}: {fresh.length}</Badge>
              <Badge variant="secondary">{t("duplicateRows")}: {duplicates.length}</Badge>
              <Badge variant="destructive">{t("invalidRows")}: {invalid.length}</Badge>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("duplicateAction")}</CardTitle>
              </CardHeader>
              <CardContent className="max-w-sm">
                <Select value={dupMode} onValueChange={(v) => setDupMode(v as "skip" | "update")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">{t("skipDuplicates")}</SelectItem>
                    <SelectItem value="update">{t("updateDuplicates")}</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">{t("previewRows")}</p>
              <div className="overflow-x-auto rounded-md border border-border bg-card">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="border-b border-border p-2 text-start font-semibold">
                        {t("rowNumber")}
                      </th>
                      {previewFields.map((field) => (
                        <th
                          key={field}
                          className="whitespace-nowrap border-b border-border p-2 text-start font-semibold"
                        >
                          {f(field)}
                        </th>
                      ))}
                      <th className="border-b border-border p-2 text-start font-semibold">
                        {t("status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapped.slice(0, 50).map((r) => {
                      const dup = existingByAccession.has(
                        r.values.accession_number.trim().toLowerCase(),
                      );
                      return (
                        <tr key={r.index} className="border-b border-border last:border-0">
                          <td className="p-2 tabular-nums">{r.index + 2}</td>
                          {previewFields.map((field) => (
                            <td key={field} className="whitespace-nowrap p-2">
                              {r.values[field] || "—"}
                            </td>
                          ))}
                          <td className="p-2">
                            {!r.payload ? (
                              <Badge variant="destructive">{r.error}</Badge>
                            ) : dup ? (
                              <Badge variant="secondary">{t("duplicateRows")}</Badge>
                            ) : (
                              <Badge>{t("newRows")}</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Button
              onClick={runImport}
              disabled={busy || (fresh.length === 0 && !(dupMode === "update" && duplicates.length > 0))}
            >
              <Upload className="size-4" />
              {busy ? t("importing") : t("startImport")}
            </Button>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
