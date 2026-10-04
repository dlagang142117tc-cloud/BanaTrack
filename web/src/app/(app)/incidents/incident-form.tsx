"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Camera, Check, Loader2, Plus, X } from "lucide-react";
import { Card, buttonStyles, cx, inputStyles, labelStyles } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { todayIso } from "@/lib/dates";
import {
  ACTIONS,
  BLOCKS,
  DEFAULT_SEVERITY,
  MAX_NOTES_LENGTH,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  PHOTO_BUCKET,
  PHOTO_TYPES,
  SEVERITIES,
  SUSPECTED_DISEASES,
  SYMPTOMS,
} from "@/lib/incident-options";
import { createIncident, type IncidentActionResult } from "./actions";

interface PickedPhoto {
  key: string;
  file: File;
  preview: string;
  ext: string;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
const TYPE_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };

/** Some browsers leave `type` empty for HEIC photos, so fall back to the extension. */
function photoType(file: File) {
  if (PHOTO_TYPES.includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXT[ext] ?? null;
}

export function IncidentForm({ userId, reporterName }: { userId: string; reporterName: string }) {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [result, setResult] = useState<IncidentActionResult | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  // Free the preview blobs when leaving the page.
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  function toggleSymptom(s: string) {
    setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const next = [...photos];
    let problem: string | null = null;
    for (const file of Array.from(files)) {
      const type = photoType(file);
      if (!type) {
        problem = `${file.name} isn't a supported image (JPEG, PNG, WebP or HEIC).`;
      } else if (file.size > MAX_PHOTO_BYTES) {
        problem = `${file.name} is larger than ${MAX_PHOTO_BYTES / 1024 / 1024} MB.`;
      } else if (next.length >= MAX_PHOTOS) {
        problem = `You can attach up to ${MAX_PHOTOS} photos.`;
      } else {
        next.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), ext: EXT_BY_TYPE[type] });
      }
    }
    setPhotos(next);
    setPhotoError(problem);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removePhoto(key: string) {
    setPhotos((cur) => {
      const gone = cur.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return cur.filter((p) => p.key !== key);
    });
    setPhotoError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setResult(null);

    startTransition(async () => {
      const supabase = createClient();
      const bucket = supabase.storage.from(PHOTO_BUCKET);
      const uploaded: string[] = [];

      // Photos go straight from the browser to the private bucket (server
      // actions cap request bodies at 1 MB); the action then links them.
      for (const [i, photo] of photos.entries()) {
        setStep(`Uploading photo ${i + 1} of ${photos.length}…`);
        const path = `${userId}/${crypto.randomUUID()}.${photo.ext}`;
        const { error } = await bucket.upload(path, photo.file, { contentType: TYPE_BY_EXT[photo.ext] });
        if (error) {
          if (uploaded.length) await bucket.remove(uploaded);
          setStep(null);
          setResult({ ok: false, message: `Photo ${i + 1} could not be uploaded. Nothing was saved — try again.` });
          return;
        }
        uploaded.push(path);
      }

      setStep("Saving incident and weather snapshot…");
      const res = await createIncident({
        date: String(data.get("date") ?? ""),
        block: String(data.get("block") ?? ""),
        suspected: String(data.get("suspected") ?? ""),
        severity: String(data.get("severity") ?? ""),
        action: String(data.get("action") ?? ""),
        notes: String(data.get("notes") ?? ""),
        symptoms,
        photoPaths: uploaded,
      }).catch((): IncidentActionResult => ({ ok: false, message: "The incident could not be saved. Try again." }));

      if (!res.ok) {
        if (uploaded.length) await bucket.remove(uploaded);
      } else {
        form.reset();
        setSymptoms([]);
        photos.forEach((p) => URL.revokeObjectURL(p.preview));
        setPhotos([]);
        setPhotoError(null);
      }
      setStep(null);
      setResult(res);
    });
  }

  return (
    <Card title="Record a new incident">
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset disabled={pending} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Date" htmlFor="date">
              <input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={todayIso()}
                max={todayIso()}
                className={inputStyles}
              />
            </Field>
            <Field label="Block / area" htmlFor="block">
              <select id="block" name="block" required className={inputStyles}>
                {BLOCKS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </Field>
            <Field label="Personnel" htmlFor="personnel">
              <input
                id="personnel"
                value={reporterName}
                readOnly
                title="Incidents are recorded under your signed-in account."
                className={cx(inputStyles, "bg-canvas text-muted")}
              />
            </Field>
            <Field label="Action taken" htmlFor="action">
              <select id="action" name="action" required className={inputStyles}>
                {ACTIONS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Suspected disease" htmlFor="suspected">
              <select id="suspected" name="suspected" className={inputStyles}>
                {SUSPECTED_DISEASES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Observed severity" htmlFor="severity">
              <select id="severity" name="severity" className={inputStyles} defaultValue={DEFAULT_SEVERITY}>
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset>
            <legend className={labelStyles}>Symptoms observed</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SYMPTOMS.map((s) => {
                const on = symptoms.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSymptom(s)}
                    aria-pressed={on}
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      on
                        ? "border-leaf-600 bg-leaf-600 text-white"
                        : "border-line bg-white text-ink hover:border-leaf-300 hover:bg-leaf-50",
                    )}
                  >
                    {on && <Check className="size-3" aria-hidden />}
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <p className={labelStyles}>Photos</p>
            <p className="mt-0.5 text-xs text-muted">
              Up to {MAX_PHOTOS} photos, {MAX_PHOTO_BYTES / 1024 / 1024} MB each. Stored privately; only signed-in staff
              can view them.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p.key} className="relative size-20 overflow-hidden rounded-lg border border-line bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                  <img src={p.preview} alt={p.file.name} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.key)}
                    aria-label={`Remove ${p.file.name}`}
                    className="absolute right-1 top-1 rounded-full bg-ink/70 p-0.5 text-white hover:bg-ink"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-leaf-300 text-xs text-leaf-700 hover:bg-leaf-50">
                  <Camera className="size-5" aria-hidden />
                  Add photo
                  <input
                    ref={fileInput}
                    type="file"
                    accept={`${PHOTO_TYPES.join(",")},.heic,.heif`}
                    multiple
                    onChange={(e) => addPhotos(e.target.files)}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
            {photoError && <p className="mt-1.5 text-xs text-red-700">{photoError}</p>}
          </div>

          <Field label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={MAX_NOTES_LENGTH}
              className={inputStyles}
              placeholder="Location details, number of mats affected, anything unusual…"
            />
          </Field>
        </fieldset>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {pending && step && <span className="text-sm text-muted">{step}</span>}
          {!pending && result && (
            <span
              role="status"
              className={cx("inline-flex items-center gap-1 text-sm", result.ok ? "text-leaf-700" : "text-red-700")}
            >
              {result.ok && <Check className="size-4" aria-hidden />} {result.message}
            </span>
          )}
          <button type="submit" disabled={pending} className={buttonStyles.accent}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Record incident
          </button>
        </div>
      </form>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={labelStyles}>
        {label}
      </label>
      {children}
    </div>
  );
}
