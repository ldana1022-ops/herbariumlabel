import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { normalizeStatus, STATUS_META, STATUS_ORDER, type SpecimenStatus } from "@/lib/specimen-status";

export function StatusSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: unknown;
  onChange: (status: SpecimenStatus) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { lang } = useI18n();
  const current = normalizeStatus(value);
  return (
    <Select value={current} onValueChange={(v) => onChange(v as SpecimenStatus)} disabled={disabled ?? false}>
      <SelectTrigger
        className={cn("h-8 min-w-[9.5rem] border-transparent", STATUS_META[current].badge, className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((meta) => (
          <SelectItem key={meta.value} value={meta.value}>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn("size-2.5 rounded-full", meta.badge.split(" ")[0])}
              />
              {lang === "en" ? meta.en : meta.ar}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
