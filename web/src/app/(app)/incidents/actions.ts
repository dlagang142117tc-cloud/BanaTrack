"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIso } from "@/lib/dates";
import { getWeatherSnapshot } from "@/lib/weather";
import {
  ACTIONS,
  BLOCKS,
  MAX_NOTES_LENGTH,
  MAX_PHOTOS,
  PHOTO_BUCKET,
  SEVERITIES,
  STATUSES,
  SUSPECTED_DISEASES,
  SYMPTOMS,
  incidentCode,
} from "@/lib/incident-options";

export type IncidentActionResult = { ok: true; message: string } | { ok: false; message: string };

export interface NewIncidentInput {
  date: string;
  block: string;
  suspected: string;
  severity: string;
  action: string;
  notes: string;
  symptoms: string[];
  /** Paths in the incident-photos bucket, already uploaded by the browser. */
  photoPaths: string[];
}

export interface IncidentEditInput {
  id: number;
  status: string;
  block: string;
  suspected: string;
  severity: string;
  action: string;
  notes: string;
  symptoms: string[];
}

function fail(message: string): IncidentActionResult {
  return { ok: false, message };
}

/**
 * Server actions are callable directly, so each one re-checks the session and
 * that the account is active. The database policies enforce the same rules.
 */
async function requireActiveUser(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>>; user: User; role: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Sign in again." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, deactivated_at, must_change_password")
    .eq("id", user.id)
    .single();
  if (!me || me.deactivated_at || me.must_change_password) {
    return { error: "Your account can't record incidents right now." };
  }
  return { supabase, user, role: me.role };
}

const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const PHOTO_NAME = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|heif)$/;

/** The observation fields shared by new incidents and edits. */
function validateObservation(input: Omit<IncidentEditInput, "id" | "status">): string | null {
  if (!BLOCKS.includes(input.block)) return "Choose a block from the list.";
  if (!SUSPECTED_DISEASES.some((d) => d.value === input.suspected)) return "Choose a suspected disease from the list.";
  if (!SEVERITIES.some((s) => s.value === input.severity)) return "Choose a severity from the list.";
  if (!ACTIONS.includes(input.action)) return "Choose an action from the list.";
  if (typeof input.notes !== "string" || input.notes.length > MAX_NOTES_LENGTH) {
    return `Notes can be at most ${MAX_NOTES_LENGTH} characters.`;
  }
  if (!Array.isArray(input.symptoms) || !input.symptoms.every((s) => SYMPTOMS.includes(s))) {
    return "Choose symptoms from the list.";
  }
  return null;
}

function validate(input: NewIncidentInput, userId: string, today: string): string | null {
  if (!isIsoDate(input.date)) return "Enter a valid date.";
  if (input.date > today) return "The incident date can't be in the future.";
  const problem = validateObservation(input);
  if (problem) return problem;
  if (!Array.isArray(input.photoPaths) || input.photoPaths.length > MAX_PHOTOS) {
    return `You can attach up to ${MAX_PHOTOS} photos.`;
  }
  // Photos must sit in the caller's own folder (the storage policy enforces this too).
  const ownPhotos = input.photoPaths.every((p) => {
    const [folder, name, ...rest] = String(p).split("/");
    return folder === userId && rest.length === 0 && PHOTO_NAME.test(name ?? "");
  });
  if (!ownPhotos) return "One of the photos could not be matched to your upload.";
  return null;
}

export async function createIncident(input: NewIncidentInput): Promise<IncidentActionResult> {
  const auth = await requireActiveUser();
  if ("error" in auth) return fail(auth.error);
  const { supabase, user } = auth;

  const today = todayIso();
  const problem = validate(input, user.id, today);
  if (problem) return fail(problem);

  // reported_by and reporter_name are filled in by a database trigger from the
  // session. Weather is not sent here: users can't write the weather columns
  // (005_incident_status_and_weather.sql); attachWeather() adds them below.
  const { data: incident, error } = await supabase
    .from("incidents")
    .insert({
      incident_date: input.date,
      block: input.block,
      suspected_disease: input.suspected,
      severity: input.severity,
      action_taken: input.action,
      notes: input.notes.trim(),
      reported_by: user.id,
    })
    .select("id")
    .single();
  if (error || !incident) return fail("The incident could not be saved. Try again.");

  const symptoms = [...new Set(input.symptoms)];
  const [symptomResult, photoResult] = await Promise.all([
    symptoms.length
      ? supabase.from("incident_symptoms").insert(symptoms.map((symptom) => ({ incident_id: incident.id, symptom })))
      : Promise.resolve({ error: null }),
    input.photoPaths.length
      ? supabase
          .from("incident_photos")
          .insert(input.photoPaths.map((storage_path) => ({ incident_id: incident.id, storage_path, uploaded_by: user.id })))
      : Promise.resolve({ error: null }),
  ]);
  if (symptomResult.error || photoResult.error) {
    // Don't leave a half-saved incident behind; the browser removes the uploaded files.
    await supabase.from("incidents").delete().eq("id", incident.id);
    return fail("The incident could not be saved. Try again.");
  }

  // Weather is context, not a requirement: the incident stays saved without it.
  const weatherNote = await attachWeather(incident.id, input.date, today);

  revalidatePath("/incidents");
  return { ok: true, message: `${incidentCode(incident.id)} saved.${weatherNote}` };
}

