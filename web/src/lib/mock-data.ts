/**
 * PLACEHOLDER DATA — for layout preview only.
 *
 * Everything in this file is invented. None of it comes from the plantation,
 * a trained model, or a weather service. Every UI section that reads from
 * here must display a <SampleTag />. Replace module-by-module as real
 * sources (Supabase tables, the FastAPI inference service) land. Weather is
 * already real — see lib/weather.ts.
 */

import { blockCols, blockRows } from "./incident-options";

export type Severity = "none" | "low" | "moderate" | "high";
export type Priority = "High" | "Medium" | "Low";
export type Disease = "Moko" | "Panama";
export type ReviewStatus = "pending" | "confirmed" | "corrected" | "rejected" | "escalated";
// ---------------------------------------------------------------- Blocks

export interface PlantationBlock {
  id: string;
  severity: Severity;
  activeIncidents: number;
  areaHa: number;
  lastInspected: string;
  dominant?: Disease;
  supervisor: string;
}

const blockSeverities: Record<string, Severity> = {
  A1: "none", A2: "low", A3: "none", A4: "none", A5: "low", A6: "none",
  B1: "low", B2: "moderate", B3: "high", B4: "moderate", B5: "none", B6: "none",
  C1: "none", C2: "moderate", C3: "high", C4: "low", C5: "none", C6: "low",
  D1: "none", D2: "none", D3: "low", D4: "none", D5: "moderate", D6: "none",
};

const supervisors = ["R. Villanueva", "M. Santos", "J. Dela Cruz", "A. Reyes"];

// The placeholder block grid lives with the Incident Log options; re-exported for the mock pages.
export { blockRows, blockCols };

export const plantationBlocks: PlantationBlock[] = Object.entries(blockSeverities).map(
  ([id, severity], i) => ({
    id,
    severity,
    activeIncidents: severity === "none" ? 0 : { low: 1, moderate: 3, high: 6 }[severity] + (i % 2),
    areaHa: 4 + ((i * 7) % 5) * 0.5,
    lastInspected: `Sep ${24 - (i % 9)}`,
    dominant: severity === "none" ? undefined : i % 3 === 0 ? "Panama" : "Moko",
    supervisor: supervisors[blockRows.indexOf(id[0])],
  }),
);

// ---------------------------------------------------------------- Incidents

export interface Incident {
  id: string;
  date: string;
  block: string;
  symptoms: string[];
  suspected: Disease | "Unconfirmed";
  severity: Exclude<Severity, "none">;
  personnel: string;
  action: string;
  notes: string;
}

export const incidents: Incident[] = [
  {
    id: "INC-0142", date: "2026-09-24", block: "B3",
    symptoms: ["Leaf wilting / collapse", "Vascular discoloration"],
    suspected: "Moko", severity: "high", personnel: "J. Dela Cruz",
    action: "Area quarantined", notes: "Cluster of 5 mats along the drainage canal.",
  },
  {
    id: "INC-0141", date: "2026-09-23", block: "C3",
    symptoms: ["Leaf yellowing", "Pseudostem splitting"],
    suspected: "Panama", severity: "high", personnel: "M. Santos",
    action: "Plant eradicated", notes: "Yellowing starts from older leaves.",
  },
  {
    id: "INC-0140", date: "2026-09-22", block: "C2",
    symptoms: ["Leaf yellowing"],
    suspected: "Unconfirmed", severity: "moderate", personnel: "A. Reyes",
    action: "Tagged for monitoring", notes: "Possible nutrient deficiency; revisit in 5 days.",
  },
  {
    id: "INC-0139", date: "2026-09-21", block: "B2",
    symptoms: ["Bacterial ooze", "Fruit rot / discoloration"],
    suspected: "Moko", severity: "moderate", personnel: "J. Dela Cruz",
    action: "Sample sent to lab", notes: "",
  },
  {
    id: "INC-0138", date: "2026-09-19", block: "D5",
    symptoms: ["Leaf wilting / collapse"],
    suspected: "Panama", severity: "moderate", personnel: "R. Villanueva",
    action: "Tools disinfected", notes: "Near block boundary with D6.",
  },
  {
    id: "INC-0137", date: "2026-09-17", block: "A2",
    symptoms: ["Stunted growth"],
    suspected: "Unconfirmed", severity: "low", personnel: "M. Santos",
    action: "Tagged for monitoring", notes: "",
  },
  {
    id: "INC-0136", date: "2026-09-15", block: "B4",
    symptoms: ["Leaf yellowing", "Vascular discoloration"],
    suspected: "Panama", severity: "moderate", personnel: "A. Reyes",
    action: "Plant eradicated", notes: "",
  },
];

