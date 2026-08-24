import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SERIAL_RE = /^NCVCH?\d{6}$/;


/**
 * Records an anonymous visit to the public summary page (/p/:serial).
 * Only the serial number is stored: no IP address, user agent, referrer,
 * or any specimen field beyond the identifier already present in the URL.
 */
export const logPublicSpecimenView = createServerFn({ method: "POST" })
  .inputValidator((input: { serial: string }) =>
    z
      .object({ serial: z.string().trim().toUpperCase().regex(SERIAL_RE) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: specimen } = await supabaseAdmin
      .from("herbarium_specimens")
      .select("id")
      .eq("serial_number", data.serial)
      .maybeSingle();

    await supabaseAdmin.from("activity_log").insert({
      actor_id: null,
      actor_name: "زائر عام / Public visitor",
      action: "public_view",
      record_label: data.serial,
      record_id: specimen?.id ?? null,
      session_info: "public_page",
    });

    return { ok: true };
  });
