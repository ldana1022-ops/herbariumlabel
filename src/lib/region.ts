import type { Specimen } from "./specimens";

/**
 * Region derivation.
 *
 * The region is NOT stored as a separate required field: it is derived from the
 * collection locality text ("موقع الجمع"). The optional `region` column is used
 * only when it already carries a value. No data is ever modified here.
 */

export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") // Arabic diacritics
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ـ]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(
      /\b(al|el|ar|as|ash|governorate|region|province|province of|city|منطقة|محافظة|مدينة|ال)\b/giu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

type RegionDef = { ar: string; en: string; keys: string[] };

const REGIONS: RegionDef[] = [
  {
    ar: "الرياض",
    en: "Riyadh",
    keys: [
      "رياض",
      "riyadh",
      "riyad",
      "kharj",
      "خرج",
      "دوادمي",
      "دوادمى",
      "زلفي",
      "مجمعه",
      "شقراء",
      "افلاج",
      "حريق",
      "قويعيه",
      "وادي دواسر",
      "ثادق",
      "حوطه",
      "kharj",
      "dawadmi",
      "zulfi",
      "shaqra",
      "aflaj",
      "quwayiyah",
    ],
  },
  {
    ar: "مكة المكرمة",
    en: "Makkah",
    keys: [
      "مكه",
      "makkah",
      "mecca",
      "جده",
      "jeddah",
      "طائف",
      "taif",
      "قنفذه",
      "ليث",
      "رابغ",
      "كامل",
      "خرمه",
      "جموم",
      "qunfudhah",
      "rabigh",
      "khurmah",
    ],
  },
  {
    ar: "المدينة المنورة",
    en: "Madinah",
    keys: [
      "مدينه منوره",
      "مدينه",
      "madinah",
      "medina",
      "ينبع",
      "yanbu",
      "علا",
      "ula",
      "خيبر",
      "بدر",
      "مهد ذهب",
      "khaybar",
      "badr",
      "alula",
    ],
  },
  {
    ar: "القصيم",
    en: "Qassim",
    keys: [
      "قصيم",
      "qassim",
      "qasim",
      "بريده",
      "buraydah",
      "عنيزه",
      "unaizah",
      "رس",
      "بكيريه",
      "مذنب",
      "بدائع",
      "buraidah",
      "unayzah",
      "rass",
      "bukayriyah",
    ],
  },
  {
    ar: "المنطقة الشرقية",
    en: "Eastern Province",
    keys: [
      "شرقيه",
      "eastern",
      "دمام",
      "dammam",
      "احساء",
      "hofuf",
      "ahsa",
      "جبيل",
      "jubail",
      "قطيف",
      "خبر",
      "khobar",
      "ظهران",
      "dhahran",
      "خفجي",
      "نعيريه",
      "بقيق",
      "hafuf",
      "qatif",
      "abqaiq",
      "nairiyah",
    ],
  },
  {
    ar: "عسير",
    en: "Asir",
    keys: [
      "عسير",
      "asir",
      "aseer",
      "ابها",
      "abha",
      "خميس مشيط",
      "khamis",
      "نماص",
      "بلسمر",
      "محايل",
      "رجال المع",
      "سراه عبيده",
      "تنومه",
      "بيشه",
      "bisha",
      "namas",
      "muhayil",
      "tanumah",
      "sarat",
    ],
  },
  {
    ar: "تبوك",
    en: "Tabuk",
    keys: [
      "تبوك",
      "tabuk",
      "ضبا",
      "duba",
      "حقل",
      "تيماء",
      "taima",
      "وجه",
      "بدع",
      "dhuba",
      "haql",
      "tayma",
      "wajh",
    ],
  },
  {
    ar: "حائل",
    en: "Hail",
    keys: ["حايل", "حائل", "hail", "haiel", "بقعاء", "شنان", "سليمي", "baqaa", "shinan"],
  },
  {
    ar: "الحدود الشمالية",
    en: "Northern Borders",
    keys: [
      "حدود شماليه",
      "northern border",
      "عرعر",
      "arar",
      "رفحاء",
      "طريف",
      "turaif",
      "rafha",
      "arar",
    ],
  },
  {
    ar: "جازان",
    en: "Jazan",
    keys: [
      "جازان",
      "جيزان",
      "jazan",
      "jizan",
      "صبيا",
      "ابو عريش",
      "فرسان",
      "صامطه",
      "بيش",
      "ريث",
      "sabya",
      "farasan",
      "samtah",
      "abu arish",
    ],
  },
  {
    ar: "نجران",
    en: "Najran",
    keys: ["نجران", "najran", "شروره", "حبونا", "يدمه", "خباش", "sharurah", "habuna", "yadamah"],
  },
  {
    ar: "الباحة",
    en: "Al Bahah",
    keys: [
      "باحه",
      "bahah",
      "baha",
      "بلجرشي",
      "مندق",
      "قلوه",
      "عقيق",
      "مخواه",
      "baljurashi",
      "mandaq",
      "qilwah",
      "aqiq",
      "makhwah",
    ],
  },
  {
    ar: "الجوف",
    en: "Al Jouf",
    keys: [
      "جوف",
      "jouf",
      "jawf",
      "سكاكا",
      "sakaka",
      "قريات",
      "دومه جندل",
      "qurayyat",
      "qurayat",
      "sakakah",
      "domat",
    ],
  },
];

export type RegionInfo = { key: string; ar: string; en: string };

const UNKNOWN: RegionInfo = { key: "__unknown__", ar: "غير محدد", en: "Unspecified" };

function matchKnownRegion(normalized: string): RegionInfo | null {
  if (!normalized) return null;
  for (const r of REGIONS) {
    for (const k of r.keys) {
      const nk = normalizeText(k);
      if (nk && normalized.includes(nk)) return { key: r.en, ar: r.ar, en: r.en };
    }
  }
  return null;
}

/** Derive the region of a specimen from its locality (primary) or region field. */
export function specimenRegion(s: Pick<Specimen, "region" | "locality">): RegionInfo {
  const sources = [s.locality, s.region].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );

  for (const source of sources) {
    const matched = matchKnownRegion(normalizeText(source));
    if (matched) return matched;
  }

  // Fallback: use the first meaningful segment of the locality text as-is.
  for (const source of sources) {
    const segment = source
      .split(/[,،;/|>]/)[0]
      ?.trim()
      .replace(/\s+/g, " ");
    if (segment && segment.length > 1) {
      return { key: normalizeText(segment) || segment, ar: segment, en: segment };
    }
  }

  return UNKNOWN;
}

/** Group specimens by derived region, sorted by count desc. */
export function countByRegion(list: Specimen[]): { region: RegionInfo; count: number }[] {
  const map = new Map<string, { region: RegionInfo; count: number }>();
  for (const s of list) {
    const region = specimenRegion(s);
    const entry = map.get(region.key);
    if (entry) entry.count += 1;
    else map.set(region.key, { region, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Group pre-aggregated locality counts by derived region, sorted by count desc. */
export function countByRegionGroups(
  groups: { locality: string | null; region: string | null; count: number }[],
): { region: RegionInfo; count: number }[] {
  const map = new Map<string, { region: RegionInfo; count: number }>();
  for (const g of groups) {
    const region = specimenRegion({ locality: g.locality, region: g.region });
    const entry = map.get(region.key);
    if (entry) entry.count += g.count;
    else map.set(region.key, { region, count: g.count });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
