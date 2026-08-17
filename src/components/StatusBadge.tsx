import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { normalizeStatus, STATUS_META } from "@/lib/specimen-status";

export function StatusBadge({ status, className }: { status: unknown; className?: string }) {
  const { lang } = useI18n();
  const meta = STATUS_META[normalizeStatus(status)];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.badge,
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
      {lang === "en" ? meta.en : meta.ar}
    </span>
  );
}
