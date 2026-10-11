import type { Priority, Severity } from "./mock-data";

// Value lists for Disease Screening and the Review Queue. The database stores
// these as plain text and the server validates against these lists
// (supabase/migrations/007_screening_review_queue.sql), so they can change
// without a migration. Status values with CHECK constraints are marked.

export const SCREENING_BUCKET = "screening-photos";
export const MAX_OBSERVATIONS_LENGTH = 2000; // matches the CHECK in 007
export const MAX_NOTE_LENGTH = 2000; // matches the CHECK in 007
export const MAX_LAB_REFERENCE_LENGTH = 200; // matches the CHECK in 007

export const PLANT_PARTS = [
  { value: "leaf", label: "Leaf" },
  { value: "pseudostem", label: "Pseudostem" },
  { value: "bunch", label: "Bunch / fruit" },
  { value: "whole_plant", label: "Whole plant" },
] as const;

export type PlantPart = (typeof PLANT_PARTS)[number]["value"];

/** Labels a reviewer can correct a screening result to. */
export const CORRECTION_LABELS = [
  "Moko-like wilt pattern",
  "Panama-like (Fusarium) wilt pattern",
  "Other disorder (not Moko/Panama)",
  "No disease pattern",
] as const;

// CHECK constraint in 007.
export const LAB_RESULTS = [
  { value: "moko", label: "Moko (Ralstonia) detected" },
  { value: "panama", label: "Panama (Fusarium) detected" },
  { value: "negative", label: "Negative for Moko and Panama" },
  { value: "inconclusive", label: "Lab result inconclusive" },
] as const;

export type LabResult = (typeof LAB_RESULTS)[number]["value"];
export type LabStatus = LabResult | "none";

// CHECK constraints in 007.
export type ReviewDecision = "confirmed" | "corrected" | "rejected" | "escalated";
export type ReviewStatus = "pending" | ReviewDecision;
export type AiStatus = "result" | "abstained";
export type AiPriority = "high" | "medium" | "low";

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending review",
  confirmed: "Confirmed by reviewer",
  corrected: "Corrected by reviewer",
  rejected: "Rejected by reviewer",
  escalated: "Escalated — Supervisor decision needed",
};

export const DECISION_LABELS: Record<ReviewDecision, string> = {
  confirmed: "Confirmed",
  corrected: "Corrected",
  rejected: "Rejected",
  escalated: "Escalated",
};

export const PRIORITY_LABELS: Record<AiPriority, Priority> = { high: "High", medium: "Medium", low: "Low" };

export interface EvidenceItem {
  source: "Image" | "Weather" | "Field observation" | "Incident history";
  detail: string;
  weight: "strong" | "moderate" | "weak";
}

/** A screening result (AI output), as stored in the ai_* columns. */
export interface ScreeningResult {
  status: AiStatus;
  label: string;
  /** Calibrated confidence, 0–1. */
  confidence: number;
  /** Severity estimate: % of visible tissue affected. Null when abstained. */
  severityPct: number | null;
  severity: Exclude<Severity, "none"> | null;
  priority: AiPriority;
  evidence: EvidenceItem[];
  abstainReason: string | null;
}

/** "SCR-0007" — the display form of a screening's numeric id. */
export function screeningCode(id: number) {
  return `SCR-${String(id).padStart(4, "0")}`;
}

export function plantPartLabel(value: string) {
  return PLANT_PARTS.find((p) => p.value === value)?.label ?? value;
}

export function labResultLabel(value: string) {
  return LAB_RESULTS.find((r) => r.value === value)?.label ?? value;
}
