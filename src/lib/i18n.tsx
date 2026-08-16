import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const dict = {
  appName: { ar: "نظام إدارة ملصقات المعشبة", en: "Herbarium Label Management System" },
  org: {
    ar: "المركز الوطني لتنمية الغطاء النباتي ومكافحة التصحر",
    en: "National Center for Vegetation Cover Development and Combating Desertification",
  },
  dashboard: { ar: "لوحة التحكم", en: "Dashboard" },
  database: { ar: "قاعدة بيانات العينات", en: "Specimens Database" },
  newSpecimen: { ar: "إضافة عينة جديدة", en: "New Specimen" },
  search: { ar: "البحث", en: "Search" },
  printLabels: { ar: "طباعة الليبلات", en: "Print Labels" },
  exportExcel: { ar: "تصدير Excel", en: "Export to Excel" },
  total: { ar: "إجمالي العينات", en: "Total specimens" },
  determined: { ar: "عينات مصنفة", en: "Determined" },
  undetermined: { ar: "عينات غير مصنفة", en: "Undetermined" },
  recent: { ar: "مضافة حديثًا (30 يومًا)", en: "Added recently (30 days)" },
  byRegion: { ar: "العينات حسب المنطقة", en: "Specimens by region" },
  byFamily: { ar: "العينات حسب الفصيلة", en: "Specimens by family" },
  quickActions: { ar: "اختصارات سريعة", en: "Quick actions" },
  status: { ar: "الحالة", en: "Status" },
  actions: { ar: "الإجراءات", en: "Actions" },
  view: { ar: "عرض", en: "View" },
  edit: { ar: "تعديل", en: "Edit" },
  printLabel: { ar: "طباعة الليبل", en: "Print Label" },
  printMultiple: { ar: "طباعة عدة ليبلات", en: "Print Multiple Labels" },
  delete: { ar: "حذف", en: "Delete" },
  save: { ar: "حفظ", en: "Save" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  saved: { ar: "تم حفظ بيانات العينة بنجاح", en: "Specimen saved successfully" },
  updated: { ar: "تم تحديث بيانات العينة", en: "Specimen updated" },
  deleted: { ar: "تم حذف العينة", en: "Specimen deleted" },
  confirmDelete: { ar: "تأكيد الحذف", en: "Confirm deletion" },
  confirmDeleteBody: {
    ar: "سيتم حذف بيانات العينة نهائيًا ولا يمكن التراجع عن هذا الإجراء.",
    en: "This specimen record will be permanently deleted. This action cannot be undone.",
  },
  labelPreview: { ar: "معاينة الليبل", en: "Label preview" },
  specimenData: { ar: "بيانات العينة", en: "Specimen data" },
  determinationSection: { ar: "التصنيف العلمي", en: "Determination" },
  determinationHint: {
    ar: "يمكن إضافة بيانات التصنيف أو تعديلها في أي وقت لاحق.",
    en: "Determination data can be added or updated at any time.",
  },
  filters: { ar: "البحث والتصفية", en: "Search & filters" },
  searchPlaceholder: {
    ar: "بحث بالرقم أو الاسم العلمي أو الاسم المحلي أو الموقع...",
    en: "Search by accession, scientific name, local name, locality...",
  },
  all: { ar: "الكل", en: "All" },
  family: { ar: "الفصيلة", en: "Family" },
  region: { ar: "المنطقة", en: "Region" },
  collector: { ar: "الجامع", en: "Collector" },
  dateFrom: { ar: "من تاريخ", en: "Date from" },
  dateTo: { ar: "إلى تاريخ", en: "Date to" },
  clearFilters: { ar: "مسح التصفية", en: "Clear filters" },
  resultsCount: { ar: "النتائج", en: "Results" },
  selected: { ar: "محدد", en: "selected" },
  noResults: { ar: "لا توجد عينات مطابقة", en: "No matching specimens" },
  loading: { ar: "جارٍ التحميل...", en: "Loading..." },
  backToList: { ar: "العودة إلى القائمة", en: "Back to list" },
  required: { ar: "هذا الحقل مطلوب", en: "This field is required" },
  invalidLat: { ar: "خط عرض غير صحيح (-90 إلى 90)", en: "Invalid latitude (-90 to 90)" },
  invalidLong: { ar: "خط طول غير صحيح (-180 إلى 180)", en: "Invalid longitude (-180 to 180)" },
  invalidNumber: { ar: "قيمة رقمية غير صحيحة", en: "Invalid number" },
  duplicate: { ar: "رقم العينة مستخدم مسبقًا", en: "Accession number already exists" },
  print: { ar: "طباعة", en: "Print" },
  selectToPrint: {
    ar: "حدد عينة واحدة أو أكثر من الجدول لطباعة ليبلاتها.",
    en: "Select one or more specimens from the table to print their labels.",
  },
  editSpecimen: { ar: "تعديل العينة", en: "Edit specimen" },
  specimenDetails: { ar: "تفاصيل العينة", en: "Specimen details" },
  updateDetermination: { ar: "تحديث التصنيف", en: "Update determination" },
  notFound: { ar: "العينة غير موجودة", en: "Specimen not found" },
  fixErrors: { ar: "يرجى تصحيح الحقول المطلوبة", en: "Please correct the highlighted fields" },
  labelsSelected: { ar: "ليبل جاهز للطباعة", en: "labels ready to print" },
  exportWord: { ar: "تصدير إلى Word", en: "Export to Word" },
  printSettings: { ar: "إعدادات الطباعة", en: "Print settings" },
  paperSize: { ar: "مقاس الورق", en: "Paper size" },
  orientation: { ar: "اتجاه الورقة", en: "Orientation" },
  portrait: { ar: "طولي", en: "Portrait" },
  landscape: { ar: "عرضي", en: "Landscape" },
  margins: { ar: "الهوامش", en: "Margins" },
  labelsPerRow: { ar: "عدد الليبلات في الصف", en: "Labels per row" },
  labelGap: { ar: "المسافة بين الليبلات", en: "Gap between labels" },
  copies: { ar: "عدد النسخ", en: "Copies" },
  printPreview: { ar: "معاينة الطباعة", en: "Print preview" },
  labelSize: { ar: "مقاس الليبل", en: "Label size" },
  presets: { ar: "مقاسات جاهزة", en: "Presets" },
  custom: { ar: "مخصص", en: "Custom" },
  width: { ar: "العرض", en: "Width" },
  height: { ar: "الارتفاع", en: "Height" },
  unit: { ar: "وحدة القياس", en: "Unit" },
  fontScale: { ar: "حجم الخط", en: "Font scale" },
  resetSize: { ar: "استعادة المقاس الافتراضي", en: "Reset size" },
  importExcel: { ar: "استيراد من Excel", en: "Import from Excel" },
  importTitle: { ar: "استيراد بيانات العينات من Excel", en: "Import specimens from Excel" },
  chooseFile: { ar: "اختر ملف Excel", en: "Choose an Excel file" },
  columnMapping: { ar: "مطابقة الأعمدة", en: "Column mapping" },
  ignoreColumn: { ar: "تجاهل", en: "Ignore" },
  previewRows: { ar: "معاينة البيانات قبل الاستيراد", en: "Preview before import" },
  validRows: { ar: "صفوف صالحة", en: "Valid rows" },
  invalidRows: { ar: "صفوف بها أخطاء", en: "Rows with errors" },
  duplicateRows: { ar: "صفوف مكررة", en: "Duplicate rows" },
  duplicateAction: { ar: "معالجة التكرار", en: "Duplicate handling" },
  skipDuplicates: { ar: "تخطي المكرر", en: "Skip duplicates" },
  updateDuplicates: { ar: "تحديث المكرر", en: "Update existing" },
  startImport: { ar: "بدء الاستيراد", en: "Start import" },
  importing: { ar: "جارٍ الاستيراد...", en: "Importing..." },
  importDone: { ar: "تم الاستيراد بنجاح", en: "Import completed" },
  rowNumber: { ar: "الصف", en: "Row" },
  errorLabel: { ar: "الخطأ", en: "Error" },
  newRows: { ar: "صفوف جديدة", en: "New rows" },
  signIn: { ar: "تسجيل الدخول", en: "Sign in" },
  signUp: { ar: "إنشاء حساب", en: "Create account" },
  signOut: { ar: "تسجيل الخروج", en: "Sign out" },
  signedIn: { ar: "تم تسجيل الدخول", en: "Signed in" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  password: { ar: "كلمة المرور", en: "Password" },
  fullName: { ar: "الاسم الكامل", en: "Full name" },
  noAccount: { ar: "ليس لديك حساب؟ إنشاء حساب جديد", en: "No account? Create one" },
  haveAccount: { ar: "لديك حساب؟ تسجيل الدخول", en: "Already have an account? Sign in" },
  checkEmail: { ar: "تحقق من بريدك الإلكتروني لتأكيد الحساب", en: "Check your email to confirm the account" },
  firstUserAdminHint: {
    ar: "أول مستخدم يسجّل في النظام يحصل على صلاحية مدير النظام، ويكون المستخدمون التالون بصلاحية مطّلع حتى يرفعها المدير.",
    en: "The first registered user becomes administrator; later users start as viewers until an admin upgrades them.",
  },
  users: { ar: "إدارة المستخدمين", en: "User management" },
  role: { ar: "الصلاحية", en: "Role" },
  roleUpdated: { ar: "تم تحديث الصلاحية", en: "Role updated" },
  noPermission: { ar: "لا تملك صلاحية لتنفيذ هذا الإجراء", en: "You do not have permission for this action" },
} as const;

export type TKey = keyof typeof dict;

const fieldLabels: Record<string, { ar: string; en: string }> = {
  accession_number: { ar: "رقم العينة", en: "Accession Number" },
  scientific_name: { ar: "الاسم العلمي", en: "Scientific Name" },
  family: { ar: "الفصيلة", en: "Family" },
  local_name: { ar: "الاسم المحلي", en: "Local Name" },
  local_name_ar: { ar: "الاسم المحلي (عربي)", en: "Local Name (Arabic)" },
  locality: { ar: "موقع الجمع", en: "Locality" },
  region: { ar: "المنطقة", en: "Region" },
  latitude: { ar: "خط العرض (N)", en: "Latitude (N)" },
  longitude: { ar: "خط الطول (E)", en: "Longitude (E)" },
  altitude_m: { ar: "الارتفاع (م)", en: "Altitude (m)" },
  collection_date: { ar: "تاريخ الجمع", en: "Collection Date" },
  collectors: { ar: "جامع العينة", en: "Collector(s)" },
  determination: { ar: "التصنيف / Det.", en: "Determination / Det." },
  determined_by: { ar: "المُحدِّد", en: "Determined By" },
  determination_date: { ar: "تاريخ التحديد", en: "Determination Date" },
  notes: { ar: "ملاحظات", en: "Notes" },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
  f: (field: string) => string;
  dir: "rtl" | "ltr";
};

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem("ncvc-lang");
    if (stored === "en" || stored === "ar") setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("ncvc-lang", l);
  };

  const value: Ctx = {
    lang,
    setLang,
    t: (key) => dict[key][lang],
    f: (field) => fieldLabels[field]?.[lang] ?? field,
    dir: lang === "ar" ? "rtl" : "ltr",
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}