/**
 * Fetches the weather snapshot and writes it with the service role, the only
 * role allowed to set the weather columns. Returns a note for the user when
 * no snapshot could be attached.
 */
async function attachWeather(incidentId: number, dateIso: string, today: string): Promise<string> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    console.error("Weather snapshot skipped: SUPABASE_SERVICE_ROLE_KEY is not set.");
    return " No weather snapshot was attached (the server is missing its service key).";
  }

  const weather = await getWeatherSnapshot(dateIso, today);
  if (!weather) return " Weather data was unavailable, so no weather snapshot was attached.";

  const { error } = await admin
    .from("incidents")
    .update({
      weather_rain_3d_mm: weather.rain3dMm,
      weather_rain_7d_mm: weather.rain7dMm,
      weather_humidity_mean_pct: weather.humidityMeanPct,
      weather_temp_mean_c: weather.tempMeanC,
      weather_window_start: weather.windowStart,
      weather_window_end: weather.windowEnd,
      weather_source: weather.source,
      weather_fetched_at: new Date().toISOString(),
    })
    .eq("id", incidentId);
  if (error) {
    console.error(`Weather snapshot for incident ${incidentId} not saved: ${error.message}`);
    return " The weather snapshot could not be saved.";
  }
  return "";
}

export async function updateIncident(input: IncidentEditInput): Promise<IncidentActionResult> {
  const auth = await requireActiveUser();
  if ("error" in auth) return fail(auth.error);
  const { supabase, user, role } = auth;
  if (!Number.isSafeInteger(input.id) || input.id <= 0) return fail("Unknown incident.");
  if (!STATUSES.some((s) => s.value === input.status)) return fail("Choose a status from the list.");
  const problem = validateObservation(input);
  if (problem) return fail(problem);

  const { data: incident } = await supabase.from("incidents").select("reported_by").eq("id", input.id).single();
  if (!incident) return fail("That incident no longer exists.");
  if (incident.reported_by !== user.id && role !== "supervisor" && role !== "admin") {
    return fail("Only the reporter, supervisors and admins can edit an incident.");
  }

  // One transaction: the incident row and its symptoms are saved together or
  // not at all. Runs as the caller, so RLS and the column grants still apply.
  const { error } = await supabase.rpc("update_incident", {
    p_id: input.id,
    p_status: input.status,
    p_block: input.block,
    p_suspected_disease: input.suspected,
    p_severity: input.severity,
    p_action_taken: input.action,
    p_notes: input.notes.trim(),
    p_symptoms: [...new Set(input.symptoms)],
  });
  if (error) return fail("The changes could not be saved. Try again.");

  revalidatePath("/incidents");
  return { ok: true, message: `${incidentCode(input.id)} updated.` };
}

export async function deleteIncident(id: number): Promise<IncidentActionResult> {
  const auth = await requireActiveUser();
  if ("error" in auth) return fail(auth.error);
  const { supabase, user, role } = auth;
  if (!Number.isSafeInteger(id) || id <= 0) return fail("Unknown incident.");

  const { data: incident } = await supabase
    .from("incidents")
    .select("id, reported_by, incident_photos(storage_path)")
    .eq("id", id)
    .single();
  if (!incident) return fail("That incident no longer exists.");
  if (incident.reported_by !== user.id && role !== "supervisor" && role !== "admin") {
    return fail("Only the reporter, supervisors and admins can delete an incident.");
  }

  const { data: deleted, error } = await supabase.from("incidents").delete().eq("id", id).select("id");
  if (error || !deleted?.length) return fail("The incident could not be deleted.");

  // Symptoms and photo rows are removed by the cascade; remove the files too.
  const paths = incident.incident_photos.map((p) => p.storage_path);
  let note = "";
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    if (storageError) note = " Some photo files could not be removed from storage.";
  }

  revalidatePath("/incidents");
  return { ok: true, message: `${incidentCode(id)} deleted.${note}` };
}
