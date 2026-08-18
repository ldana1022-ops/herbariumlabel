import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Database, FileSpreadsheet, Plus, Printer, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { exportSpecimensToExcel } from "@/lib/export-excel";
import { fetchSpecimens, type Specimen } from "@/lib/specimens";
import { normalizeStatus, STATUS_ORDER } from "@/lib/specimen-status";
import { countByRegion } from "@/lib/region";
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

function countBy(list: Specimen[], key: (s: Specimen) => string) {
  const map = new Map<string, number>();
  for (const s of list) {
    const k = key(s) || "—";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function Index() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["specimens"], queryFn: fetchSpecimens });

  const statusCounts = STATUS_ORDER.map((m) => ({
    meta: m,
    count: data.filter((s) => normalizeStatus(s.status) === m.value).length,
  }));
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = data.filter((s) => new Date(s.created_at).getTime() >= cutoff).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t("dashboard")}</h2>
          <p className="text-sm text-muted-foreground">{t("org")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("total")} value={data.length} />
          <Stat label={t("recent")} value={recent} />
          {statusCounts.map(({ meta, count }) => (
            <Stat key={meta.value} label={lang === "en" ? meta.en : meta.ar} value={count} />
          ))}
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
            <Button
              variant="outline"
              onClick={() => exportSpecimensToExcel(data)}
              disabled={data.length === 0}
            >
              <FileSpreadsheet className="size-4" />
              {t("exportExcel")}
            </Button>
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
                <div key={region.key} className="flex items-center justify-between border-b border-border pb-1.5 text-sm last:border-0">
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
                <div key={name} className="flex items-center justify-between border-b border-border pb-1.5 text-sm last:border-0">
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
