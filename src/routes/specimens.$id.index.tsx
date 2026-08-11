import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Pencil, Printer } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { HerbariumLabel } from "@/components/HerbariumLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import {
  fetchSpecimen,
  formatDate,
  isDetermined,
  updateSpecimen,
  type Specimen,
} from "@/lib/specimens";

export const Route = createFileRoute("/specimens/$id/")({
  head: () => ({
    meta: [
      { title: "تفاصيل العينة | نظام إدارة ملصقات المعشبة" },
      {
        name: "description",
        content: "عرض تفاصيل عينة المعشبة النباتية وتحديث بيانات التصنيف العلمي وطباعة الملصق.",
      },
      { property: "og:title", content: "تفاصيل العينة | نظام إدارة ملصقات المعشبة" },
      { property: "og:description", content: "تفاصيل عينة المعشبة وتحديث التصنيف وطباعة الملصق." },
    ],
  }),
  component: SpecimenDetailPage,
});

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex gap-2 border-b border-border py-1.5 text-sm last:border-0">
      <span className="w-40 shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="text-foreground">{value === null || value === undefined || value === "" ? "—" : value}</span>
    </div>
  );
}

function SpecimenDetailPage() {
  const { id } = useParams({ from: "/specimens/$id/" });
  const { t, f } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["specimen", id],
    queryFn: () => fetchSpecimen(id),
  });

  const [det, setDet] = useState({ determination: "", determined_by: "", determination_date: "" });

  useEffect(() => {
    if (data) {
      setDet({
        determination: data.determination ?? "",
        determined_by: data.determined_by ?? "",
        determination_date: data.determination_date ?? "",
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateSpecimen(id, {
        determination: det.determination.trim() || null,
        determined_by: det.determined_by.trim() || null,
        determination_date: det.determination_date || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specimen", id] });
      queryClient.invalidateQueries({ queryKey: ["specimens"] });
      toast.success(t("updated"));
    },
    onError: (e: Error) => toast.error(e.message),
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

  const s: Specimen = data;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{s.accession_number}</h2>
            <p className="text-sm italic text-muted-foreground">{s.scientific_name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={isDetermined(s) ? "default" : "secondary"}>
              {isDetermined(s) ? "Determined" : "Undetermined"}
            </Badge>
            <Button asChild size="sm" variant="outline">
              <Link to="/specimens/$id/edit" params={{ id: s.id }}>
                <Pencil className="size-4" />
                {t("edit")}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/print" search={{ ids: s.id }}>
                <Printer className="size-4" />
                {t("printLabel")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/specimens">
                <ArrowRight className="size-4" />
                {t("backToList")}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("specimenData")}</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailRow label={f("accession_number")} value={s.accession_number} />
              <DetailRow label={f("scientific_name")} value={s.scientific_name} />
              <DetailRow label={f("family")} value={s.family} />
              <DetailRow label={f("local_name")} value={s.local_name} />
              <DetailRow label={f("locality")} value={s.locality} />
              <DetailRow label={f("region")} value={s.region} />
              <DetailRow label={f("latitude")} value={s.latitude} />
              <DetailRow label={f("longitude")} value={s.longitude} />
              <DetailRow label={f("altitude_m")} value={s.altitude_m} />
              <DetailRow label={f("collection_date")} value={formatDate(s.collection_date)} />
              <DetailRow label={f("collectors")} value={s.collectors} />
              <DetailRow label={f("notes")} value={s.notes} />
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("determinationSection")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("determinationHint")}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="determination">{f("determination")}</Label>
                  <Input
                    id="determination"
                    value={det.determination}
                    onChange={(e) => setDet({ ...det, determination: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="determined_by">{f("determined_by")}</Label>
                  <Input
                    id="determined_by"
                    value={det.determined_by}
                    onChange={(e) => setDet({ ...det, determined_by: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="determination_date">{f("determination_date")}</Label>
                  <Input
                    id="determination_date"
                    type="date"
                    dir="ltr"
                    value={det.determination_date}
                    onChange={(e) => setDet({ ...det, determination_date: e.target.value })}
                  />
                </div>
                <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                  {t("updateDetermination")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("labelPreview")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border border-border bg-white p-3">
                  <HerbariumLabel specimen={s} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}