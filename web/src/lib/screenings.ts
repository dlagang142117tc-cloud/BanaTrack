import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANTATION_LOCATION } from "./weather";
import { can, screeningReviewProblem } from "./permissions";
import {
  SCREENING_BUCKET,
  screeningCode,
  type AiPriority,
  type AiStatus,
  type EvidenceItem,
  type LabStatus,
  type ReviewDecision,
  type ReviewStatus,
  type ScreeningResult,
} from "./screening-options";

// Loads screenings for the Review Queue and the dashboard. Runs with the
// caller's session, so RLS limits it to reviewer roles (review.view).

export const QUEUE_LIMIT = 300;
const PHOTO_URL_SECONDS = 60 * 60;
const DECISIONS: ReviewDecision[] = ["confirmed", "corrected", "rejected", "escalated"];

// Shown in plantation time.
const timestampFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: PLANTATION_LOCATION.timezone,
});
const shortDateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const formatTimestamp = (iso: string) => timestampFmt.format(new Date(iso));

export interface ReviewEntry {
  id: number;
  decision: ReviewDecision;
  correctedLabel: string | null;
  note: string;
  reviewerName: string;
  reviewerRole: string;
  modelVersion: string;
  at: string;
}

export interface LabEntry {
  id: number;
  result: Exclude<LabStatus, "none">;
  reference: string;
  sampleDate: string | null;
  note: string;
  recorderName: string;
  at: string;
}

export interface ReviewCase {
  id: number;
  code: string;
  submittedAt: string;
  /** ISO timestamps, for sorting. */
  submittedIso: string;
  lastReviewedIso: string | null;
  submittedBy: string;
  submitterName: string;
  block: string;
  plantPart: string;
  observations: string;
  photoUrl: string | null;
  modelVersion: string;
  /** Screening result (AI output). Never changes. */
  result: ScreeningResult;
  /** Human-confirmed status. */
  reviewStatus: ReviewStatus;
  humanLabel: string | null;
  lastReviewedAt: string | null;
  lastReviewedByName: string | null;
  /** Lab-confirmed status. */
  labStatus: LabStatus;
  reviews: ReviewEntry[];
  labResults: LabEntry[];
  /** What the current viewer may do. */
  allowedDecisions: ReviewDecision[];
  /** Why the viewer can't act, when they can't (null for Admin's view-only access). */
  blockedReason: string | null;
  canRecordLab: boolean;
}

interface ScreeningRow {
  id: number;
  created_at: string;
  submitted_by: string;
  submitter_name: string;
  block: string;
  plant_part: string;
  observations: string;
  storage_path: string;
  model_version: string;
  ai_status: AiStatus;
  ai_label: string;
  ai_confidence: number;
  ai_severity_pct: number | null;
  ai_severity: ScreeningResult["severity"];
  ai_priority: AiPriority;
  ai_evidence: EvidenceItem[];
  ai_abstain_reason: string | null;
  review_status: ReviewStatus;
  human_label: string | null;
  last_reviewed_at: string | null;
  last_reviewed_by_name: string | null;
  lab_status: LabStatus;
  screening_reviews: {
    id: number;
    decision: ReviewDecision;
    corrected_label: string | null;
    note: string;
    reviewer_name: string;
    reviewer_role: string;
    model_version: string;
    created_at: string;
  }[];
  screening_lab_results: {
    id: number;
    lab_result: Exclude<LabStatus, "none">;
    lab_reference: string;
    sample_date: string | null;
    note: string;
    recorder_name: string;
    created_at: string;
  }[];
}

const SCREENING_COLUMNS = `id, created_at, submitted_by, submitter_name, block, plant_part, observations, storage_path,
  model_version, ai_status, ai_label, ai_confidence, ai_severity_pct, ai_severity, ai_priority, ai_evidence,
  ai_abstain_reason, review_status, human_label, last_reviewed_at, last_reviewed_by_name, lab_status`;

/** Screening result (AI output) from a row. */
export function toResult(row: ScreeningRow): ScreeningResult {
  return {
    status: row.ai_status,
    label: row.ai_label,
    confidence: Number(row.ai_confidence),
    severityPct: row.ai_severity_pct,
    severity: row.ai_severity,
    priority: row.ai_priority,
    evidence: Array.isArray(row.ai_evidence) ? row.ai_evidence : [],
    abstainReason: row.ai_abstain_reason,
  };
}

/**
 * Newest screenings first (up to QUEUE_LIMIT), with their full review and lab
 * history. Sorting by case-review priority happens in the Review Queue.
 */
