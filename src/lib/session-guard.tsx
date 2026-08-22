import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { recordAutoLogout } from "@/lib/admin.functions";
import {
  DEFAULT_POLICY,
  DEFAULT_PREFS,
  effectiveIdleMinutes,
  fetchSessionPolicy,
  fetchSessionPrefs,
} from "@/lib/session-settings";
import {
  clearSessionBookkeeping,
  ensureSessionStart,
  markActivity,
  readActivity,
} from "@/lib/session-storage";

const WARN_SECONDS = 60;
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"] as const;

export type SessionGuardState = {
  warning: boolean;
  secondsLeft: number;
  extend: () => void;
  logoutNow: () => void;
};

export function useSessionGuard(): SessionGuardState {
  const { session, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const userId = session?.user?.id ?? null;
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARN_SECONDS);
  const endingRef = useRef(false);

  const { data: policy } = useQuery({
    queryKey: ["session-policy"],
    queryFn: fetchSessionPolicy,
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const { data: prefs } = useQuery({
    queryKey: ["session-prefs", userId],
    queryFn: () => fetchSessionPrefs(userId as string),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const idleMinutes = effectiveIdleMinutes(policy ?? DEFAULT_POLICY, prefs ?? DEFAULT_PREFS);
  const absoluteHours = (policy ?? DEFAULT_POLICY).absolute_timeout_hours;

  const endSession = useCallback(
    async (reason: "idle" | "absolute") => {
      if (endingRef.current) return;
      endingRef.current = true;
      setWarning(false);
      try {
        await recordAutoLogout({ data: { reason } });
      } catch {
        /* logging must never block sign out */
      }
      clearSessionBookkeeping();
      await signOut();
      toast.warning(reason === "idle" ? t("sessionExpiredIdle") : t("sessionExpiredMax"));
      navigate({ to: "/auth", replace: true });
    },
    [navigate, signOut, t],
  );

  const extend = useCallback(() => {
    markActivity();
    setWarning(false);
    setSecondsLeft(WARN_SECONDS);
  }, []);

  const logoutNow = useCallback(() => {
    clearSessionBookkeeping();
    void signOut().then(() => navigate({ to: "/auth", replace: true }));
  }, [navigate, signOut]);

  // Track activity across tabs.
  useEffect(() => {
    if (!userId) return;
    endingRef.current = false;
    markActivity();
    ensureSessionStart();
    let last = Date.now();
    const onActivity = () => {
      const now = Date.now();
      if (now - last < 5_000) return;
      last = now;
      markActivity(now);
    };
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") onActivity();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  // Idle + absolute timeout checks.
  useEffect(() => {
    if (!userId) return;
    if (idleMinutes <= 0 && absoluteHours <= 0) {
      setWarning(false);
      return;
    }
    const tick = () => {
      const now = Date.now();
      if (absoluteHours > 0) {
        const start = ensureSessionStart();
        if (now - start >= absoluteHours * 3_600_000) {
          void endSession("absolute");
          return;
        }
      }
      if (idleMinutes <= 0) {
        setWarning(false);
        return;
      }
      const limit = idleMinutes * 60_000;
      const idleFor = now - readActivity();
      const remaining = Math.ceil((limit - idleFor) / 1000);
      if (remaining <= 0) {
        void endSession("idle");
        return;
      }
      if (remaining <= WARN_SECONDS) {
        setWarning(true);
        setSecondsLeft(remaining);
      } else {
        setWarning(false);
        setSecondsLeft(WARN_SECONDS);
      }
    };
    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, [absoluteHours, endSession, idleMinutes, userId]);

  return { warning, secondsLeft, extend, logoutNow };
}
