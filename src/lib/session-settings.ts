import { supabase } from "@/integrations/supabase/client";

export type SessionPolicy = {
  idle_timeout_minutes: number;
  absolute_timeout_hours: number;
  allow_remember_me: boolean;
};

export type SessionPrefs = {
  idle_timeout_minutes: number | null;
  remember_me: boolean;
};

export const DEFAULT_POLICY: SessionPolicy = {
  idle_timeout_minutes: 30,
  absolute_timeout_hours: 12,
  allow_remember_me: true,
};

export const DEFAULT_PREFS: SessionPrefs = {
  idle_timeout_minutes: null,
  remember_me: false,
};

/** 0 = disabled (no automatic sign out). */
export const IDLE_OPTIONS = [0, 5, 15, 30, 60, 120, 240] as const;
export const ABSOLUTE_OPTIONS = [0, 4, 8, 12, 24, 72] as const;

export async function fetchSessionPolicy(): Promise<SessionPolicy> {
  const { data, error } = await supabase
    .from("session_settings")
    .select("idle_timeout_minutes, absolute_timeout_hours, allow_remember_me")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return DEFAULT_POLICY;
  return data as SessionPolicy;
}

export async function saveSessionPolicy(patch: SessionPolicy, userId: string): Promise<void> {
  const { error } = await supabase
    .from("session_settings")
    .update({ ...patch, updated_by: userId })
    .eq("id", true);
  if (error) throw error;
}

export async function fetchSessionPrefs(userId: string): Promise<SessionPrefs> {
  const { data, error } = await supabase
    .from("user_session_prefs")
    .select("idle_timeout_minutes, remember_me")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return DEFAULT_PREFS;
  return data as SessionPrefs;
}

export async function saveSessionPrefs(userId: string, patch: Partial<SessionPrefs>): Promise<void> {
  const { error } = await supabase
    .from("user_session_prefs")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}

/** The shortest configured value wins; a user can never extend the admin policy. */
export function effectiveIdleMinutes(policy: SessionPolicy, prefs: SessionPrefs): number {
  const policyValue = policy.idle_timeout_minutes > 0 ? policy.idle_timeout_minutes : 0;
  const userValue = prefs.idle_timeout_minutes && prefs.idle_timeout_minutes > 0 ? prefs.idle_timeout_minutes : 0;
  if (policyValue === 0) return userValue;
  if (userValue === 0) return policyValue;
  return Math.min(policyValue, userValue);
}
