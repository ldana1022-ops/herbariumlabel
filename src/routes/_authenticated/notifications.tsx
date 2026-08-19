import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWhen, useNotifications } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "الإشعارات | معشبة NCVC" },
      { name: "description", content: "مركز إشعارات نظام إدارة عينات المعشبة: تسجيل الدخول، تعديل البيانات، الطلبات والصلاحيات." },
      { property: "og:title", content: "الإشعارات | معشبة NCVC" },
      { property: "og:description", content: "مركز إشعارات نظام إدارة عينات المعشبة النباتية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useNotifications(200);
  const unread = items.filter((n) => !n.read_at);

  const mark = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("notifications")}</h2>
        <Button
          variant="outline"
          size="sm"
          disabled={unread.length === 0 || mark.isPending}
          onClick={() => mark.mutate(unread.map((n) => n.id))}
        >
          {t("markAllAsRead")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {t("unreadNotifications")}: {unread.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("noNotifications")}</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3 last:border-0 ${
                    n.read_at ? "" : "bg-secondary/40"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatWhen(n.created_at, lang)}</p>
                  </div>
                  {n.read_at ? null : (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => mark.mutate([n.id])}>
                      {t("markAsRead")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
