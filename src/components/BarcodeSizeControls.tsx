import { useState } from "react";
import { Minus, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import {
  BARCODE_PRESETS,
  DEFAULT_BARCODE_SIZE,
  barcodeToMm,
  type BarcodeSize,
  type BarcodeUnit,
  type SavedBarcodeSize,
} from "@/lib/barcode-size";

const CUSTOM = "__custom__";

type Props = {
  size: BarcodeSize;
  onChange: (next: BarcodeSize) => void;
  saved: SavedBarcodeSize[];
  onSave: (name: string, size: BarcodeSize) => void;
  onUpdateSaved: (id: string, patch: Partial<SavedBarcodeSize>) => void;
  onRemoveSaved: (id: string) => void;
};

export function BarcodeSizeControls({
  size,
  onChange,
  saved,
  onSave,
  onUpdateSaved,
  onRemoveSaved,
}: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const unit: BarcodeUnit = size.unit ?? "mm";

  const active =
    BARCODE_PRESETS.find(
      (p) => p.size.width === size.width && p.size.height === size.height && unit === p.size.unit,
    )?.id ??
    saved.find(
      (s) => s.width === size.width && s.height === size.height && (s.unit ?? "mm") === unit,
    )?.id ??
    CUSTOM;

  const scale = (factor: number) =>
    onChange({ ...size, width: size.width * factor, height: size.height * factor });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("barcodeSize")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("barcodeSizeHint")}</p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("presets")}</Label>
          <Select
            value={active}
            onValueChange={(v) => {
              if (v === CUSTOM) return;
              const preset = BARCODE_PRESETS.find((p) => p.id === v);
              if (preset) return onChange(preset.size);
              const entry = saved.find((s) => s.id === v);
              if (entry)
                onChange({ width: entry.width, height: entry.height, unit: entry.unit ?? "mm" });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BARCODE_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
              {saved.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} — {s.width} × {s.height} {s.unit ?? "mm"}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>{t("customSize")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bc-w">
            {t("width")} ({unit})
          </Label>
          <Input
            id="bc-w"
            type="number"
            step="0.1"
            dir="ltr"
            value={Math.round(size.width * 100) / 100}
            onChange={(e) => onChange({ ...size, unit, width: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bc-h">
            {t("height")} ({unit})
          </Label>
          <Input
            id="bc-h"
            type="number"
            step="0.1"
            dir="ltr"
            value={Math.round(size.height * 100) / 100}
            onChange={(e) => onChange({ ...size, unit, height: Number(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("unit")}</Label>
          <Select
            value={unit}
            onValueChange={(v) => {
              const nextUnit = v as BarcodeUnit;
              if (nextUnit === unit) return;
              const factor = nextUnit === "cm" ? 0.1 : 10;
              onChange({
                unit: nextUnit,
                width: Number((size.width * factor).toFixed(2)),
                height: Number((size.height * factor).toFixed(2)),
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mm">mm</SelectItem>
              <SelectItem value="cm">cm</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Button type="button" variant="outline" size="icon" onClick={() => scale(0.9)}>
            <Minus className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground" dir="ltr">
            {Math.round(barcodeToMm(size.width, unit))} ×{" "}
            {Math.round(barcodeToMm(size.height, unit))} mm
          </span>
          <Button type="button" variant="outline" size="icon" onClick={() => scale(1.1)}>
            <Plus className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="ms-auto"
            onClick={() => onChange(DEFAULT_BARCODE_SIZE)}
          >
            {t("resetSize")}
          </Button>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bc-name">{t("saveCustomSize")}</Label>
          <div className="flex gap-2">
            <Input
              id="bc-name"
              value={name}
              placeholder={t("sizeName")}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              type="button"
              onClick={() => {
                onSave(name, size);
                setName("");
              }}
            >
              <Save className="size-4" />
              {t("save")}
            </Button>
          </div>
        </div>

        {saved.length > 0 ? (
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("savedSizes")}</Label>
            {saved.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <Input
                  value={s.name}
                  onChange={(e) => onUpdateSaved(s.id, { name: e.target.value })}
                  className="max-w-40"
                />
                <Input
                  type="number"
                  dir="ltr"
                  className="max-w-24"
                  value={s.width}
                  onChange={(e) => onUpdateSaved(s.id, { width: Number(e.target.value) || 0 })}
                />
                <Input
                  type="number"
                  dir="ltr"
                  className="max-w-24"
                  value={s.height}
                  onChange={(e) => onUpdateSaved(s.id, { height: Number(e.target.value) || 0 })}
                />
                <span className="text-xs text-muted-foreground">{s.unit ?? "mm"}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({ width: s.width, height: s.height, unit: s.unit ?? "mm" })
                  }
                >
                  {t("apply")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveSaved(s.id)}
                  aria-label={t("delete")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
