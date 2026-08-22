import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
import { BackButton } from "@/components/BackButton";
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  head: () => ({
    meta: [
      { title: "سجل النشاطات | معشبة NCVC" },
      { name: "description", content: "سجل نشاطات النظام للقراءة فقط: من قام بالعملية، ماذا تغيّر، ومتى." },
      { property: "og:title", content: "سجل النشاطات | معشبة NCVC" },
      { property: "og:description", content: "سجل نشاطات نظام إدارة عينات المعشبة النباتية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityPage,
});

type LogRow = {
  id: string;
  actor_name: string | null;
  action: string;
  record_label: string | null;
  previous_value: unknown;
  new_value: unknown;
  created_at: string;
};

function short(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

function ActivityPage() {
  const { t, lang } = useI18n();
  const { isSuperAdmin, loading } = useAuth();
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["activity-log"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, actor_name, action, record_label, previous_value, new_value, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as LogRow[];
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.actor_name, r.action, r.record_label].some((v) => (v ?? "").toLowerCase().includes(needle)),
    );
  }, [q, rows]);

  if (loading) return <p className="text-sm text-muted-foreground">…</p>;
  if (!isSuperAdmin) return <p className="text-sm text-muted-foreground">{t("noPermission")}</p>;

  const locale = lang === "ar" ? "ar-SA" : "en-GB";

  return (
    <div className="space-y-4">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("activityLog")}</h2>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="w-full sm:w-64"
        />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("action")}</TableHead>
                <TableHead>{t("record")}</TableHead>
                <TableHead>{t("previousValue")}</TableHead>
                <TableHead>{t("newValue")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("time")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    …
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    {t("noActivity")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const d = new Date(r.created_at);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">{r.actor_name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{r.action}</TableCell>
                      <TableCell className="text-sm">{r.record_label ?? "—"}</TableCell>
                      <TableCell className="max-w-[16rem] text-xs text-muted-foreground">
                        {short(r.previous_value)}
                      </TableCell>
                      <TableCell className="max-w-[16rem] text-xs text-muted-foreground">
                        {short(r.new_value)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {d.toLocaleDateString(locale)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
