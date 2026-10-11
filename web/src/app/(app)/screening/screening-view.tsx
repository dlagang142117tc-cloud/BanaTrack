"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { CheckCircle2, ImageUp, Loader2, RotateCcw, ScanSearch, X } from "lucide-react";
import { Card, PageHeader, SampleTag, buttonStyles, cx, inputStyles, labelStyles } from "@/components/ui";
import { ResultPanel } from "@/components/screening-result";
import { createClient } from "@/lib/supabase/client";
import { BLOCKS, MAX_PHOTO_BYTES } from "@/lib/incident-options";
import { MOCK_KINDS, MOCK_MODEL_VERSION, buildMockResult, type MockKind } from "@/lib/mock-model";
import { EXT_BY_TYPE, PHOTO_ACCEPT, TYPE_BY_EXT, photoType } from "@/lib/photos";
import {
  MAX_OBSERVATIONS_LENGTH,
  PLANT_PARTS,
  SCREENING_BUCKET,
  type ScreeningResult,
} from "@/lib/screening-options";
import { submitScreening } from "./actions";

const PREVIEW_LABELS: Record<MockKind, string> = {
  moko: "Moko-like",
  panama: "Panama-like",
  inconclusive: "Inconclusive",
};

type Shown =
  | { kind: "saved"; code: string; modelVersion: string; result: ScreeningResult }
  | { kind: "preview"; result: ScreeningResult };

