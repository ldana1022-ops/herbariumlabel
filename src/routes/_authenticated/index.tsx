import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Database, FileSpreadsheet, Plus, Printer, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { exportSpecimensToExcel } from "@/lib/export-excel";
import {
  fetchAllMatchingSpecimens,
  fetchSpecimenDashboard,
  fetchSpecimensPage,
  formatDate,
} from "@/lib/specimens";
import { fetchPrintRecords } from "@/lib/prints";
import { STATUS_ORDER } from "@/lib/specimen-status";
import { countByRegionGroups } from "@/lib/region";
import { StatusBadge } from "@/components/StatusBadge";


export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | نظام إدارة ملصقات المعشبة النباتية" },
      {
        name: "description",
        content:
          "لوحة تحكم رسمية تعرض إحصائيات عينات المعشبة النباتية حسب المنطقة والفصيلة وحالة التصنيف.",
      },
      { property: "og:title", content: "لوحة التحكم | نظام إدارة ملصقات المعشبة النباتية" },
      {
        property: "og:description",
        content: "إحصائيات عينات المعشبة النباتية وحالة التصنيف والتوزيع الجغرافي.",
      },
    ],
  }),
  component: Index,
});

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

const PRINTED_PAGE_SIZE = 50;

function Index() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [printedPage, setPrintedPage] = useState(0);
  const [busy, setBusy] = useState(false);

  // Counters aggregated in the database instead of loading every row.
  const { data: stats, isLoading } = useQuery({
    queryKey: ["specimen-dashboard"],
    queryFn: fetchSpecimenDashboard,
  });
  const { data: prints = [] } = useQuery({
    queryKey: ["specimen-prints"],
    queryFn: fetchPrintRecords,
  });
  // Printed specimens, one page at a time.
  const { data: printedData } = useQuery({
    queryKey: ["specimens", "printed", printedPage],
    queryFn: () => fetchSpecimensPage({ status: "printed" }, printedPage, PRINTED_PAGE_SIZE),
    placeholderData: (prev) => prev,
  });

  const printedMap = new Map(prints.map((p) => [p.specimen_id, p]));
  const printedList = printedData?.rows ?? [];
  const printedTotal = printedData?.total ?? 0;
  const printedPageCount = Math.max(1, Math.ceil(printedTotal / PRINTED_PAGE_SIZE));

  const statusCounts = STATUS_ORDER.map((m) => ({
    meta: m,
    count: stats?.statuses[m.value] ?? 0,
  }));
  const total = stats?.total ?? 0;
  const recent = stats?.recent ?? 0;

  const exportAll = async () => {
    setBusy(true);
    try {
      exportSpecimensToExcel(await fetchAllMatchingSpecimens({}));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t("dashboard")}</h2>
          <p className="text-sm text-muted-foreground">{t("org")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("total")} value={total} />
          <Stat label={t("recent")} value={recent} />
          {statusCounts.map(({ meta, count }) => (
            <Stat key={meta.value} label={lang === "en" ? meta.en : meta.ar} value={count} />
          ))}
          <Stat label={t("printedCount")} value={printedTotal} />
        </div>


        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/specimens/new">
                <Plus className="size-4" />
                {t("newSpecimen")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/specimens">
                <Database className="size-4" />
                {t("database")}
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/specimens", search: { focus: "search" } })}
            >
              <Search className="size-4" />
              {t("search")}
            </Button>
            <Button asChild variant="outline">
              <Link to="/print">
                <Printer className="size-4" />
                {t("printLabels")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void exportAll()} disabled={total === 0 || busy}>
              <FileSpreadsheet className="size-4" />
              {t("exportExcel")}
            </Button>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("printed")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
            {!isLoading && printedList.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("printedNone")}</p>
            ) : null}
            {printedList.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1.5 text-sm last:border-0"
              >
                <Link
                  to="/specimens/$id"
                  params={{ id: s.id }}
                  className="font-medium hover:underline"
                >
                  <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                    {s.serial_number}
                  </span>{" "}
                  <span className="italic">{s.scientific_name}</span>
                </Link>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  {printedMap.get(s.id) ? (
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {formatDate(printedMap.get(s.id)!.last_printed_at.slice(0, 10))}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("byRegion")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
              {!isLoading && data.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noResults")}</p>
              ) : null}
              {countByRegion(data).map(({ region, count }) => (
                <div
                  key={region.key}
                  className="flex items-center justify-between border-b border-border pb-1.5 text-sm last:border-0"
                >
                  <span>{lang === "en" ? region.en : region.ar}</span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("byFamily")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {countBy(data, (s) => s.family).map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between border-b border-border pb-1.5 text-sm last:border-0"
                >
                  <span className="font-medium">{name}</span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
