export type ReviewStatus = "draft" | "approved" | "rejected";
export type LensId = "panorama" | "coref" | "causal" | "emotion" | "position";

export interface CoreferenceGroup {
  entity: string;
  members: number[];
  refersFrom: number[];
}

export interface CausalGroup {
  cause: number[];
  effect: number[];
  connective?: number;
}

export interface AlternativeReading {
  tokenIndices: number[];
  rationale: string;
}

export interface AttentionData {
  lenses: Record<LensId, number[]>;
  lensConfigId: string;
  modelVersion: string;
  probeSetHash: string;
  stability: number;
  crossModelAgreement: number;
  caseStrength: number;
}

export interface Level {
  schemaVersion: "1.0.0";
  id: string;
  level: number;
  template: string;
  tokens: string[];
  focus: number;
  punct: number[];
  coref: CoreferenceGroup[];
  causal: CausalGroup[];
  attention: AttentionData;
  scoring: {
    cap: number;
    bCumulative: number;
    maxTargets: number;
  };
  explain: {
    copyId: string;
    text: string;
  };
  humanRationale: string;
  alternatives?: AlternativeReading[];
  provenance: {
    source: "ai-assisted" | "human-authored";
    pipelineVersion: string;
  };
  review: {
    status: ReviewStatus;
    reviewer?: string;
    reviewedAt?: string;
    notes?: string;
  };
}

export interface LevelPackage {
  schemaVersion: "1.0.0";
  packageVersion: string;
  status: "draft" | "release";
  generatedAt: string;
  modelLockHash: string;
  levels: Level[];
}

export interface ValidationIssue {
  path: string;
  keyword: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationIssue[] };

export interface DailyVoteRequest {
  tokenIndices: number[];
}
