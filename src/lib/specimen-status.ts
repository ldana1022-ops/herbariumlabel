export const SPECIMEN_STATUSES = [
  "incomplete",
  "in_progress",
  "pending_review",
  "completed",
] as const;

export type SpecimenStatus = (typeof SPECIMEN_STATUSES)[number];

type StatusMeta = {
  value: SpecimenStatus;
  ar: string;
  en: string;
  dot: string;
  badge: string;
};

export const STATUS_META: Record<SpecimenStatus, StatusMeta> = {
  incomplete: {
    value: "incomplete",
    ar: "لم تكتمل",
    en: "Incomplete",
    dot: "⚪️",
    badge: "bg-status-incomplete text-status-incomplete-foreground",
  },
  in_progress: {
    value: "in_progress",
    ar: "تحت الإجراء",
    en: "In progress",
    dot: "🔵",
    badge: "bg-status-progress text-status-progress-foreground",
  },
  pending_review: {
    value: "pending_review",
    ar: "بانتظار المراجعة",
    en: "Pending review",
    dot: "🟡",
    badge: "bg-status-review text-status-review-foreground",
  },
  completed: {
    value: "completed",
    ar: "مكتملة",
    en: "Completed",
    dot: "🟢",
    badge: "bg-status-completed text-status-completed-foreground",
  },
};

export const STATUS_ORDER = SPECIMEN_STATUSES.map((s) => STATUS_META[s]);

export function normalizeStatus(value: unknown): SpecimenStatus {
  return SPECIMEN_STATUSES.includes(value as SpecimenStatus)
    ? (value as SpecimenStatus)
    : "incomplete";
}

export function statusLabel(value: unknown, lang: "ar" | "en" = "ar"): string {
  const meta = STATUS_META[normalizeStatus(value)];
  return lang === "en" ? meta.en : meta.ar;
}
