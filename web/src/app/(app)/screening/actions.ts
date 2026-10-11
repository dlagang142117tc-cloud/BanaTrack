"use server";

import { revalidatePath } from "next/cache";
import { getActiveUser } from "@/lib/auth";
import { BLOCKS } from "@/lib/incident-options";
import { MOCK_MODEL_VERSION, randomMockResult } from "@/lib/mock-model";
import { can } from "@/lib/permissions";
import { isOwnPhotoPath } from "@/lib/photos";
import {
  MAX_OBSERVATIONS_LENGTH,
  PLANT_PARTS,
  SCREENING_BUCKET,
  screeningCode,
  type ScreeningResult,
} from "@/lib/screening-options";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SubmitScreeningInput {
  /** Path in the screening-photos bucket, already uploaded by the browser. */
  storagePath: string;
  block: string;
  plantPart: string;
  observations: string;
}

export type SubmitScreeningResult =
  | { ok: true; code: string; modelVersion: string; result: ScreeningResult }
  | { ok: false; message: string };

const fail = (message: string): SubmitScreeningResult => ({ ok: false, message });

/**
 * Saves a screening and its screening result. The mock result is created
 * here, never in the browser, and saved with the service role: users can't
 * write screenings themselves (007_screening_review_queue.sql), so the
 * screening result can't be forged through the API.
 */
export async function submitScreening(input: SubmitScreeningInput): Promise<SubmitScreeningResult> {
  const me = await getActiveUser();
  if (!me) return fail("Your account can't submit screenings right now. Sign in again.");
  const { supabase, user, role } = me;
  if (!can(role, "screening.submit")) return fail("Your role can't submit screenings.");

  if (!BLOCKS.includes(input.block)) return fail("Choose a block from the list.");
  if (!PLANT_PARTS.some((p) => p.value === input.plantPart)) return fail("Choose a plant part from the list.");
  const observations = typeof input.observations === "string" ? input.observations.trim() : "";
  if (observations.length > MAX_OBSERVATIONS_LENGTH) {
    return fail(`Field observations can be at most ${MAX_OBSERVATIONS_LENGTH} characters.`);
  }
  if (!isOwnPhotoPath(input.storagePath, user.id)) return fail("The photo could not be matched to your upload.");

  // The photo must really be in the caller's folder: the service-role insert
  // below doesn't check storage.
  const [folder, name] = input.storagePath.split("/");
  const { data: files, error: listError } = await supabase.storage
    .from(SCREENING_BUCKET)
    .list(folder, { search: name, limit: 1 });
  if (listError || !files?.some((f) => f.name === name)) {
    return fail("The photo upload could not be found. Try again.");
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Server is missing SUPABASE_SERVICE_ROLE_KEY — see web/.env.local.example.");
  }

  const result = randomMockResult(observations);
  const { data, error } = await admin
    .from("screenings")
    .insert({
      submitted_by: user.id,
      block: input.block,
      plant_part: input.plantPart,
      observations,
      storage_path: input.storagePath,
      model_version: MOCK_MODEL_VERSION,
      ai_status: result.status,
      ai_label: result.label,
      ai_confidence: result.confidence,
      ai_severity_pct: result.severityPct,
      ai_severity: result.severity,
      ai_priority: result.priority,
      ai_evidence: result.evidence,
      ai_abstain_reason: result.abstainReason,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error(`Screening not saved: ${error?.message}`);
    return fail("The screening could not be saved. Try again.");
  }

  revalidatePath("/review");
  revalidatePath("/dashboard");
  return { ok: true, code: screeningCode(data.id), modelVersion: MOCK_MODEL_VERSION, result };
}
