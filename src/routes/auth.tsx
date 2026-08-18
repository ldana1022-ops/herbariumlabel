import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAccount, recordLogin } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | نظام إدارة ملصقات المعشبة النباتية" },
      {
        name: "description",
        content: "تسجيل الدخول إلى نظام إدارة بيانات عينات المعشبة النباتية وطباعة الملصقات العلمية.",
      },
      { property: "og:title", content: "تسجيل الدخول | نظام إدارة ملصقات المعشبة النباتية" },
      { property: "og:description", content: "دخول آمن لمستخدمي نظام المعشبة النباتية." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [loading, navigate, session]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("resetLinkSent"));
        setMode("signin");
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success(t("checkEmail"));
          setMode("signin");
          return;
        }
        await ensureAccount({ data: { fullName: fullName.trim() } });
        await recordLogin({ data: undefined as never });
        toast.success(t("signedIn"));
        navigate({ to: "/", replace: true });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      const result = await ensureAccount({ data: {} });
      if (!result.isActive) {
        await supabase.auth.signOut();
        toast.error(t("accountDisabled"));
        return;
      }
      await recordLogin({ data: undefined as never });
      toast.success(t("signedIn"));
      navigate({ to: "/", replace: true });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm font-bold">NCVC</span>
          </div>
          <h1 className="mt-3 text-lg font-semibold text-foreground">{t("appName")}</h1>
          <p className="text-xs text-muted-foreground">{t("org")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {mode === "signin" ? t("signIn") : mode === "signup" ? t("signUp") : t("forgotPassword")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">{t("fullName")}</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    maxLength={120}
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  autoComplete="email"
                />
              </div>

              {mode !== "forgot" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {mode === "signin" ? t("signIn") : mode === "signup" ? t("signUp") : t("sendResetLink")}
              </Button>
            </form>

            <div className="mt-4 space-y-2 text-center text-sm">
              {mode !== "forgot" ? (
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                >
                  {mode === "signin" ? t("noAccount") : t("haveAccount")}
                </button>
              ) : (
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode("signin")}
                >
                  {t("haveAccount")}
                </button>
              )}
              {mode === "signin" ? (
                <div>
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => setMode("forgot")}
                  >
                    {t("forgotPassword")}
                  </button>
                </div>
              ) : null}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t("firstUserAdminHint")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
