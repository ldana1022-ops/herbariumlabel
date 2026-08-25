import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { BARCODE_TEXT_LIMITS, type BarcodeTextSettings } from "@/lib/barcode-text";

type Props = {
  settings: BarcodeTextSettings;
  onChange: (patch: Partial<BarcodeTextSettings>) => void;
  onReset: () => void;
};

export function BarcodeTextControls({ settings, onChange, onReset }: Props) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("barcodeText")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("barcodeTextHint")}</p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bc-text">{t("barcodeTextContent")}</Label>
          <Input
            id="bc-text"
            value={settings.text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 sm:col-span-2">
          <Label htmlFor="bc-text-show" className="text-sm font-normal">
            {t("barcodeTextShow")}
          </Label>
          <Switch
            id="bc-text-show"
            checked={settings.show}
            onCheckedChange={(v) => onChange({ show: v })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bc-text-size">{t("barcodeTextSize")} (pt)</Label>
          <Input
            id="bc-text-size"
            type="number"
            dir="ltr"
            step="0.5"
            min={BARCODE_TEXT_LIMITS.minFont}
            max={BARCODE_TEXT_LIMITS.maxFont}
            value={settings.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("barcodeTextAlign")}</Label>
          <Select
            value={settings.align}
            onValueChange={(v) => onChange({ align: v as BarcodeTextSettings["align"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="start">{t("alignStart")}</SelectItem>
              <SelectItem value="center">{t("alignCenter")}</SelectItem>
              <SelectItem value="end">{t("alignEnd")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label htmlFor="bc-text-bold" className="text-sm font-normal">
            {t("barcodeTextBold")}
          </Label>
          <Switch
            id="bc-text-bold"
            checked={settings.bold}
            onCheckedChange={(v) => onChange({ bold: v })}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label htmlFor="bc-text-upper" className="text-sm font-normal">
            {t("barcodeTextUppercase")}
          </Label>
          <Switch
            id="bc-text-upper"
            checked={settings.uppercase}
            onCheckedChange={(v) => onChange({ uppercase: v })}
          />
        </div>

        <div className="sm:col-span-2">
          <Button type="button" variant="ghost" onClick={onReset}>
            {t("resetSize")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
