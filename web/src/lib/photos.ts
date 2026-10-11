import { PHOTO_TYPES } from "./incident-options";

// Field photos (Incident Log and Disease Screening). Both buckets accept the
// same types and size limit.

export const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
export const TYPE_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };

/** For a file input's `accept` attribute. */
export const PHOTO_ACCEPT = `${PHOTO_TYPES.join(",")},.heic,.heif`;

/** Some browsers leave `type` empty for HEIC photos, so fall back to the extension. */
export function photoType(file: File) {
  if (PHOTO_TYPES.includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXT[ext] ?? null;
}

/** "<user id>/<uuid>.<ext>": a photo the browser uploaded to the user's own folder. */
export const PHOTO_NAME = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|heif)$/;

export function isOwnPhotoPath(path: unknown, userId: string) {
  const [folder, name, ...rest] = String(path).split("/");
  return folder === userId && rest.length === 0 && PHOTO_NAME.test(name ?? "");
}
