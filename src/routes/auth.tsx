import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Leaf, Languages } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | نظام إدارة ملصقات المعشبة" },
      {
        name: "description",
        content: "تسجيل الدخول إلى نظام إدارة بيانات عينات المعشبة النباتية وطباعة الملصقات العلمية.",
      },
      { property: "og:title", content: "تسجيل الدخول | نظام إدارة ملصقات المعشبة" },
      { property: "og:description", content: "دخول المستخدمين المصرّح لهم إلى نظام المعشبة النباتية." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang, dir } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("signedIn"));
        navigate({ to: "/", replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          toast.success(t("signedIn"));
          navigate({ to: "/", replace: true });
        } else {
          toast.success(t("checkEmail"));
          setMode("signin");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Leaf className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-foreground">{t("appName")}</h1>
              <p className="text-xs leading-tight text-muted-foreground">{t("org")}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
            <Languages className="size-4" />
            {lang === "ar" ? "EN" : "ع"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{mode === "signin" ? t("signIn") : t("signUp")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">{t("fullName")}</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? t("loading") : mode === "signin" ? t("signIn") : t("signUp")}
              </Button>
            </form>
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? t("noAccount") : t("haveAccount")}
            </button>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">{t("firstUserAdminHint")}</p>
      </div>
    </div>
  );
}