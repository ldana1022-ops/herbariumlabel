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
  DEFAULT_LABEL_SIZE,
  LABEL_PRESETS,
  type LabelSize,
  type LabelUnit,
} from "@/lib/label-size";

const CUSTOM = "__custom__";

export function LabelSizeControls({
  size,
  onChange,
}: {
  size: LabelSize;
  onChange: (next: LabelSize) => void;
}) {
  const { t } = useI18n();

  const activePreset =
    LABEL_PRESETS.find(
      (p) => p.width === size.width && p.height === size.height && p.unit === size.unit,
    )?.id ?? CUSTOM;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("labelSize")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("presets")}</Label>
          <Select
            value={activePreset}
            onValueChange={(v) => {
              if (v === CUSTOM) return;
              const preset = LABEL_PRESETS.find((p) => p.id === v);
              if (preset) {
                onChange({
                  ...size,
                  width: preset.width,
                  height: preset.height,
                  unit: preset.unit,
                });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LABEL_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>{t("customSize")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="label-w">{t("width")}</Label>
          <Input
            id="label-w"
            type="number"
            min={20}
            step="0.1"
            dir="ltr"
            value={size.width}
            onChange={(e) => onChange({ ...size, width: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="label-h">{t("height")}</Label>
          <Input
            id="label-h"
            type="number"
            min={20}
            step="0.1"
            dir="ltr"
            value={size.height}
            onChange={(e) => onChange({ ...size, height: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("unit")}</Label>
          <Select
            value={size.unit}
            onValueChange={(v) => {
              const unit = v as LabelUnit;
              if (unit === size.unit) return;
              const factor = unit === "cm" ? 0.1 : 10;
              onChange({
                ...size,
                unit,
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
        <div className="space-y-1.5">
          <Label htmlFor="label-scale">{t("fontScale")} (×)</Label>
          <Input
            id="label-scale"
            type="number"
            min={0.5}
            max={2}
            step="0.05"
            dir="ltr"
            value={size.fontScale}
            onChange={(e) => onChange({ ...size, fontScale: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="sm:col-span-2">
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_LABEL_SIZE)}>
            {t("resetSize")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
