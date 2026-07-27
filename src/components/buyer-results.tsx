"use client";

import { useEffect, useState } from "react";

import { readCapabilityToken } from "../lib/browser/capability";
import {
  BrowserApiError,
  readEvaluation,
  type BuyerEvaluation,
} from "../lib/browser/evaluations";
import type { BuyerQuestionResult } from "../lib/supabase/evaluations";
import { StatusMessage } from "./status-message";
import {
  WorkflowProgress,
  type WorkflowStage,
} from "./workflow-progress";

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
      <ResultsState
        label="Buyer results"
        title="This private results link is unavailable."
        description="Ask the buyer who created the evaluation for a new link."
      >
        <StatusMessage tone="error">
          {error ?? "The evaluation could not be loaded."}
        </StatusMessage>
      </ResultsState>
    );
  }

  if (evaluation.status === "waiting_for_seller") {
    return (
      <ResultsState
        label="Buyer results"
        title={evaluation.title}
        description="Your questions are ready. Results will appear here after the seller submits a private sample."
        workflowStage="sample"
      >
        <div className="buyer-progress" aria-live="polite">
          <span />
          Waiting for the seller to submit a sample
        </div>
      </ResultsState>
    );
  }

  if (evaluation.status === "processing") {
    return (
      <ResultsState
        label="Buyer results"
        title="0G evaluation in progress"
        description="All questions are being evaluated together in one private request."
        workflowStage="results"
      >
        <div className="buyer-progress" aria-live="polite">
          <span />
          Running and verifying the 0G evaluation…
        </div>
      </ResultsState>
    );
  }

  if (evaluation.status === "failed") {
    return <FailedEvaluation evaluation={evaluation} />;
  }

  if (!evaluation.verifiedComplete || !evaluation.results) {
    return (
      <ResultsState
        label="Buyer results"
        title="Evaluation failed. No scores were produced."
        description="CipherQuery found no complete, verified 0G result set to display."
        workflowStage="results"
      >
        <StatusMessage tone="error">
          No partial or previous scores were published.
        </StatusMessage>
      </ResultsState>
    );
  }

  return (
    <CompletedResults
      evaluation={evaluation}
      results={evaluation.results}
    />
  );
}

function FailedEvaluation({
  evaluation,
}: {
  evaluation: BuyerEvaluation;
}) {
  return (
    <ResultsState
      label="Buyer results"
      title="Evaluation failed. No scores were produced."
      description={failureMessage(evaluation.errorCode)}
      workflowStage="results"
    >
      <StatusMessage tone="error">
        {evaluation.failure.requestMade
          ? "A private 0G request was made, but no complete verified result was published."
          : "The evaluation stopped before a private 0G request was made."}
      </StatusMessage>
    </ResultsState>
  );
}

function CompletedResults({
  evaluation,
  results,
}: {
  evaluation: BuyerEvaluation;
  results: BuyerQuestionResult[];
}) {
  const resultByQuestion = new Map(
    results.map((result) => [result.questionId, result]),
  );
  const scoredResults = results.filter(
    (result) => result.status === "scored",
  );
  const noScores = scoredResults.length === 0;
  const request = evaluation.inferenceDiagnostics.requests[0];
  const technicalDetails = [
    ["Model", request?.model],
    ["Provider", request?.provider],
    ["Request ID", request?.requestId],
    ["Reported tokens", reportedTokens(evaluation)],
    ["Reported cost", reportedCost(evaluation)],
  ].filter(
    (item): item is [string, string] =>
      typeof item[1] === "string" && item[1].length > 0,
  );

  return (
    <main className="buyer-results-page">
      <header className="buyer-results-header">
        <p className="role-kicker">Private buyer results</p>
        <h1 className="role-title">
          {noScores
            ? "No scores were produced"
            : "Verified answers"}
        </h1>
        <p className="buyer-results-title">{evaluation.title}</p>
        <p className="role-description">
          {noScores
            ? "0G could not safely score these questions from the submitted sample. This does not mean the dataset failed your requirements."
            : "All questions were evaluated by 0G. Each score answers only its own question. There is no overall dataset score."}
        </p>
        <WorkflowProgress current="results" />
      </header>

      {!noScores ? (
        <section className="score-legend" aria-label="How to read the scores">
          <strong>How to read the scores</strong>
          <span><b>0</b> requirement not met</span>
          <span><b>100</b> requirement fully met</span>
          <span>Confidence is shown separately.</span>
        </section>
      ) : null}

      <section className="buyer-score-list" aria-label="Question results">
        {evaluation.questions.map((question, index) => (
          <ResultCard
            key={question.id}
            index={index}
            question={question.question}
            result={
              resultByQuestion.get(question.id) as BuyerQuestionResult
            }
          />
        ))}
      </section>

      <section className="verification-summary" aria-label="0G verification">
        <span className="verification-mark">✓</span>
        <div>
          <strong>Private execution verified</strong>
          <small>
            One complete 0G request passed TEE verification. This confirms the
            protected execution path, not the accuracy of every judgment.
          </small>
        </div>
      </section>

      <aside className="sample-limitation">
        <strong>About these results</strong>
        <p>
          They describe only the private sample the seller submitted. They do
          not prove that the seller’s complete dataset has the same quality.
        </p>
      </aside>

      {technicalDetails.length > 0 ? (
        <details className="buyer-technical-details">
          <summary>Technical verification details</summary>
          <dl>
            {technicalDetails.map(([label, value]) => (
              <TraceItem key={label} label={label} value={value} />
            ))}
          </dl>
        </details>
      ) : null}
    </main>
  );
}

