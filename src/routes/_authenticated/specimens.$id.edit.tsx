import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { SpecimenForm } from "@/components/SpecimenForm";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  fetchSpecimen,
  updateSpecimen,
  type SpecimenInput,
  type SpecimenPayload,
} from "@/lib/specimens";

export const Route = createFileRoute("/_authenticated/specimens/$id/edit")({
  head: () => ({
    meta: [
      { title: "تعديل بيانات العينة | نظام إدارة ملصقات المعشبة" },
      {
        name: "description",
        content: "تعديل بيانات عينة المعشبة النباتية المسجلة في قاعدة البيانات الرسمية.",
      },
      { property: "og:title", content: "تعديل بيانات العينة | نظام إدارة ملصقات المعشبة" },
      { property: "og:description", content: "تحديث بيانات عينة المعشبة النباتية." },
    ],
  }),
  component: EditSpecimenPage,
});

function EditSpecimenPage() {
  const { id } = useParams({ from: "/_authenticated/specimens/$id/edit" });
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["specimen", id],
    queryFn: () => fetchSpecimen(id),
  });

  const mutation = useMutation({
    mutationFn: (payload: SpecimenPayload) => updateSpecimen(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specimen", id] });
      queryClient.invalidateQueries({ queryKey: ["specimens"] });
      toast.success(t("updated"));
      navigate({ to: "/specimens/$id", params: { id } });
    },
    onError: (e: Error) =>
      toast.error(e.message === "DUPLICATE_ACCESSION" ? t("duplicate") : e.message),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("notFound")}</p>
          <Button variant="outline" onClick={() => navigate({ to: "/specimens" })}>
            {t("backToList")}
          </Button>
        </div>
      </AppLayout>
    );
  }

  const initial: SpecimenInput = {
    accession_number: data.accession_number,
    scientific_name: data.scientific_name,
    family: data.family ?? "",
    local_name: data.local_name ?? "",
    local_name_ar: data.local_name_ar ?? "",
    locality: data.locality ?? "",
    region: data.region ?? "",
    latitude: data.latitude ?? "",
    longitude: data.longitude ?? "",
    altitude_m: data.altitude_m ?? "",
    collection_date: data.collection_date ?? "",
    collectors: data.collectors ?? "",
    determination: data.determination ?? "",
    determined_by: data.determined_by ?? "",
    determination_date: data.determination_date ?? "",
    notes: data.notes ?? "",
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <h2 className="text-xl font-semibold text-foreground">
          {t("editSpecimen")} — {data.accession_number}
        </h2>
        <SpecimenForm
          initial={initial}
          submitLabel={t("save")}
          submitting={mutation.isPending}
          onSubmit={(payload) => mutation.mutate(payload)}
          onCancel={() => navigate({ to: "/specimens/$id", params: { id } })}
        />
      </div>
    </AppLayout>
  );
}