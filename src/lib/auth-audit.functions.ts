import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const eventSchema = z.object({ event: z.enum(["sign_in", "sign_out"]) });

/**
 * Records a sign-in or sign-out in the audit log.
 * Requires a valid session, so it cannot be used anonymously to write rows.
 */
export const logAuthEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event: "sign_in" | "sign_out" }) => eventSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    const actorName = profile?.full_name || profile?.email || null;

    await supabaseAdmin.from("activity_log").insert({
      actor_id: userId,
      actor_name: actorName,
      action: data.event,
      record_label: actorName,
      session_info: "web",
    });

    if (data.event === "sign_in") {
      await supabaseAdmin
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", userId);
    }

    return { ok: true };
  });
