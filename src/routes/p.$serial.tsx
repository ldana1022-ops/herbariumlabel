import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPublicSpecimenBySerial } from "@/lib/specimens";
import { statusLabel } from "@/lib/specimen-status";

export const Route = createFileRoute("/p/$serial")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "بيانات عينة المعشبة | معشبة NCVC" },
      {
        name: "description",
        content: "عرض عام مختصر لبيانات عينة المعشبة النباتية عبر الرقم التسلسلي أو مسح الباركود.",
      },
      { property: "og:title", content: "بيانات عينة المعشبة | معشبة NCVC" },
      { property: "og:description", content: "ملخص عام لبيانات العينة النباتية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicSpecimenPage,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

function PublicSpecimenPage() {
  const { serial } = useParams({ from: "/p/$serial" });
  const { t, f, lang, dir } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-specimen", serial],
    queryFn: () => fetchPublicSpecimenBySerial(serial),
  });

  return (
    <div dir={dir} className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-xs font-bold tracking-tight">NCVC</span>
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight text-foreground">{t("appName")}</h1>
            <p className="text-xs leading-tight text-muted-foreground">{t("org")}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("publicSummary")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            ) : error || !data ? (
              <p className="text-sm text-muted-foreground">{t("serialNotFound")}</p>
            ) : (
              <div className="space-y-0">
                <Row label={f("serial_number")} value={data.serial_number} />
                <Row label={f("scientific_name")} value={data.scientific_name} />
                <Row label={f("family")} value={data.family ?? ""} />
                <Row label={f("locality")} value={data.locality ?? ""} />
                <Row label={f("region")} value={data.region ?? ""} />
                <Row label={t("status")} value={statusLabel(data.status, lang)} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/auth">{t("signInToContinue")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