export const incidentStats = [
  { label: "Open incidents", value: 23, delta: "+4 this week", tone: "warn" as const },
  { label: "Blocks affected", value: 12, delta: "of 24 blocks", tone: "neutral" as const },
  { label: "Awaiting review", value: 8, delta: "3 high priority", tone: "warn" as const },
  { label: "Resolved (30 days)", value: 17, delta: "+6 vs. last month", tone: "good" as const },
];

// ---------------------------------------------------------------- Screening

export interface EvidenceItem {
  source: "Image" | "Weather" | "Field observation" | "Incident history";
  detail: string;
  weight: "strong" | "moderate" | "weak";
}

export interface ScreeningResult {
  status: "result" | "abstained";
  label: string;
  confidence: number;
  severityPct: number;
  severity: Exclude<Severity, "none">;
  priority: Priority;
  modelVersion: string;
  evidence: EvidenceItem[];
  /** Fake localization box, as fractions of the image (x, y, w, h). */
  box?: [number, number, number, number];
  abstainReason?: string;
}

export const sampleScreeningResults: ScreeningResult[] = [
  {
    status: "result",
    label: "Moko-like wilt pattern",
    confidence: 0.87,
    severityPct: 34,
    severity: "moderate",
    priority: "High",
    modelVersion: "fusion-v0.0-mock",
    box: [0.22, 0.18, 0.46, 0.5],
    evidence: [
      { source: "Image", detail: "Yellowing and collapse concentrated on younger inner leaves", weight: "strong" },
      { source: "Weather", detail: "72 h of rainfall above 15 mm/day in the area", weight: "moderate" },
      { source: "Incident history", detail: "2 confirmed Moko incidents in the same block within 30 days", weight: "strong" },
      { source: "Field observation", detail: "Reporter noted bacterial ooze on cut pseudostem", weight: "moderate" },
    ],
  },
  {
    status: "result",
    label: "Panama-like (Fusarium) wilt pattern",
    confidence: 0.74,
    severityPct: 21,
    severity: "low",
    priority: "Medium",
    modelVersion: "fusion-v0.0-mock",
    box: [0.35, 0.3, 0.4, 0.45],
    evidence: [
      { source: "Image", detail: "Marginal yellowing progressing from older outer leaves", weight: "strong" },
      { source: "Field observation", detail: "Longitudinal splitting at pseudostem base", weight: "moderate" },
      { source: "Weather", detail: "Soil likely waterlogged after recent rains", weight: "weak" },
    ],
  },
];

export const sampleAbstainedResult: ScreeningResult = {
  status: "abstained",
  label: "Inconclusive",
  confidence: 0.41,
  severityPct: 0,
  severity: "low",
  priority: "Medium",
  modelVersion: "fusion-v0.0-mock",
  abstainReason:
    "Calibrated confidence (41%) is below the 60% abstention threshold, and the image appears motion-blurred. The case has been routed for human review.",
  evidence: [
    { source: "Image", detail: "Image quality check: blur score below acceptable limit", weight: "strong" },
    { source: "Image", detail: "Top two screening classes within 6 percentage points of each other", weight: "moderate" },
  ],
};