export function ScreeningView({ userId }: { userId: string }) {
  const [photo, setPhoto] = useState<{ file: File; preview: string; ext: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function pickFile(f: File | undefined) {
    if (!f) return;
    const type = photoType(f);
    if (!type) {
      setPhotoError(`${f.name} isn't a supported photo (JPG, PNG, WebP or HEIC).`);
      return;
    }
    if (f.size > MAX_PHOTO_BYTES) {
      setPhotoError(`${f.name} is larger than ${MAX_PHOTO_BYTES / 1024 / 1024} MB.`);
      return;
    }
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto({ file: f, preview: URL.createObjectURL(f), ext: EXT_BY_TYPE[type] });
    setPhotoError(null);
    setShown(null);
    setError(null);
  }

  function reset() {
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto(null);
    setPhotoError(null);
    setShown(null);
    setError(null);
    formRef.current?.reset();
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!photo) {
      setPhotoError("Add a field photo first.");
      return;
    }
    const data = new FormData(e.currentTarget);
    setShown(null);
    setError(null);

    startTransition(async () => {
      // The photo goes straight from the browser to the private bucket (server
      // actions cap request bodies at 1 MB); the action then saves the screening.
      setStep("Uploading photo…");
      const bucket = createClient().storage.from(SCREENING_BUCKET);
      const path = `${userId}/${crypto.randomUUID()}.${photo.ext}`;
      const { error: uploadError } = await bucket.upload(path, photo.file, { contentType: TYPE_BY_EXT[photo.ext] });
      if (uploadError) {
        setStep(null);
        setError("The photo could not be uploaded. Nothing was saved — try again.");
        return;
      }

      setStep("Screening and saving…");
      const res = await submitScreening({
        storagePath: path,
        block: String(data.get("block") ?? ""),
        plantPart: String(data.get("plantPart") ?? ""),
        observations: String(data.get("observations") ?? ""),
      }).catch(() => ({ ok: false as const, message: "The screening could not be saved. Try again." }));
      setStep(null);

      if (!res.ok) {
        // Not linked to a screening, so the storage policy lets us remove it.
        await bucket.remove([path]);
        setError(res.message);
        return;
      }
      setShown({ kind: "saved", code: res.code, modelVersion: res.modelVersion, result: res.result });
    });
  }

  const saved = shown?.kind === "saved";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disease Screening"
        description="Upload a field photo to get a screening result, severity estimate, and case-review priority. Results are triage support only and need human confirmation: every screening is saved and sent to the Review Queue."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload */}
        <Card title="1. Field photo & context">
          <form ref={formRef} onSubmit={handleSubmit}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!pending && !saved) pickFile(e.dataTransfer.files[0]);
              }}
              className={cx(
                "relative overflow-hidden rounded-xl border-2 border-dashed transition-colors",
                dragging ? "border-leaf-500 bg-leaf-50" : "border-leaf-200 bg-leaf-50/40",
              )}
            >
              {photo ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                  <img src={photo.preview} alt="Selected field photo" className="aspect-[4/3] w-full object-cover" />
                  {!pending && !saved && (
                    <button
                      type="button"
                      onClick={reset}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-ink shadow hover:bg-white"
                      aria-label="Remove photo"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 p-6 text-center"
                >
                  <span className="grid size-14 place-items-center rounded-2xl bg-white text-leaf-600 shadow-sm">
                    <ImageUp className="size-7" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-ink">Drop a photo here, or tap to browse</span>
                  <span className="text-xs text-muted">
                    JPG, PNG, WebP or HEIC · up to {MAX_PHOTO_BYTES / 1024 / 1024} MB · leaf, pseudostem, or bunch · good
                    lighting helps
                  </span>
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={PHOTO_ACCEPT}
                capture="environment"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>
            {photoError && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {photoError}
              </p>
            )}
            <p className="mt-2 text-xs text-muted">Stored privately; only reviewers and you can open it.</p>

            <fieldset disabled={pending || saved} className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="block" className={labelStyles}>Block</label>
                <select id="block" name="block" className={inputStyles} defaultValue="" required>
                  <option value="" disabled>
                    Choose a block
                  </option>
                  {BLOCKS.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="plantPart" className={labelStyles}>Plant part</label>
                <select id="plantPart" name="plantPart" className={inputStyles} defaultValue="leaf" required>
                  {PLANT_PARTS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="observations" className={labelStyles}>
                  Field observations <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id="observations"
                  name="observations"
                  rows={2}
                  maxLength={MAX_OBSERVATIONS_LENGTH}
                  className={inputStyles}
                  placeholder="e.g. ooze on cut stem, yellowing from older leaves…"
                />
              </div>
            </fieldset>

            {saved ? (
              <button type="button" onClick={reset} className={cx(buttonStyles.secondary, "mt-5 w-full py-2.5")}>
                <RotateCcw className="size-4" aria-hidden /> Start a new screening
              </button>
            ) : (
              <button type="submit" disabled={!photo || pending} className={cx(buttonStyles.accent, "mt-5 w-full py-2.5")}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ScanSearch className="size-4" aria-hidden />}
                {pending ? (step ?? "Screening…") : "Run screening"}
              </button>
            )}
            {error && (
              <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}
          </form>
        </Card>

        {/* Results */}
        <Card title="2. Screening result" action={<SampleTag label="Mock result — no AI model yet" />}>
          {pending ? (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-sm text-muted">
              <Loader2 className="size-8 animate-spin text-leaf-500" aria-hidden />
              {step ?? "Screening…"}
            </div>
          ) : shown ? (
            <div className="space-y-4">
              {shown.kind === "saved" ? (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-leaf-200 bg-leaf-50 p-3 text-sm text-leaf-900"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    Saved as <strong className="font-mono">{shown.code}</strong> and sent to the Review Queue. A reviewer
                    will confirm, correct, reject or escalate it.
                  </span>
                </p>
              ) : (
                <p className="rounded-xl border border-dashed border-line bg-canvas p-3 text-sm text-muted">
                  Preview only — not saved and not sent to the Review Queue.
                </p>
              )}
              <ResultPanel result={shown.result} modelVersion={shown.kind === "saved" ? shown.modelVersion : MOCK_MODEL_VERSION} />
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center gap-2 rounded-xl bg-leaf-50/50 p-6 text-center">
              <ScanSearch className="size-8 text-leaf-300" aria-hidden />
              <p className="text-sm font-medium text-ink">No result yet</p>
              <p className="max-w-xs text-xs text-muted">
                Add a photo, choose the block, and run screening. The result appears here with confidence, severity, and
                the evidence behind it.
              </p>
            </div>
          )}

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs font-medium text-muted">Preview result states (preview only — not saved)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MOCK_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={pending}
                  onClick={() => setShown({ kind: "preview", result: buildMockResult(k, "") })}
                  className={cx(buttonStyles.secondary, "px-3 py-1.5 text-xs")}
                >
                  {PREVIEW_LABELS[k]} preview
                </button>
              ))}
              {shown?.kind === "preview" && (
                <button type="button" onClick={() => setShown(null)} className={cx(buttonStyles.ghost, "px-3 py-1.5 text-xs")}>
                  <RotateCcw className="size-3.5" aria-hidden /> Clear
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
