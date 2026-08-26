import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SPECIMEN_IMAGE_BUCKET = "specimen-images";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function isAllowedImage(file: File): boolean {
  return ALLOWED_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES;
}

/** Uploads the image and stores its storage path on the specimen row. */
export async function uploadSpecimenImage(specimenId: string, file: File): Promise<string> {
  if (!isAllowedImage(file)) throw new Error("INVALID_IMAGE");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${specimenId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(SPECIMEN_IMAGE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
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

export async function getSpecimenImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(SPECIMEN_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
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
