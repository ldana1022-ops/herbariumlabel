import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ABSOLUTE_OPTIONS,
  DEFAULT_POLICY,
  DEFAULT_PREFS,
  IDLE_OPTIONS,
  effectiveIdleMinutes,
  fetchSessionPolicy,
  fetchSessionPrefs,
  saveSessionPolicy,
  saveSessionPrefs,
  type SessionPolicy,
} from "@/lib/session-settings";
import { setRememberMe } from "@/lib/session-storage";

export const Route = createFileRoute("/_authenticated/admin/session")({
  head: () => ({
    meta: [
      { title: "إعدادات الجلسات | نظام إدارة ملصقات المعشبة" },
      {
        name: "description",
        content: "إدارة مدة الجلسة والخروج التلقائي عند الخمول وخيار تذكرني في نظام المعشبة النباتية.",
      },
      { property: "og:title", content: "إعدادات الجلسات | نظام إدارة ملصقات المعشبة" },
      { property: "og:description", content: "ضبط مدة الجلسة والخروج التلقائي بشكل آمن." },
    ],
  }),
  component: SessionSettingsPage,
});

function SessionSettingsPage() {
  const { t, lang } = useI18n();
  const { isSuperAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const policyQuery = useQuery({ queryKey: ["session-policy"], queryFn: fetchSessionPolicy });
  const prefsQuery = useQuery({
    queryKey: ["session-prefs", userId],
    queryFn: () => fetchSessionPrefs(userId as string),
    enabled: Boolean(userId),
  });

  const [policy, setPolicy] = useState<SessionPolicy>(DEFAULT_POLICY);
  const [userIdle, setUserIdle] = useState<number>(0);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (policyQuery.data) setPolicy(policyQuery.data);
  }, [policyQuery.data]);

  useEffect(() => {
    if (prefsQuery.data) {
      setUserIdle(prefsQuery.data.idle_timeout_minutes ?? 0);
      setRemember(prefsQuery.data.remember_me);
    }
  }, [prefsQuery.data]);

  const savePolicy = useMutation({
    mutationFn: () => saveSessionPolicy(policy, userId as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session-policy"] });
      toast.success(t("sessionSettingsSaved"));
    },
    onError: () => toast.error(t("sessionSettingsError")),
  });

  const savePrefs = useMutation({
    mutationFn: () =>
      saveSessionPrefs(userId as string, {
        idle_timeout_minutes: userIdle > 0 ? userIdle : null,
        remember_me: policy.allow_remember_me ? remember : false,
      }),
    onSuccess: async () => {
      setRememberMe(policy.allow_remember_me ? remember : false);
      await queryClient.invalidateQueries({ queryKey: ["session-prefs", userId] });
      toast.success(t("sessionSettingsSaved"));
    },
    onError: () => toast.error(t("sessionSettingsError")),
  });

  const minuteLabel = (value: number) =>
    value === 0 ? t("noAutoLogout") : lang === "ar" ? `${value} دقيقة` : `${value} minutes`;
  const hourLabel = (value: number) =>
    value === 0 ? t("noAutoLogout") : lang === "ar" ? `${value} ساعة` : `${value} hours`;

  const effective = effectiveIdleMinutes(policy, {
    ...DEFAULT_PREFS,
    idle_timeout_minutes: userIdle > 0 ? userIdle : null,
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("sessionSettings")}</h2>
          <p className="text-sm text-muted-foreground">{t("sessionSettingsHint")}</p>
        </div>

        {isSuperAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("sessionPolicy")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("idleTimeout")}</Label>
                  <Select
                    value={String(policy.idle_timeout_minutes)}
                    onValueChange={(v) => setPolicy({ ...policy, idle_timeout_minutes: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IDLE_OPTIONS.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {minuteLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("absoluteTimeout")}</Label>
                  <Select
                    value={String(policy.absolute_timeout_hours)}
                    onValueChange={(v) => setPolicy({ ...policy, absolute_timeout_hours: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ABSOLUTE_OPTIONS.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {hourLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("allowRememberMe")}</p>
                  <p className="text-xs text-muted-foreground">{t("allowRememberMeHint")}</p>
                </div>
                <Switch
                  checked={policy.allow_remember_me}
                  onCheckedChange={(v) => setPolicy({ ...policy, allow_remember_me: v })}
                />
              </div>

              <p className="text-xs text-muted-foreground">{t("sessionPolicyScope")}</p>

              <Button onClick={() => savePolicy.mutate()} disabled={savePolicy.isPending}>
                {t("save")}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("mySessionPrefs")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 sm:max-w-xs">
              <Label>{t("myIdleTimeout")}</Label>
              <Select value={String(userIdle)} onValueChange={(v) => setUserIdle(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t("followPolicy")}</SelectItem>
                  {IDLE_OPTIONS.filter((v) => v > 0).map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {minuteLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("myIdleTimeoutHint")}</p>
            </div>

            {policy.allow_remember_me ? (
              <div className="flex items-center justify-between rounded-md border border-border p-3 sm:max-w-md">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("rememberMe")}</p>
                  <p className="text-xs text-muted-foreground">{t("rememberMeHint")}</p>
                </div>
                <Switch checked={remember} onCheckedChange={setRemember} />
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              {t("effectiveIdleTimeout")}: {minuteLabel(effective)}
            </p>

            <Button onClick={() => savePrefs.mutate()} disabled={savePrefs.isPending || !userId}>
              {t("save")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
