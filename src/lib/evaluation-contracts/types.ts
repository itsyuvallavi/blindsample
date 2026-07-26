export const EVALUATION_CONTRACT_VERSION = "1.0.0" as const;

export const SCORE_ANCHOR_KEYS = ["1", "25", "50", "75", "100"] as const;

export type ScoreAnchorKey = (typeof SCORE_ANCHOR_KEYS)[number];

export type ScoreAnchors = Record<ScoreAnchorKey, string>;

export type CriterionKind =
  | "category_coverage"
  | "column_availability"
  | "completeness"
  | "date_freshness"
  | "format_validity"
  | "numeric_range"
  | "semantic_relevance"
  | "uniqueness";

type CriterionDraftBase = {
  id: string;
  question: string;
};

export type CriterionDraft =
  | (CriterionDraftBase & {
      columns: string[];
      kind: "completeness";
    })
  | (CriterionDraftBase & {
      column: string;
      format: "email" | "iso_date" | "number" | "url" | "uuid";
      kind: "format_validity";
    })
  | (CriterionDraftBase & {
      column: string;
      kind: "uniqueness";
    })
  | (CriterionDraftBase & {
      column: string;
      kind: "date_freshness";
      maximumAgeDays: number;
      referenceDate: string;
    })
  | (CriterionDraftBase & {
      column: string;
      kind: "numeric_range";
      maximum: number;
      minimum: number;
    })
  | (CriterionDraftBase & {
      columns: string[];
      kind: "column_availability";
    })
  | (CriterionDraftBase & {
      column: string;
      expectedValues: string[];
      kind: "category_coverage";
    })
  | (CriterionDraftBase & {
      columns: string[];
      controls: {
        intermediate: string;
        negative: string;
        positive: string;
      };
      kind: "semantic_relevance";
      target: string;
    });

export type EvaluationCriterion =
  | {
      columns: string[];
      kind: "completeness";
    }
  | {
      column: string;
      format: "email" | "iso_date" | "number" | "url" | "uuid";
      kind: "format_validity";
    }
  | {
      column: string;
      kind: "uniqueness";
    }
  | {
      column: string;
      kind: "date_freshness";
      maximumAgeDays: number;
      referenceDate: string;
    }
  | {
      column: string;
      kind: "numeric_range";
      maximum: number;
      minimum: number;
    }
  | {
      columns: string[];
      kind: "column_availability";
    }
  | {
      column: string;
      expectedValues: string[];
      kind: "category_coverage";
    }
  | {
      columns: string[];
      controls: {
        intermediate: string;
        negative: string;
        positive: string;
      };
      kind: "semantic_relevance";
      target: string;
    };

export type EvaluationContract = {
  aggregationMethod:
    | "server_mean_rubric_points"
    | "server_percentage_to_score";
  contractVersion: typeof EVALUATION_CONTRACT_VERSION;
  criterion: EvaluationCriterion;
  method: "deterministic" | "semantic";
  minimumEvidence: {
    coverageRatio: number;
    records: number;
  };
  normalizedCriterion: string;
  originalQuestion: string;
  populationRule: "all_submitted_records_no_sampling";
  questionId: string;
  requiredColumns: string[];
  requiredEvidence: string[];
  scoringAnchors: ScoreAnchors;
  unableToScoreConditions: string[];
};

export type EvaluationContractPreview = {
  contractSetHash: string;
  contracts: EvaluationContract[];
};
