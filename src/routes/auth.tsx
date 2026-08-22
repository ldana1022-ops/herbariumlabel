import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { checkPassword, isStrongPassword, isValidEmail } from "@/lib/password";
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


  const checks = checkPassword(password);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [loading, navigate, session]);

  // Show a confirmation toast when the user lands here from a verification link.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=signup") || hash.includes("type=email_change")) {
      toast.success(t("emailConfirmedSuccess"));
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (hash.includes("error_description")) {
      const description = decodeURIComponent(hash.split("error_description=")[1] ?? "").replace(/\+/g, " ");
      if (description) toast.error(description);
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const describeError = (error: { message?: string; code?: string; status?: number }) => {
    const message = (error.message ?? "").toLowerCase();
    const code = error.code ?? "";
    if (code === "email_not_confirmed" || message.includes("not confirmed")) return t("emailNotConfirmed");
    if (code === "invalid_credentials" || message.includes("invalid login credentials")) return t("invalidCredentials");
    if (code === "weak_password" || message.includes("weak") || message.includes("pwned") || message.includes("easy to guess"))
      return t("weakPassword");
    if (code === "user_already_exists" || message.includes("already registered") || message.includes("already been registered"))
      return t("emailAlreadyUsed");
    if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429)
      return t("tooManyRequests");
    if (message.includes("invalid email") || message.includes("email address")) return t("invalidEmailFormat");
    return error.message ?? t("invalidCredentials");
  };

  const resendVerification = async () => {
    if (!isValidEmail(email)) {
      toast.error(t("invalidEmailFormat"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
      toast.success(t("verificationResent"));
    } catch (error) {
      toast.error(describeError(error as Error));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      toast.error(t("invalidEmailFormat"));
      return;
    }
    if (mode === "signup" && !isStrongPassword(password)) {
      toast.error(t("weakPassword"));
      return;
    }

    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("resetLinkSent"));
        setMode("signin");
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        // Supabase returns a user with an empty identities array when the email already exists.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          toast.error(t("emailAlreadyUsed"));
          setMode("signin");
          return;
        }
        if (!data.session) {
          setNeedsVerification(true);
          setMode("signin");
          toast.success(t("accountCreatedVerify"));
          return;
        }
        await ensureAccount({ data: { fullName: fullName.trim() } });
        await recordLogin({ data: undefined as never });
        toast.success(t("signedIn"));
        navigate({ to: "/", replace: true });
        return;
      }

      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) {
        if ((error as { code?: string }).code === "email_not_confirmed") setNeedsVerification(true);
        throw error;
      }
      // Defence in depth: never let an unverified account through.
      if (signInData.user && !signInData.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setNeedsVerification(true);
        toast.error(t("emailNotConfirmed"));
        return;
      }
      const result = await ensureAccount({ data: {} });
      if (!result.isActive) {
        await supabase.auth.signOut();
        toast.error(t("accountDisabled"));
        return;
      }
      setNeedsVerification(false);
      await recordLogin({ data: undefined as never });
      toast.success(t("signedIn"));
      navigate({ to: "/", replace: true });
    } catch (error) {
      toast.error(describeError(error as Error));
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

              {mode === "signup" ? (
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-medium text-foreground">{t("passwordRequirements")}</p>
                  <ul className="space-y-1 text-xs">
                    {(
                      [
                        ["pwLength", checks.length],
                        ["pwUpper", checks.upper],
                        ["pwLower", checks.lower],
                        ["pwDigit", checks.digit],
                        ["pwSymbol", checks.symbol],
                        ["pwNotCommon", checks.notCommon],
                      ] as const
                    ).map(([key, ok]) => (
                      <li
                        key={key}
                        className={ok ? "flex items-center gap-1.5 text-primary" : "flex items-center gap-1.5 text-muted-foreground"}
                      >
                        {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                        <span>{t(key)}</span>
                      </li>
                    ))}
                  </ul>
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

            {needsVerification && mode !== "forgot" ? (
              <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("emailNotConfirmed")}</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" disabled={busy} onClick={resendVerification}>
                  {t("resendVerification")}
                </Button>
              </div>
            ) : null}

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t("firstUserAdminHint")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
