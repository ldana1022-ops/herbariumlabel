import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeSerial } from "@/lib/serial";

const serialInput = z
  .object({ serial: z.string() })
  .transform((v) => {
    const serial = normalizeSerial(v.serial);
    if (!serial) throw new Error("INVALID_SERIAL");
    return { serial };
  });

/**
 * Records an anonymous visit to the public summary page (/p/:serial).
 * Only the serial number is stored: no IP address, user agent, referrer,
 * or any specimen field beyond the identifier already present in the URL.
 */
export const logPublicSpecimenView = createServerFn({ method: "POST" })
  .inputValidator((input: { serial: string }) => serialInput.parse(input))

  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: specimen } = await supabaseAdmin
      .from("herbarium_specimens")
      .select("id")
      .eq("serial_number", data.serial)
      .maybeSingle();

    // Unknown serials are not logged: keeps this public endpoint from being
    // used to write arbitrary rows into the activity log.
    if (!specimen?.id) return { ok: true };

    await supabaseAdmin.from("activity_log").insert({
      actor_id: null,
      actor_name: "زائر عام / Public visitor",
      action: "public_view",
      record_label: data.serial,
      record_id: specimen.id,
      session_info: "public_page",
    });

    return { ok: true };
  });

/**
 * Returns a short-lived signed URL for the specimen image of a valid serial.
 * Read-only: nothing but the image link is exposed, and no other specimen
 * field or write capability is granted to anonymous visitors.
 */
export const getPublicSpecimenImageUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { serial: string }) => serialInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: specimen } = await supabaseAdmin
      .from("herbarium_specimens")
      .select("image_url, visibility")
      .eq("serial_number", data.serial)
      .maybeSingle();

    // Only publicly visible specimens expose their image.
    if (!specimen?.image_url || specimen.visibility !== "everyone") return { url: null };

    // A stored value may already be a full URL; otherwise sign the storage path.
    if (/^https?:\/\//i.test(specimen.image_url)) return { url: specimen.image_url };

    const key = specimen.image_url.replace(/^specimen-images\//, "");
    const storage = supabaseAdmin.storage.from("specimen-images");
    const { data: signed } = await storage.createSignedUrl(key, 60 * 10);
    if (signed?.signedUrl) return { url: signed.signedUrl };

    const { data: pub } = storage.getPublicUrl(key);
    return { url: pub?.publicUrl ?? null };
  });

