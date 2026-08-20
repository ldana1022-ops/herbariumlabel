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
  type BarcodeSize,
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

  const active =
    BARCODE_PRESETS.find((p) => p.size.width === size.width && p.size.height === size.height)?.id ??
    saved.find((s) => s.width === size.width && s.height === size.height)?.id ??
    CUSTOM;

  const scale = (factor: number) =>
    onChange({ width: size.width * factor, height: size.height * factor });

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
              const preset = BARCODE_PRESETS.find((p) => p.id === v);
              if (preset) return onChange(preset.size);
              const entry = saved.find((s) => s.id === v);
              if (entry) onChange({ width: entry.width, height: entry.height });
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
                  {s.name} — {s.width} × {s.height} mm
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>{t("customSize")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bc-w">{t("width")} (mm)</Label>
          <Input
            id="bc-w"
            type="number"
            dir="ltr"
            value={Math.round(size.width * 10) / 10}
            onChange={(e) => onChange({ ...size, width: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bc-h">{t("height")} (mm)</Label>
          <Input
            id="bc-h"
            type="number"
            dir="ltr"
            value={Math.round(size.height * 10) / 10}
            onChange={(e) => onChange({ ...size, height: Number(e.target.value) || 0 })}
          />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Button type="button" variant="outline" size="icon" onClick={() => scale(0.9)}>
            <Minus className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground" dir="ltr">
            {Math.round(size.width)} × {Math.round(size.height)} mm
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange({ width: s.width, height: s.height })}
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