// ---------------------------------------------------------------- Review queue

export interface ReviewCase {
  id: string;
  submittedAt: string;
  block: string;
  submittedBy: string;
  label: string;
  confidence: number;
  severityPct: number;
  priority: Priority;
  modelVersion: string;
  evidence: EvidenceItem[];
  status: ReviewStatus;
}

export const reviewCases: ReviewCase[] = [
  {
    id: "CASE-2091", submittedAt: "Sep 25, 08:42", block: "B3", submittedBy: "J. Dela Cruz",
    label: "Moko-like wilt pattern", confidence: 0.89, severityPct: 41, priority: "High",
    modelVersion: "fusion-v0.0-mock", status: "pending",
    evidence: sampleScreeningResults[0].evidence,
  },
  {
    id: "CASE-2090", submittedAt: "Sep 25, 07:15", block: "C3", submittedBy: "M. Santos",
    label: "Panama-like (Fusarium) wilt pattern", confidence: 0.81, severityPct: 38, priority: "High",
    modelVersion: "fusion-v0.0-mock", status: "pending",
    evidence: sampleScreeningResults[1].evidence,
  },
  {
    id: "CASE-2088", submittedAt: "Sep 24, 16:03", block: "C2", submittedBy: "A. Reyes",
    label: "Inconclusive (abstained)", confidence: 0.44, severityPct: 0, priority: "High",
    modelVersion: "fusion-v0.0-mock", status: "pending",
    evidence: sampleAbstainedResult.evidence,
  },
  {
    id: "CASE-2085", submittedAt: "Sep 24, 10:27", block: "D5", submittedBy: "R. Villanueva",
    label: "Panama-like (Fusarium) wilt pattern", confidence: 0.68, severityPct: 18, priority: "Medium",
    modelVersion: "fusion-v0.0-mock", status: "pending",
    evidence: [
      { source: "Image", detail: "Yellowing on 2 outer leaves", weight: "moderate" },
      { source: "Incident history", detail: "1 Panama incident in adjacent block D6 (60 days)", weight: "weak" },
    ],
  },
  {
    id: "CASE-2081", submittedAt: "Sep 23, 14:50", block: "B2", submittedBy: "J. Dela Cruz",
    label: "Moko-like wilt pattern", confidence: 0.72, severityPct: 12, priority: "Medium",
    modelVersion: "fusion-v0.0-mock", status: "pending",
    evidence: [
      { source: "Image", detail: "Early discoloration on bunch", weight: "moderate" },
      { source: "Field observation", detail: "Reporter noted fruit rot on 1 hand", weight: "moderate" },
    ],
  },
  {
    id: "CASE-2077", submittedAt: "Sep 22, 09:12", block: "A5", submittedBy: "M. Santos",
    label: "No disease pattern detected", confidence: 0.83, severityPct: 3, priority: "Low",
    modelVersion: "fusion-v0.0-mock", status: "pending",
    evidence: [
      { source: "Image", detail: "Leaf tissue appears healthy; minor mechanical damage", weight: "strong" },
    ],
  },
];

// ---------------------------------------------------------------- Reports

export interface MonthlyCount {
  month: string;
  moko: number;
  panama: number;
  unconfirmed: number;
}

export const monthlyIncidents: MonthlyCount[] = [
  { month: "Apr", moko: 4, panama: 6, unconfirmed: 2 },
  { month: "May", moko: 6, panama: 5, unconfirmed: 3 },
  { month: "Jun", moko: 9, panama: 7, unconfirmed: 2 },
  { month: "Jul", moko: 11, panama: 8, unconfirmed: 4 },
  { month: "Aug", moko: 8, panama: 10, unconfirmed: 3 },
  { month: "Sep", moko: 13, panama: 9, unconfirmed: 5 },
];

export const modelGovernance = {
  activeVersion: "fusion-v0.0-mock",
  deployedOn: "Not deployed",
  abstentionRate: 0.12,
};
