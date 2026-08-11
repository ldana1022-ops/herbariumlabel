import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { HerbariumLabel } from "@/components/HerbariumLabel";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { fetchSpecimens } from "@/lib/specimens";

export const Route = createFileRoute("/print")({
  validateSearch: (search: Record<string, unknown>): { ids: string } => ({
    ids: typeof search['ids'] === "string" ? (search['ids'] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "طباعة ملصقات المعشبة | NCVC" },
      {
        name: "description",
        content: "معاينة وطباعة ملصقات عينات المعشبة النباتية بمقاس ثابت وجودة عالية.",
      },
      { property: "og:title", content: "طباعة ملصقات المعشبة | NCVC" },
      { property: "og:description", content: "معاينة وطباعة ملصقات عينات المعشبة النباتية." },
    ],
  }),
  component: PrintPage,
});

function PrintPage() {
  const { ids } = Route.useSearch();
  const { t, dir } = useI18n();
  const { data = [], isLoading } = useQuery({ queryKey: ["specimens"], queryFn: fetchSpecimens });

  const idList = ids
    .split(",")
    .map((v: string) => v.trim())
    .filter(Boolean);
  const labels = idList.length > 0 ? data.filter((s) => idList.includes(s.id)) : [];

  return (
    <div dir={dir} className="min-h-screen bg-muted/40">
      <div className="print-hide border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">{t("printLabels")}</h1>
            <p className="text-xs text-muted-foreground">
              {labels.length > 0 ? `${labels.length} ${t("labelsSelected")}` : t("selectToPrint")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => window.print()} disabled={labels.length === 0}>
              <Printer className="size-4" />
              {t("print")}
            </Button>
            <Button asChild variant="outline">
              <Link to="/specimens">{t("backToList")}</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {isLoading ? (
          <p className="print-hide text-sm text-muted-foreground">{t("loading")}</p>
        ) : labels.length === 0 ? (
          <p className="print-hide text-sm text-muted-foreground">{t("selectToPrint")}</p>
        ) : (
          <div className="print-sheet">
            {labels.map((s) => (
              <HerbariumLabel key={s.id} specimen={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}