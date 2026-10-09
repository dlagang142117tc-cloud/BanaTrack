/**
 * Option lists for the Incident Log. These are PLACEHOLDERS until the
 * plantation provides its real block list, symptom list and severity scale —
 * edit them here. The database stores the values as plain text and the server
 * validates against these lists, so no migration is needed to change them.
 * Existing incidents keep whatever value they were saved with.
 */

// Placeholder block grid A1–D6 (also used by the Plantation Map preview).
export const blockRows = ["A", "B", "C", "D"];
export const blockCols = [1, 2, 3, 4, 5, 6];
export const BLOCKS = blockRows.flatMap((r) => blockCols.map((c) => `${r}${c}`));

export const SYMPTOMS = [
  "Leaf yellowing",
  "Leaf wilting / collapse",
  "Pseudostem splitting",
  "Vascular discoloration",
  "Bacterial ooze",
  "Fruit rot / discoloration",
  "Stunted growth",
];

/**
 * Chosen instead of any symptom when the plant was checked and nothing was
 * seen. It can't be combined with the symptoms above. Stored like a symptom.
 */
export const NO_VISIBLE_SYMPTOMS = "No visible symptoms";

/** The symptom rule shared by the forms and the server: null when the list is fine. */
export function symptomsProblem(symptoms: string[]): string | null {
  if (!symptoms.length) return `Choose at least one symptom, or "${NO_VISIBLE_SYMPTOMS}".`;
  if (symptoms.includes(NO_VISIBLE_SYMPTOMS) && symptoms.length > 1) {
    return `"${NO_VISIBLE_SYMPTOMS}" can't be combined with other symptoms.`;
  }
  return null;
}

/** Observed severity, lowest first. `value` is what gets stored. */
export const SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];
export const DEFAULT_SEVERITY = "moderate";

export const SUSPECTED_DISEASES = [
  { value: "Unconfirmed", label: "Unconfirmed" },
  { value: "Moko", label: "Moko (bacterial wilt)" },
  { value: "Panama", label: "Panama (Fusarium wilt)" },
];

export const ACTIONS = [
  "Tagged for monitoring",
  "Plant eradicated",
  "Area quarantined",
  "Tools disinfected",
  "Sample sent to lab",
  "No action yet",
];

/**
 * Follow-up status of an incident. Unlike the lists above, these values are
 * fixed by a check constraint in 005_incident_status_and_weather.sql — change
 * both together. New incidents start as "open".
 */
export const STATUSES = [
  { value: "open", label: "Open" },
  { value: "monitoring", label: "Monitoring" },
  { value: "resolved", label: "Resolved" },
];

export const MAX_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // keep in sync with the bucket limit in 004_incident_log.sql
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const PHOTO_BUCKET = "incident-photos";
export const MAX_NOTES_LENGTH = 2000;

/** "INC-0007" — the display form of an incident's numeric id. */
export function incidentCode(id: number) {
  return `INC-${String(id).padStart(4, "0")}`;
}
