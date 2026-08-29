import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPublicSpecimenImageUrl,
  logPublicSpecimenView,
} from "@/lib/public-views.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPublicSpecimenBySerial } from "@/lib/specimens";
import { statusLabel } from "@/lib/specimen-status";
import { BackButton } from "@/components/BackButton";

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

  const logView = useServerFn(logPublicSpecimenView);
  const logged = useRef<string | null>(null);

  // Log the visit once per serial; nothing sensitive is sent.
  useEffect(() => {
    if (!serial || logged.current === serial) return;
    logged.current = serial;
    void logView({ data: { serial } }).catch(() => undefined);
  }, [serial, logView]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-specimen", serial],
    queryFn: () => fetchPublicSpecimenBySerial(serial),
  });

  const imageUrlFn = useServerFn(getPublicSpecimenImageUrl);
  const { data: image } = useQuery({
    queryKey: ["public-specimen-image", serial],
    queryFn: () => imageUrlFn({ data: { serial } }),
    enabled: Boolean(data),
    staleTime: 8 * 60 * 1000,
  });

  return (
    <div dir={dir} className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        <BackButton fallbackTo={null} />
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-xs font-bold tracking-tight">NCVC</span>
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight text-foreground">
              {t("appName")}
            </h1>
            <p className="text-xs leading-tight text-muted-foreground">{t("org")}</p>
          </div>
        </div>

        {image?.url ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("specimenImage")}</CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={image.url}
                alt={`${t("specimenImage")} ${data?.scientific_name ?? serial}`}
                loading="lazy"
                className="max-h-72 w-full rounded-md border border-border object-contain"
              />
            </CardContent>
          </Card>
        ) : null}

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
