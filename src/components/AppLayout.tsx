import { Link } from "@tanstack/react-router";
import { Database, LayoutDashboard, Languages, Plus, Printer, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

function NavLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      activeProps={{ className: "bg-secondary text-foreground" }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { t, lang, setLang, dir } = useI18n();

  return (
    <div dir={dir} className="min-h-screen bg-muted/40 no-print-wrapper">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-xs font-bold tracking-tight">NCVC</span>
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-foreground">{t("appName")}</h1>
              <p className="max-w-2xl text-xs leading-tight text-muted-foreground">{t("org")}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="w-fit gap-2"
          >
            <Languages className="size-4" />
            {lang === "ar" ? "English" : "العربية"}
          </Button>
        </div>
        <nav className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-2 py-1.5 sm:px-4">
            <NavLink to="/" icon={<LayoutDashboard className="size-4" />} label={t("dashboard")} />
            <NavLink to="/specimens" icon={<Database className="size-4" />} label={t("database")} />
            <NavLink to="/specimens/new" icon={<Plus className="size-4" />} label={t("newSpecimen")} />
            <NavLink to="/specimens/import" icon={<Upload className="size-4" />} label={t("importExcel")} />
            <NavLink to="/print" icon={<Printer className="size-4" />} label={t("printLabels")} />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      <footer className="border-t border-border bg-card py-4 text-center text-xs text-muted-foreground">
        {t("org")}
      </footer>
    </div>
  );
}