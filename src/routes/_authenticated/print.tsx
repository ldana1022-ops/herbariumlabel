import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recordPrints } from "@/lib/prints";
import { useMemo } from "react";
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
import { bulkUpdateStatus, fetchSpecimens, type Specimen } from "@/lib/specimens";
import { toMm, useLabelSize } from "@/lib/label-size";
import { useBarcodeSize } from "@/lib/barcode-size";
import { useBarcodeText } from "@/lib/barcode-text";
import { useRealtimeSync } from "@/lib/realtime";
import { BarcodeTextControls } from "@/components/BarcodeTextControls";
import {
  CUSTOM_PAPER,
  PAPERS,
  resolvePaperMm,
  usePrintSettings,
  type PaperUnit,
  type PrintMode,
} from "@/lib/print-settings";
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

function PrintPage() {
  const { ids = "" } = Route.useSearch();
  const { t, dir } = useI18n();
  useRealtimeSync(true);
  const { size, setSize } = useLabelSize();
  const barcode = useBarcodeSize();
  const barcodeText = useBarcodeText();
  const { settings, update } = usePrintSettings();
  const { mode, paper, orientation, margin, cols, gap, copies, customPaper } = settings;
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["specimens"], queryFn: fetchSpecimens });


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
      // Best-effort status sync: only allowed for specimens the user may update.
      try {
        await bulkUpdateStatus(
          selectedLabels.map((s) => s.id),
          "printed",
        );
      } catch {
        /* read-only specimens keep their current status */
      }
      await queryClient.invalidateQueries({ queryKey: ["specimen-prints"] });
      await queryClient.invalidateQueries({ queryKey: ["specimens"] });
      toast.success(t("printRecorded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };


  const paperSize = resolvePaperMm(settings);
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
          {mode !== "labels" ? (
            <BarcodeTextControls
              settings={barcodeText.settings}
              onChange={barcodeText.update}
              onReset={barcodeText.reset}
            />
          ) : null}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("printSettings")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("printMode")}</Label>
                <Select value={mode} onValueChange={(v) => update({ mode: v as PrintMode })}>
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
                <Select value={paper} onValueChange={(v) => update({ paper: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(PAPERS).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_PAPER}>{t("customSize")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paper === CUSTOM_PAPER ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="paper-w">
                      {t("paperSize")} — {t("width")} ({customPaper.unit})
                    </Label>
                    <Input
                      id="paper-w"
                      type="number"
                      min={20}
                      step="0.1"
                      dir="ltr"
                      value={customPaper.width}
                      onChange={(e) =>
                        update({
                          customPaper: { ...customPaper, width: Number(e.target.value) || 0 },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paper-h">
                      {t("paperSize")} — {t("height")} ({customPaper.unit})
                    </Label>
                    <Input
                      id="paper-h"
                      type="number"
                      min={20}
                      step="0.1"
                      dir="ltr"
                      value={customPaper.height}
                      onChange={(e) =>
                        update({
                          customPaper: { ...customPaper, height: Number(e.target.value) || 0 },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{t("unit")}</Label>
                    <Select
                      value={customPaper.unit}
                      onValueChange={(v) => {
                        const unit = v as PaperUnit;
                        if (unit === customPaper.unit) return;
                        const factor = unit === "cm" ? 0.1 : 10;
                        update({
                          customPaper: {
                            unit,
                            width: Number((customPaper.width * factor).toFixed(2)),
                            height: Number((customPaper.height * factor).toFixed(2)),
                          },
                        });
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mm">mm</SelectItem>
                        <SelectItem value="cm">cm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}
              <div className="space-y-1.5">
                <Label>{t("orientation")}</Label>
                <Select
                  value={orientation}
                  onValueChange={(v) =>
                    update({ orientation: v as "portrait" | "landscape" })
                  }
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
                  onChange={(e) => update({ margin: Number(e.target.value) || 0 })}
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
                  onChange={(e) => update({ cols: Math.max(1, Number(e.target.value) || 1) })}
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
                  onChange={(e) => update({ gap: Number(e.target.value) || 0 })}
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
                  onChange={(e) => update({ copies: Math.max(1, Number(e.target.value) || 1) })}
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
                    <BarcodeSection
                      serial={s.serial_number}
                      size={barcode.size}
                      text={barcodeText.settings}
                    />
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
