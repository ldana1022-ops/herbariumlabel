import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recordPrints } from "@/lib/prints";
import { useMemo, useState } from "react";
import { FileText, Printer } from "lucide-react";
import { HerbariumLabel } from "@/components/HerbariumLabel";
import { LabelSizeControls } from "@/components/LabelSizeControls";
import { BarcodeSection } from "@/components/BarcodeSection";
import { BarcodeSizeControls } from "@/components/BarcodeSizeControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { fetchSpecimens, type Specimen } from "@/lib/specimens";
import { toMm, useLabelSize } from "@/lib/label-size";
import { useBarcodeSize } from "@/lib/barcode-size";
import { exportLabelsToWord } from "@/lib/export-word";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated/print")({
  validateSearch: (search: Record<string, unknown>): { ids?: string } =>
    typeof search['ids'] === "string" ? { ids: search['ids'] as string } : {},
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

const PAPERS: Record<string, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  A3: { w: 297, h: 420 },
  Letter: { w: 216, h: 279 },
};

type PrintMode = "labels" | "barcodes" | "both";

function PrintPage() {
  const { ids = "" } = Route.useSearch();
  const { t, dir } = useI18n();
  const { size, setSize } = useLabelSize();
  const barcode = useBarcodeSize();
  const [mode, setMode] = useState<PrintMode>("both");
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["specimens"], queryFn: fetchSpecimens });

  const [paper, setPaper] = useState("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [margin, setMargin] = useState(8);
  const [cols, setCols] = useState(2);
  const [gap, setGap] = useState(4);
  const [copies, setCopies] = useState(1);

  const idList = ids
    .split(",")
    .map((v: string) => v.trim())
    .filter(Boolean);
  const selectedLabels = idList.length > 0 ? data.filter((s) => idList.includes(s.id)) : [];

  const labels: Specimen[] = useMemo(
    () => Array.from({ length: Math.max(1, copies) }).flatMap(() => selectedLabels),
    [selectedLabels, copies],
  );

  const handlePrint = async () => {
    window.print();
    try {
      await recordPrints(
        selectedLabels.map((s) => ({ id: s.id, serial_number: s.serial_number })),
      );
      await queryClient.invalidateQueries({ queryKey: ["specimen-prints"] });
      toast.success(t("printRecorded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const paperSize = PAPERS[paper] ?? PAPERS['A4']!;
  const pageCss = `@page { size: ${paperSize.w}mm ${paperSize.h}mm ${orientation}; margin: ${margin}mm; }`;
  const sheetVars = {
    ["--sheet-cols" as string]: String(cols),
    ["--sheet-gap" as string]: `${gap}mm`,
    ["--label-w" as string]: `${toMm(size.width, size.unit)}mm`,
    ["--label-h" as string]: `${toMm(size.height, size.unit)}mm`,
  } as React.CSSProperties;

  const previewWidth =
    orientation === "portrait" ? paperSize.w : paperSize.h;
  const previewHeight = orientation === "portrait" ? paperSize.h : paperSize.w;

  return (
    <div dir={dir} className="min-h-screen bg-muted/40">
      <style>{pageCss}</style>
      <div className="print-hide mx-auto max-w-6xl px-4 pt-3">
        <BackButton />
      </div>
      <div className="print-hide border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">{t("printLabels")}</h1>
            <p className="text-xs text-muted-foreground">
              {labels.length > 0 ? `${labels.length} ${t("labelsSelected")}` : t("selectToPrint")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePrint} disabled={labels.length === 0}>
              <Printer className="size-4" />
              {t("print")}
            </Button>
            <Button
              variant="outline"
              disabled={labels.length === 0}
              onClick={() => exportLabelsToWord(labels, size)}
            >
              <FileText className="size-4" />
              {t("exportWord")}
            </Button>
            <Button asChild variant="outline">
              <Link to="/specimens">{t("backToList")}</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="print-hide grid gap-5 lg:grid-cols-2">
          {mode !== "barcodes" ? <LabelSizeControls size={size} onChange={setSize} /> : null}
          {mode !== "labels" ? (
            <BarcodeSizeControls
              size={barcode.size}
              onChange={barcode.setSize}
              saved={barcode.saved}
              onSave={barcode.saveSize}
              onUpdateSaved={barcode.updateSaved}
              onRemoveSaved={barcode.removeSaved}
            />
          ) : null}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("printSettings")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("printMode")}</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as PrintMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="labels">{t("labelsOnly")}</SelectItem>
                    <SelectItem value="barcodes">{t("barcodesOnly")}</SelectItem>
                    <SelectItem value="both">{t("labelsAndBarcodes")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("paperSize")}</Label>
                <Select value={paper} onValueChange={setPaper}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(PAPERS).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("orientation")}</Label>
                <Select
                  value={orientation}
                  onValueChange={(v) => setOrientation(v as "portrait" | "landscape")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">{t("portrait")}</SelectItem>
                    <SelectItem value="landscape">{t("landscape")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="margin">{t("margins")} (mm)</Label>
                <Input
                  id="margin"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cols">{t("labelsPerRow")}</Label>
                <Input
                  id="cols"
                  type="number"
                  min={1}
                  max={6}
                  dir="ltr"
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gap">{t("labelGap")} (mm)</Label>
                <Input
                  id="gap"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={gap}
                  onChange={(e) => setGap(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="copies">{t("copies")}</Label>
                <Input
                  id="copies"
                  type="number"
                  min={1}
                  max={20}
                  dir="ltr"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="print-hide text-sm font-medium text-foreground">{t("printPreview")}</p>

        {isLoading ? (
          <p className="print-hide text-sm text-muted-foreground">{t("loading")}</p>
        ) : labels.length === 0 ? (
          <p className="print-hide text-sm text-muted-foreground">{t("selectToPrint")}</p>
        ) : (
          <div
            className="print-page mx-auto bg-white shadow-sm print:shadow-none"
            style={{
              width: `${previewWidth}mm`,
              minHeight: `${previewHeight}mm`,
              padding: `${margin}mm`,
            }}
          >
            <div className="print-sheet" style={sheetVars}>
              {labels.map((s, i) => (
                <div className="print-group" key={`${s.id}-${i}`}>
                  {mode !== "barcodes" ? <HerbariumLabel specimen={s} size={size} /> : null}
                  {mode !== "labels" ? (
                    <BarcodeSection serial={s.serial_number} size={barcode.size} />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
