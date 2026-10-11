"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { getActiveUser } from "@/lib/auth";
import { isIsoDate, todayIso } from "@/lib/dates";
import { can, screeningReviewProblem } from "@/lib/permissions";
import {
  CORRECTION_LABELS,
  LAB_RESULTS,
  MAX_LAB_REFERENCE_LENGTH,
  MAX_NOTE_LENGTH,
  screeningCode,
  type AiStatus,
  type ReviewDecision,
  type ReviewStatus,
} from "@/lib/screening-options";

export type ReviewActionResult = { ok: boolean; message: string };

const fail = (message: string): ReviewActionResult => ({ ok: false, message });

const DECISIONS: ReviewDecision[] = ["confirmed", "corrected", "rejected", "escalated"];

/** The database's own messages (raised with errcode 42501) are written for people. */
function dbMessage(error: PostgrestError, fallback: string) {
  return error.code === "42501" && error.message ? error.message : fallback;
}

export interface ReviewInput {
  screeningId: number;
  decision: string;
  /** Required for "corrected", ignored otherwise. */
  correctedLabel?: string;
  note: string;
}

/**
 * Adds a review decision. Reviews are append-only: the screening result is
 * never changed, and earlier decisions stay in the history. The same rules
 * are enforced again by the database (007_screening_review_queue.sql).
 */
export async function reviewScreening(input: ReviewInput): Promise<ReviewActionResult> {
  const me = await getActiveUser();
  if (!me) return fail("Your account can't review screenings right now. Sign in again.");
  const { supabase, user, role } = me;
  if (!can(role, "review.act")) return fail("Your role can't review screenings.");

  if (!Number.isSafeInteger(input.screeningId) || input.screeningId <= 0) return fail("Unknown screening.");
  if (!DECISIONS.includes(input.decision as ReviewDecision)) return fail("Choose a decision.");
  const decision = input.decision as ReviewDecision;
  const correctedLabel = decision === "corrected" ? input.correctedLabel : undefined;
  if (decision === "corrected" && !CORRECTION_LABELS.includes(correctedLabel as (typeof CORRECTION_LABELS)[number])) {
    return fail("Choose the corrected label from the list.");
  }
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > MAX_NOTE_LENGTH) return fail(`The note can be at most ${MAX_NOTE_LENGTH} characters.`);

  const { data: screening } = await supabase
    .from("screenings")
    .select("submitted_by, review_status, ai_status")
    .eq("id", input.screeningId)
    .single();
  if (!screening) return fail("That screening no longer exists.");
  const problem = screeningReviewProblem(
    role,
    user.id,
    {
      submittedBy: screening.submitted_by,
      reviewStatus: screening.review_status as ReviewStatus,
      aiStatus: screening.ai_status as AiStatus,
    },
    decision,
  );
  if (problem) return fail(problem);

  const { error } = await supabase.from("screening_reviews").insert({
    screening_id: input.screeningId,
    decision,
    corrected_label: correctedLabel ?? null,
    note,
  });
  if (error) return fail(dbMessage(error, "The decision could not be saved. Try again."));

  revalidatePath("/review");
  revalidatePath("/dashboard");
  return { ok: true, message: `${screeningCode(input.screeningId)}: decision saved.` };
}

export interface LabResultInput {
  screeningId: number;
  labResult: string;
  labReference: string;
  /** YYYY-MM-DD, or "" when unknown. */
  sampleDate: string;
  note: string;
}

/** Records a lab result. Append-only, and kept separate from the review decision. */
export async function recordLabResult(input: LabResultInput): Promise<ReviewActionResult> {
  const me = await getActiveUser();
  if (!me) return fail("Your account can't record lab results right now. Sign in again.");
  const { supabase, role } = me;
  if (!can(role, "lab.record")) return fail("Your role can't record lab results.");

  if (!Number.isSafeInteger(input.screeningId) || input.screeningId <= 0) return fail("Unknown screening.");
  if (!LAB_RESULTS.some((r) => r.value === input.labResult)) return fail("Choose a lab result from the list.");
  const labReference = typeof input.labReference === "string" ? input.labReference.trim() : "";
  if (labReference.length > MAX_LAB_REFERENCE_LENGTH) {
    return fail(`The lab reference can be at most ${MAX_LAB_REFERENCE_LENGTH} characters.`);
  }
  const sampleDate = typeof input.sampleDate === "string" ? input.sampleDate : "";
  if (sampleDate && !isIsoDate(sampleDate)) return fail("Enter a valid sample date.");
  if (sampleDate && sampleDate > todayIso()) return fail("The sample date can't be in the future.");
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > MAX_NOTE_LENGTH) return fail(`The note can be at most ${MAX_NOTE_LENGTH} characters.`);

  const { error } = await supabase.from("screening_lab_results").insert({
    screening_id: input.screeningId,
    lab_result: input.labResult,
    lab_reference: labReference,
    sample_date: sampleDate || null,
    note,
  });
  if (error) return fail(dbMessage(error, "The lab result could not be saved. Try again."));

  revalidatePath("/review");
  return { ok: true, message: `${screeningCode(input.screeningId)}: lab result saved.` };
}
