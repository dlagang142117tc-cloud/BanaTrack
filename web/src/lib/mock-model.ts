import type { ScreeningResult } from "./screening-options";

/**
 * MOCK MODEL — no image analysis. Stands in for the FastAPI inference service
 * until a real model exists. The server action picks one of these at random;
 * the screening page also uses them for its "Preview only" buttons.
 *
 * Evidence is deliberately neutral: it makes no claims about the photo, the
 * block, the weather or past incidents, because none of that is analyzed.
 * The only real evidence is the submitter's own field observations.
 */
export const MOCK_MODEL_VERSION = "fusion-v0.0-mock";

const MOCK_IMAGE_EVIDENCE = {
  source: "Image",
  detail: "Mock model — photo not analyzed",
  weight: "weak",
} as const;

const TEMPLATES = {
  moko: {
    status: "result",
    label: "Moko-like wilt pattern",
    confidence: 0.87,
    severityPct: 34,
    severity: "moderate",
    priority: "high",
    abstainReason: null,
  },
  panama: {
    status: "result",
    label: "Panama-like (Fusarium) wilt pattern",
    confidence: 0.74,
    severityPct: 21,
    severity: "low",
    priority: "medium",
    abstainReason: null,
  },
  inconclusive: {
    status: "abstained",
    label: "Inconclusive",
    confidence: 0.41,
    severityPct: null,
    severity: null,
    // Abstained cases always need a human, so they go to the top of the queue.
    priority: "high",
    abstainReason:
      "Calibrated confidence (41%) is below the 60% abstention threshold, so the system abstained. Mock model: the photo was not analyzed.",
  },
} as const satisfies Record<string, Omit<ScreeningResult, "evidence">>;

export type MockKind = keyof typeof TEMPLATES;
export const MOCK_KINDS = Object.keys(TEMPLATES) as MockKind[];

export function buildMockResult(kind: MockKind, observations: string): ScreeningResult {
  const obs = observations.trim();
  return {
    ...TEMPLATES[kind],
    evidence: [
      MOCK_IMAGE_EVIDENCE,
      ...(obs ? [{ source: "Field observation" as const, detail: obs, weight: "weak" as const }] : []),
    ],
  };
}

export function randomMockResult(observations: string): ScreeningResult {
  return buildMockResult(MOCK_KINDS[Math.floor(Math.random() * MOCK_KINDS.length)], observations);
}
