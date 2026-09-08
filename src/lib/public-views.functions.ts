import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { normalizeSerial } from "@/lib/serial";

/** Requests allowed per visitor, per endpoint, within the window below. */
const THROTTLE_LIMIT = 60;
const THROTTLE_WINDOW_MS = 60 * 1000;

/** Non-reversible visitor key: a hash of the caller address, never the address. */
async function clientHash(): Promise<string> {
  let raw = "unknown";
  try {
    const req = getRequest();
    raw =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
  } catch {
    raw = "unknown";
  }
  const bytes = new TextEncoder().encode(`herbarium:${raw}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/**
 * Simple per-visitor rate limit for the public endpoints.
 * Returns false when the caller exceeded the allowance for this window.
 */
async function allowPublicCall(endpoint: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await clientHash();
  const windowStart = new Date(Date.now() - THROTTLE_WINDOW_MS).toISOString();

  const { data: row } = await supabaseAdmin
    .from("public_access_throttle")
    .select("id, hit_count, window_start")
    .eq("client_hash", hash)
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (!row) {
    await supabaseAdmin.from("public_access_throttle").insert({ client_hash: hash, endpoint });
    return true;
  }

  if (row.window_start < windowStart) {
    await supabaseAdmin
      .from("public_access_throttle")
      .update({ hit_count: 1, window_start: new Date().toISOString() })
      .eq("id", row.id);
    return true;
  }

  if (row.hit_count >= THROTTLE_LIMIT) return false;

  await supabaseAdmin
    .from("public_access_throttle")
    .update({ hit_count: row.hit_count + 1 })
    .eq("id", row.id);
  return true;
}

/** Validates and canonicalises the serial before any lookup. */
function parseSerialInput(input: { serial: string }): { serial: string } {
  const raw = z.object({ serial: z.string() }).parse(input).serial;
  const serial = normalizeSerial(raw);
  if (!serial) throw new Error("INVALID_SERIAL");
  return { serial };
}


/**
 * Records an anonymous visit to the public summary page (/p/:serial).
 * Only the serial number is stored: no IP address, user agent, referrer,
 * or any specimen field beyond the identifier already present in the URL.
 */
export const logPublicSpecimenView = createServerFn({ method: "POST" })
  .inputValidator((input: { serial: string }) => parseSerialInput(input))

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
  .inputValidator((input: { serial: string }) => parseSerialInput(input))
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

