"use client";

import { useEffect, useState } from "react";

import { readCapabilityToken } from "../lib/browser/capability";
import {
  BrowserApiError,
  readEvaluation,
  type BuyerEvaluation,
} from "../lib/browser/evaluations";
import { StatusMessage } from "./status-message";

const POLL_INTERVAL_MS = 3_000;

export function BuyerResults({
  evaluationId,
}: {
  evaluationId: string;
}) {
  const [evaluation, setEvaluation] =
    useState<BuyerEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    async function poll() {
      await Promise.resolve();
      const token = readCapabilityToken(window.location.hash);

      if (!token) {
        if (active) {
          setError("This buyer link is invalid or incomplete.");
          setLoading(false);
        }
        return;
      }

      try {
        const response = await readEvaluation(evaluationId, token);

        if (!active) {
          return;
        }

        if (response.role !== "buyer") {
          setError("This link does not grant buyer access.");
          setLoading(false);
          return;
        }

        setEvaluation(response.evaluation);
        setError(null);
        setLoading(false);

        if (
          response.evaluation.status === "waiting_for_seller" ||
          response.evaluation.status === "processing"
        ) {
          timer = window.setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (caught) {
        if (active) {
          setError(errorMessage(caught));
          setLoading(false);
        }
      }
    }

    void poll();
    return () => {
      active = false;

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [evaluationId]);

  if (loading) {
    return <ResultsLoading />;
  }

  if (!evaluation) {
    return (
      <ResultIntro
        label="Buyer results"
        title="This private link is unavailable."
        description="Use the exact buyer link created for this evaluation."
      >
        <StatusMessage tone="error">
          {error ?? "The evaluation could not be loaded."}
        </StatusMessage>
      </ResultIntro>
    );
  }

  if (evaluation.status === "waiting_for_seller") {
    return (
      <ResultIntro
        label="Waiting for seller"
        title={evaluation.title}
        description="The seller has not sent the TLS-encrypted CSV sample yet. This secured buyer view checks again every three seconds."
      >
        <StatusMessage>
          Share the separate seller link created with this evaluation.
        </StatusMessage>
      </ResultIntro>
    );
  }

  if (evaluation.status === "processing") {
    return (
      <ResultIntro
        label="Private scoring"
        title={evaluation.title}
        description="0G private compute is scoring each question inside TEE-verified execution. This secured view updates automatically."
      >
        <StatusMessage>
          Scores stay sealed until 0G reports verified TEE execution.
        </StatusMessage>
      </ResultIntro>
    );
  }

  if (evaluation.status === "failed") {
    return (
      <ResultIntro
        label="Safe failure"
        title="No result was published."
        description="Private scoring did not complete, so BlindSample stored no scores. The seller can retry with the same link."
      >
        <StatusMessage tone="error">
          {failureMessage(evaluation.errorCode)}
        </StatusMessage>
      </ResultIntro>
    );
  }

  return <CompletedResults evaluation={evaluation} />;
}

function CompletedResults({
  evaluation,
}: {
  evaluation: BuyerEvaluation;
}) {
  const scoreByQuestion = new Map(
    evaluation.scores?.map((score) => [score.questionId, score.score]),
  );
  const scoresAreComplete =
    scoreByQuestion.size === evaluation.questions.length &&
    evaluation.questions.every((question) => {
      const score = scoreByQuestion.get(question.id);
      return (
        Number.isInteger(score) &&
        Number(score) >= 1 &&
        Number(score) <= 100
      );
    });

  if (!evaluation.trace || !evaluation.scores || !scoresAreComplete) {
    return (
      <StatusMessage tone="error">
        This result is incomplete and cannot be displayed.
      </StatusMessage>
    );
  }

  return (
    <div>
      <div className="results-header">
        <div>
          <p className="role-kicker">VERIFIED RESULTS</p>
          <h1 className="role-title">{evaluation.title}</h1>
          <p className="role-description">
            One secured, independent score for each buyer question. No raw
            sample rows were published.
          </p>
        </div>
        <span className="verification-badge">
          0G TEE VERIFIED
        </span>
      </div>

      <section aria-labelledby="scores-title">
        <h2 id="scores-title" className="sr-only">
          Question scores
        </h2>
        <div className="score-list">
          {evaluation.questions.map((question, index) => {
            const score = scoreByQuestion.get(question.id);

            return (
              <article key={question.id} className="score-row">
                <div>
                  <p className="question-index">
                    Question {index + 1}
                  </p>
                  <h3 className="score-question">
                    {question.text}
                  </h3>
                </div>
                <div className="score-value">
                  <span>{score}</span>
                  <small>/100</small>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="verification-trace"
        aria-labelledby="verification-title"
      >
        <h2 id="verification-title">
          Verification trace
        </h2>
        <p className="verification-copy">
          0G Router reported private, TEE-verified execution for this request.
          BlindSample stores this safe trace but does not independently
          reproduce the provider attestation.
        </p>
        <dl className="trace-grid">
          <TraceItem label="Model" value={evaluation.trace.model} />
          <TraceItem label="Provider" value={evaluation.trace.provider} />
          <TraceItem
            label="Request ID"
            value={evaluation.trace.requestId}
          />
          <TraceItem
            label="Sample shape"
            value={`${evaluation.sampleRowCount ?? 0} rows, ${
              evaluation.sampleColumnCount ?? 0
            } columns`}
          />
        </dl>
      </section>
    </div>
  );
}

function TraceItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="trace-label">{label}</dt>
      <dd className="trace-value">{value}</dd>
    </div>
  );
}

function ResultIntro({
  children,
  description,
  label,
  title,
}: {
  children: React.ReactNode;
  description: string;
  label: string;
  title: string;
}) {
  return (
    <section className="role-state">
      <p className="role-kicker">{label.toUpperCase()}</p>
      <h1 className="role-title">{title}</h1>
      <p className="role-description">{description}</p>
      <div className="role-state__content">{children}</div>
    </section>
  );
}

function ResultsLoading() {
  return (
    <div
      className="loading-shell"
      aria-label="Loading buyer results"
    >
      <div className="skeleton-line skeleton-line--short" />
      <div className="skeleton-line" />
      <div className="skeleton-block" />
      <div className="skeleton-block" />
    </div>
  );
}

function errorMessage(caught: unknown) {
  return caught instanceof BrowserApiError
    ? caught.message
    : "BlindSample could not load this evaluation.";
}

function failureMessage(errorCode: string | null) {
  switch (errorCode) {
    case "tee_verification_failed":
      return "0G verification did not pass. No scores were published.";
    case "invalid_model_output":
      return "The scoring result did not match the numeric-only contract.";
    case "service_misconfigured":
    case "zero_g_unavailable":
      return "Private inference is temporarily unavailable.";
    default:
      return "The evaluation stopped without publishing a result.";
  }
}
