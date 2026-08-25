import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SpecimenForm } from "@/components/SpecimenForm";
import { HerbariumLabel } from "@/components/HerbariumLabel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import {
  createSpecimen,
  emptySpecimen,
  type Specimen,
  type SpecimenPayload,
} from "@/lib/specimens";

export const Route = createFileRoute("/_authenticated/specimens/new")({
  head: () => ({
    meta: [
      { title: "إضافة عينة جديدة | نظام إدارة ملصقات المعشبة" },
      {
        name: "description",
        content: "نموذج رسمي لإدخال بيانات عينة نباتية جديدة وإنشاء ملصق المعشبة تلقائيًا.",
      },
      { property: "og:title", content: "إضافة عينة جديدة | نظام إدارة ملصقات المعشبة" },
      {
        property: "og:description",
        content: "إدخال بيانات عينة نباتية جديدة وإنشاء الملصق العلمي.",
      },
    ],
  }),
  component: NewSpecimenPage,
});

function NewSpecimenPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<Specimen | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: SpecimenPayload) => createSpecimen(payload),
    onSuccess: (specimen) => {
      queryClient.invalidateQueries({ queryKey: ["specimens"] });
      setCreated(specimen);
      toast.success(t("saved"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error: Error) => {
      toast.error(error.message === "DUPLICATE_ACCESSION" ? t("duplicate") : error.message);
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">{t("newSpecimen")}</h2>

        {created ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("labelPreview")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-md border border-border bg-white p-3">
                <HerbariumLabel specimen={created} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/print" search={{ ids: created.id }}>
                    <Printer className="size-4" />
                    {t("printLabel")}
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => navigate({ to: "/specimens" })}>
                  {t("database")}
                </Button>
                <Button variant="ghost" onClick={() => setCreated(null)}>
                  {t("newSpecimen")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <SpecimenForm
            initial={emptySpecimen}
            submitLabel={t("save")}
            submitting={mutation.isPending}
            onSubmit={(payload) => mutation.mutate(payload)}
            onCancel={() => navigate({ to: "/specimens" })}
          />
        )}
      </div>
    </AppLayout>
  );
}