export async function getReviewQueue(
  supabase: SupabaseClient,
  viewer: { id: string; role: string | null | undefined },
): Promise<{ cases: ReviewCase[]; error: boolean }> {
  const { data, error } = await supabase
    .from("screenings")
    .select(
      `${SCREENING_COLUMNS},
       screening_reviews(id, decision, corrected_label, note, reviewer_name, reviewer_role, model_version, created_at),
       screening_lab_results(id, lab_result, lab_reference, sample_date, note, recorder_name, created_at)`,
    )
    .order("created_at", { ascending: false })
    .limit(QUEUE_LIMIT);
  if (error || !data) return { cases: [], error: true };
  const rows = data as unknown as ScreeningRow[];

  // The bucket is private: photos use short-lived signed URLs.
  const signed = new Map<string, string>();
  if (rows.length) {
    const { data: urls } = await supabase.storage
      .from(SCREENING_BUCKET)
      .createSignedUrls(rows.map((r) => r.storage_path), PHOTO_URL_SECONDS);
    urls?.forEach((u) => {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    });
  }

  const canRecordLab = can(viewer.role, "lab.record");
  const cases = rows.map((r): ReviewCase => {
    const state = { submittedBy: r.submitted_by, reviewStatus: r.review_status, aiStatus: r.ai_status };
    const allowedDecisions = DECISIONS.filter((d) => !screeningReviewProblem(viewer.role, viewer.id, state, d));
    // Why no decision is possible, shown on open cases and on your own
    // submissions. Admin is simply view-only, and Disease In-Charge needs no
    // reminder on every closed case.
    const reason = screeningReviewProblem(viewer.role, viewer.id, state, "rejected");
    const open = r.review_status === "pending" || r.review_status === "escalated";
    const blockedReason =
      allowedDecisions.length || !can(viewer.role, "review.act") || !(open || r.submitted_by === viewer.id)
        ? null
        : reason;

    return {
      id: r.id,
      code: screeningCode(r.id),
      submittedAt: formatTimestamp(r.created_at),
      submittedIso: r.created_at,
      lastReviewedIso: r.last_reviewed_at,
      submittedBy: r.submitted_by,
      submitterName: r.submitter_name,
      block: r.block,
      plantPart: r.plant_part,
      observations: r.observations,
      photoUrl: signed.get(r.storage_path) ?? null,
      modelVersion: r.model_version,
      result: toResult(r),
      reviewStatus: r.review_status,
      humanLabel: r.human_label,
      lastReviewedAt: r.last_reviewed_at ? formatTimestamp(r.last_reviewed_at) : null,
      lastReviewedByName: r.last_reviewed_by_name,
      labStatus: r.lab_status,
      reviews: [...r.screening_reviews]
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
        .map((v) => ({
          id: v.id,
          decision: v.decision,
          correctedLabel: v.corrected_label,
          note: v.note,
          reviewerName: v.reviewer_name,
          reviewerRole: v.reviewer_role,
          modelVersion: v.model_version,
          at: formatTimestamp(v.created_at),
        })),
      labResults: [...r.screening_lab_results]
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
        .map((l) => ({
          id: l.id,
          result: l.lab_result,
          reference: l.lab_reference,
          sampleDate: l.sample_date ? shortDateFmt.format(new Date(`${l.sample_date}T12:00:00Z`)) : null,
          note: l.note,
          recorderName: l.recorder_name,
          at: formatTimestamp(l.created_at),
        })),
      allowedDecisions,
      blockedReason,
      canRecordLab,
    };
  });
  return { cases, error: false };
}

export interface AwaitingReview {
  total: number;
  high: number;
  escalated: number;
  top: { id: number; code: string; block: string; submittedAt: string; result: ScreeningResult; escalated: boolean }[];
}

/** Dashboard: open cases (pending or escalated) and the top few by case-review priority. Null on error. */
export async function getAwaitingReview(supabase: SupabaseClient, topCount = 4): Promise<AwaitingReview | null> {
  const open = () =>
    supabase.from("screenings").select("id", { count: "exact", head: true }).in("review_status", ["pending", "escalated"]);
  const [total, high, escalated, top] = await Promise.all([
    open(),
    open().eq("ai_priority", "high"),
    supabase.from("screenings").select("id", { count: "exact", head: true }).eq("review_status", "escalated"),
    supabase
      .from("screenings")
      .select(SCREENING_COLUMNS)
      .in("review_status", ["pending", "escalated"])
      .order("priority_rank", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(topCount),
  ]);
  if (total.error || high.error || escalated.error || top.error) return null;
  return {
    total: total.count ?? 0,
    high: high.count ?? 0,
    escalated: escalated.count ?? 0,
    top: (top.data as unknown as ScreeningRow[]).map((r) => ({
      id: r.id,
      code: screeningCode(r.id),
      block: r.block,
      submittedAt: formatTimestamp(r.created_at),
      result: toResult(r),
      escalated: r.review_status === "escalated",
    })),
  };
}

export interface ModelGovernance {
  activeVersion: string | null;
  isMock: boolean;
  deployedAt: string | null;
  abstentionThreshold: number | null;
  screenings: number;
  /** Share of this version's screenings where the system abstained; null when there are none. */
  abstentionRate: number | null;
}

/** Dashboard governance card (Admin). Null on error. */
export async function getModelGovernance(supabase: SupabaseClient): Promise<ModelGovernance | null> {
  const { data: version, error } = await supabase
    .from("model_versions")
    .select("id, is_mock, deployed_at, abstention_threshold")
    .eq("is_active", true)
    .maybeSingle();
  if (error) return null;
  if (!version) {
    return { activeVersion: null, isMock: false, deployedAt: null, abstentionThreshold: null, screenings: 0, abstentionRate: null };
  }
  const count = () =>
    supabase.from("screenings").select("id", { count: "exact", head: true }).eq("model_version", version.id);
  const [all, abstained] = await Promise.all([count(), count().eq("ai_status", "abstained")]);
  if (all.error || abstained.error) return null;
  const total = all.count ?? 0;
  return {
    activeVersion: version.id,
    isMock: version.is_mock,
    deployedAt: version.deployed_at ? formatTimestamp(version.deployed_at) : null,
    abstentionThreshold: Number(version.abstention_threshold),
    screenings: total,
    abstentionRate: total ? (abstained.count ?? 0) / total : null,
  };
}
