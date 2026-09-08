import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SPECIMEN_IMAGE_BUCKET = "specimen-images";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function isAllowedImage(file: File): boolean {
  return ALLOWED_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES;
}

/** Long edge, in pixels, kept for stored specimen photos. */
const MAX_EDGE = 2000;
const QUALITY = 0.82;

/**
 * Resizes and re-encodes a photo in the browser before upload so stored files
 * stay around a few hundred kilobytes instead of several megabytes.
 * Returns the original file unchanged when compression is not possible.
 */
export async function compressImage(file: File): Promise<{ blob: Blob; ext: string }> {
  const fallback = { blob: file as Blob, ext: file.name.split(".").pop()?.toLowerCase() || "jpg" };
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return fallback;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fallback;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!blob || blob.size >= file.size) return fallback;
    return { blob, ext: "webp" };
  } catch {
    return fallback;
  }
}

/** Uploads the image and stores its storage path on the specimen row. */
export async function uploadSpecimenImage(specimenId: string, file: File): Promise<string> {
  if (!isAllowedImage(file)) throw new Error("INVALID_IMAGE");
  const { blob, ext: rawExt } = await compressImage(file);
  const ext = rawExt.replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${specimenId}/${Date.now()}.${ext}`;
  const contentType = blob.type || file.type;

  const { error: uploadError } = await supabase.storage
    .from(SPECIMEN_IMAGE_BUCKET)
    .upload(path, blob, { upsert: false, contentType });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase
    .from("herbarium_specimens")
    .update({ image_url: path })
    .eq("id", specimenId);
  if (error) {
    await supabase.storage.from(SPECIMEN_IMAGE_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return path;
}

/** Clears the specimen image and removes the stored file. */
export async function deleteSpecimenImage(specimenId: string, path: string | null): Promise<void> {
  const { error } = await supabase
    .from("herbarium_specimens")
    .update({ image_url: null })
    .eq("id", specimenId);
  if (error) throw new Error(error.message);
  if (path) await supabase.storage.from(SPECIMEN_IMAGE_BUCKET).remove([path]);
}

/**
 * Read-only URL for a stored image reference.
 * Accepts either a full http(s) URL (returned as-is) or a storage path, for
 * which a signed read-only URL is created; falls back to the public URL when
 * the bucket is public.
 */
export async function getSpecimenImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const key = path.replace(new RegExp(`^${SPECIMEN_IMAGE_BUCKET}/`), "");
  const { data, error } = await supabase.storage
    .from(SPECIMEN_IMAGE_BUCKET)
    .createSignedUrl(key, 60 * 60);
  if (!error && data?.signedUrl) return data.signedUrl;
  const { data: pub } = supabase.storage.from(SPECIMEN_IMAGE_BUCKET).getPublicUrl(key);
  return pub?.publicUrl ?? null;
}


/** Signed URL for a specimen image path, refreshed before the hour expires. */
export function useSpecimenImageUrl(path: string | null) {
  return useQuery({
    queryKey: ["specimen-image", path],
    queryFn: () => getSpecimenImageUrl(path),
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
  });
}
