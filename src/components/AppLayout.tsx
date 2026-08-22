import { Link } from "@tanstack/react-router";
import {
  Bell,
  ClipboardList,
  Database,
  History,
  LayoutDashboard,
  Languages,
  LogOut,
  Plus,
  Printer,
  ScanLine,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { BackButton } from "@/components/BackButton";
import { SessionTimeoutDialog } from "@/components/SessionTimeoutDialog";

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
  const { can, profile, isSuperAdmin, session, signOut } = useAuth();

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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="w-fit gap-2"
            >
              <Languages className="size-4" />
              {lang === "ar" ? "English" : "العربية"}
            </Button>
            {session ? (
              <div className="flex items-center gap-2">
                <NotificationBell />
                <div className="text-right leading-tight">
                  <p className="text-xs font-medium text-foreground">
                    {profile?.full_name ?? profile?.email ?? ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isSuperAdmin ? t("superAdmin") : t("user")}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => void signOut()}>
                  <LogOut className="size-4" />
                  {t("signOut")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        <nav className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-2 py-1.5 sm:px-4">
            <NavLink to="/" icon={<LayoutDashboard className="size-4" />} label={t("dashboard")} />
            <NavLink to="/specimens" icon={<Database className="size-4" />} label={t("database")} />
            {can("edit") ? (
              <NavLink to="/specimens/new" icon={<Plus className="size-4" />} label={t("newSpecimen")} />
            ) : null}
            {can("import") ? (
              <NavLink to="/specimens/import" icon={<Upload className="size-4" />} label={t("importExcel")} />
            ) : null}
            {can("print") ? (
              <NavLink to="/print" icon={<Printer className="size-4" />} label={t("printLabels")} />
            ) : null}
            <NavLink to="/scan" icon={<ScanLine className="size-4" />} label={t("scanTitle")} />
            {session ? (
              <>
                <NavLink
                  to="/requests"
                  icon={<ClipboardList className="size-4" />}
                  label={t("requests")}
                />
                <NavLink to="/notifications" icon={<Bell className="size-4" />} label={t("notifications")} />
                <NavLink
                  to="/admin/session"
                  icon={<ShieldCheck className="size-4" />}
                  label={t("sessionSettings")}
                />
              </>
            ) : null}
            {isSuperAdmin ? (
              <>
                <NavLink to="/admin/users" icon={<Users className="size-4" />} label={t("users")} />
                <NavLink
                  to="/admin/activity"
                  icon={<History className="size-4" />}
                  label={t("activityLog")}
                />
              </>
            ) : null}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4 empty:mb-0">
          <BackButton />
        </div>
        {children}
      </main>
      {session ? <SessionTimeoutDialog /> : null}
      <footer className="border-t border-border bg-card py-4 text-center text-xs text-muted-foreground">
        {t("org")}
      </footer>
    </div>
  );
}