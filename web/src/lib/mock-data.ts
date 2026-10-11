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