function ResultCard({
  index,
  question,
  result,
}: {
  index: number;
  question: string;
  result: BuyerQuestionResult;
}) {
  return (
    <article className="buyer-result-card">
      <header>
        <div>
          <p className="result-provenance">
            Question {index + 1} / Evaluated by 0G
          </p>
          <h2>{question}</h2>
        </div>
        {result.status === "scored" ? (
          <div className="score-value" aria-label={`${result.score} out of 100`}>
            <span>{result.score}</span>
            <small>/100</small>
          </div>
        ) : (
          <div className="unable-value">
            Unable
            <small>No score</small>
          </div>
        )}
      </header>

      <p className="result-explanation">{result.explanation}</p>

      <div className="result-meta">
        {result.status === "scored" ? (
          <span>Confidence {result.confidence}%</span>
        ) : (
          <span>
            0G could not answer this question safely from the sample.
          </span>
        )}
      </div>
    </article>
  );
}

function ResultsState({
  children,
    description,
    label,
    title,
    workflowStage,
}: {
  children: React.ReactNode;
  description: string;
  label: string;
  title: string;
  workflowStage?: WorkflowStage;
}) {
  return (
    <section className="role-state">
      <p className="role-kicker">{label.toUpperCase()}</p>
      <h1 className="role-title">{title}</h1>
      <p className="role-description">{description}</p>
      {workflowStage ? (
        <WorkflowProgress current={workflowStage} />
      ) : null}
      <div className="role-state__content">{children}</div>
    </section>
  );
}

function ResultsLoading() {
  return (
    <section
      className="loading-shell role-state"
      aria-label="Loading buyer results"
    >
      <div className="skeleton-line skeleton-line--short" />
      <div className="skeleton-line" />
      <div className="skeleton-block" />
    </section>
  );
}

function TraceItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function reportedTokens(evaluation: BuyerEvaluation) {
  const counts = evaluation.inferenceDiagnostics.requests
    .map((request) => request.usage.totalTokens)
    .filter((value): value is number => value !== null);

  return counts.length > 0
    ? String(counts.reduce((sum, value) => sum + value, 0))
    : null;
}

function reportedCost(evaluation: BuyerEvaluation) {
  const costs = evaluation.inferenceDiagnostics.requests
    .map((request) => request.billing.totalCostNeuron)
    .filter((value): value is string => value !== null);

  if (costs.length === 0) {
    return null;
  }

  return `${costs.reduce(
    (sum, value) => sum + BigInt(value),
    BigInt(0),
  )} neuron`;
}

function errorMessage(caught: unknown) {
  return caught instanceof BrowserApiError
    ? caught.message
    : "CipherQuery could not load this evaluation.";
}

function failureMessage(errorCode: string | null) {
  switch (errorCode) {
    case "tee_verification_failed":
      return "The private execution could not be verified.";
    case "zero_g_authentication_failed":
      return "0G rejected the service credential.";
    case "zero_g_invalid_response":
      return "0G returned a response that did not pass validation.";
    case "service_misconfigured":
      return "The private evaluation service is not configured correctly.";
    case "zero_g_unavailable":
      return "0G did not complete the evaluation request.";
    case "result_persistence_failed":
      return "The verified result set could not be published safely.";
    default:
      return "The evaluation stopped before a complete verified result was available.";
  }
}
