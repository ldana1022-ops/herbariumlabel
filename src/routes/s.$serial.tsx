import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fetchPublicSpecimenBySerial } from "@/lib/specimens";

export const Route = createFileRoute("/s/$serial")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "فتح عينة بالباركود | نظام إدارة ملصقات المعشبة" },
      {
        name: "description",
        content: "فتح بيانات عينة المعشبة النباتية مباشرة من الرقم التسلسلي أو مسح الباركود.",
      },
      { property: "og:title", content: "فتح عينة بالباركود | نظام إدارة ملصقات المعشبة" },
      { property: "og:description", content: "الوصول السريع لبيانات العينة عبر الباركود." },
    ],
  }),
  component: SerialLookupPage,
});

function SerialLookupPage() {
  const { serial } = useParams({ from: "/s/$serial" });
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["specimen-serial", serial],
    queryFn: () => fetchPublicSpecimenBySerial(serial),
  });

  useEffect(() => {
    if (data) navigate({ to: "/specimens/$id", params: { id: data.id }, replace: true });
  }, [data, navigate]);

  return (
    <AppLayout>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {isLoading ? t("loading") : error ? (error as Error).message : t("serialNotFound")}
        </p>
        {!isLoading && !data ? (
          <Button asChild variant="outline">
            <Link to="/specimens">{t("backToList")}</Link>
          </Button>
        ) : null}
      </div>
    </AppLayout>
  );
}
