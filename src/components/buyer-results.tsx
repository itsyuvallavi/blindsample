"use client";

import { useEffect, useState } from "react";

import { readCapabilityToken } from "../lib/browser/capability";
import {
  BrowserApiError,
  readEvaluation,
  type BuyerEvaluation,
} from "../lib/browser/evaluations";
import {
  isAtomicVerifiedResultSet,
  type EvaluationResult,
} from "../lib/scoring/types";
import {
  CommandLine,
  TerminalBar,
} from "./evaluation-builder";
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
          setError("This buyer capability is invalid or incomplete.");
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
          setError("This capability does not grant buyer access.");
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
        status="DENIED"
        command="capability inspect --role buyer"
        title="Buyer capability unavailable"
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
        status="WAITING"
        command="evaluation watch --seller-submission"
        title={evaluation.title}
      >
        <p className="terminal-copy">
          {evaluation.questions.length} plain-language question
          {evaluation.questions.length === 1 ? "" : "s"} ready. The seller
          has not submitted records yet.
        </p>
        <StatusMessage>
          Share only the separate seller capability URL.
        </StatusMessage>
      </ResultIntro>
    );
  }

  if (evaluation.status === "processing") {
    return (
      <ResultIntro
        status="RUNNING"
        command="evaluation watch --0g"
        title={evaluation.title}
      >
        <StatusMessage>0G evaluation in progress.</StatusMessage>
        <p className="terminal-copy">
          The sample and all buyer questions are being evaluated together in
          one private, TEE-verified request.
        </p>
      </ResultIntro>
    );
  }

  if (evaluation.status === "failed") {
    return <FailedEvaluation evaluation={evaluation} />;
  }

  if (
    !isAtomicVerifiedResultSet(
      evaluation.questions,
      evaluation.results,
      evaluation.inferenceDiagnostics,
    )
  ) {
    return (
      <ResultIntro
        status="FAILED SAFE"
        command="evaluation inspect --invalid-result"
        title="Evaluation failed — no scores were produced."
      >
        <StatusMessage tone="error">
          The stored result is not a complete verified 0G evaluation, so
          BlindSample will not display it.
        </StatusMessage>
      </ResultIntro>
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
    <ResultIntro
      status="FAILED SAFE"
      command="evaluation inspect --failure"
      title="Evaluation failed — no scores were produced."
    >
      <StatusMessage tone="error">
        {failureMessage(evaluation.errorCode)}
      </StatusMessage>
      <p className="terminal-copy">
        Recorded 0G requests:{" "}
        {evaluation.inferenceDiagnostics.requestCount.made}. No local,
        partial, or previous score was published.
      </p>
    </ResultIntro>
  );
}

function CompletedResults({
  evaluation,
  results,
}: {
  evaluation: BuyerEvaluation;
  results: EvaluationResult[];
}) {
  const resultByQuestion = new Map(
    results.map((result) => [result.questionId, result]),
  );
  const request = evaluation.inferenceDiagnostics.requests[0];

  return (
    <section className="terminal-window">
      <TerminalBar path="~/blindsample/results" status="COMPLETE" />
      <div className="terminal-body">
        <CommandLine>
          results read --source 0g --questions{" "}
          {evaluation.questions.length}
        </CommandLine>
        <div className="results-header">
          <div>
            <p className="terminal-success">
              Evaluation complete — all questions evaluated by 0G.
            </p>
            <h1 className="terminal-title">{evaluation.title}</h1>
            <p className="terminal-copy">
              No overall dataset score is calculated. Each result applies
              only to its original question and the submitted sample.
            </p>
          </div>
          <span className="verification-badge">
            0G · TEE VERIFIED
          </span>
        </div>

        <div className="score-list">
          {evaluation.questions.map((question, index) => (
            <ResultRecord
              key={question.id}
              index={index}
              question={question.question}
              result={
                resultByQuestion.get(question.id) as EvaluationResult
              }
            />
          ))}
        </div>

        <details className="verification-trace">
          <summary>0G verification metadata</summary>
          <p className="verification-copy">
            TEE verification proves that the single response came from the
            requested protected 0G execution path. It does not by itself
            guarantee that a model judgment is correct.
          </p>
          <dl className="trace-grid">
            <TraceItem
              label="submitted records"
              value={String(evaluation.sampleRowCount ?? 0)}
            />
            <TraceItem
              label="submitted columns"
              value={String(evaluation.sampleColumnCount ?? 0)}
            />
            <TraceItem label="0G requests" value="1/1" />
            <TraceItem
              label="model"
              value={request.model ?? "not reported"}
            />
            <TraceItem
              label="provider"
              value={request.provider ?? "not reported"}
            />
            <TraceItem
              label="request ID"
              value={request.requestId ?? "not reported"}
            />
            <TraceItem
              label="reported tokens"
              value={reportedTokens(evaluation.inferenceDiagnostics)}
            />
            <TraceItem
              label="reported cost"
              value={reportedCost(evaluation.inferenceDiagnostics)}
            />
          </dl>
        </details>
      </div>
    </section>
  );
}

function ResultRecord({
  index,
  question,
  result,
}: {
  index: number;
  question: string;
  result: EvaluationResult;
}) {
  return (
    <article className="score-row result-record">
      <header>
        <div>
          <p className="question-index">
            result[{String(index).padStart(2, "0")}] · Evaluated by 0G
          </p>
          <h3 className="score-question">{question}</h3>
        </div>
        {result.status === "scored" ? (
          <div className="score-value">
            <span>{result.score}</span>
            <small>/100</small>
          </div>
        ) : (
          <div className="unable-value">
            unable
            <small>no score</small>
          </div>
        )}
      </header>

      <p className="terminal-copy">{result.explanation}</p>

      <details className="result-audit">
        <summary>View safe audit evidence</summary>
        <dl className="result-evidence-grid">
          <TraceItem
            label="evaluated by"
            value="0G · TEE verified"
          />
          <TraceItem
            label="basis"
            value={`${result.evaluationBasis.unit.replaceAll("_", " ")} · ${result.evaluationBasis.description}`}
          />
          <TraceItem
            label="confidence"
            value={`${result.confidence}%`}
          />
          <TraceItem
            label="arithmetic"
            value={
              result.numerator === null ||
              result.denominator === null
                ? "not applicable"
                : `${result.numerator}/${result.denominator}`
            }
          />
          <TraceItem
            label="0 means"
            value={result.scoreDefinition.zero}
          />
          <TraceItem
            label="100 means"
            value={result.scoreDefinition.oneHundred}
          />
          <TraceItem
            label="row evidence"
            value={
              result.evidence.rowNumbers.length > 0
                ? result.evidence.rowNumbers.join(", ")
                : "none"
            }
          />
          <TraceItem
            label="aggregate counts"
            value={
              result.evidence.aggregateCounts.length > 0
                ? result.evidence.aggregateCounts
                    .map((item) => `${item.label}: ${item.count}`)
                    .join("; ")
                : "none"
            }
          />
          <TraceItem
            label="sanitized reasons"
            value={
              result.evidence.reasons.length > 0
                ? result.evidence.reasons.join("; ")
                : "none"
            }
          />
        </dl>
      </details>
    </article>
  );
}

function reportedTokens(
  diagnostics: BuyerEvaluation["inferenceDiagnostics"],
) {
  const counts = diagnostics.requests
    .map((request) => request.usage.totalTokens)
    .filter((value): value is number => value !== null);

  return counts.length > 0
    ? String(counts.reduce((sum, value) => sum + value, 0))
    : "not reported";
}

function reportedCost(
  diagnostics: BuyerEvaluation["inferenceDiagnostics"],
) {
  const costs = diagnostics.requests
    .map((request) => request.billing.totalCostNeuron)
    .filter((value): value is string => value !== null);

  if (costs.length === 0) {
    return "not reported";
  }

  return `${costs.reduce(
    (sum, value) => sum + BigInt(value),
    BigInt(0),
  )} neuron`;
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
  command,
  status,
  title,
}: {
  children: React.ReactNode;
  command: string;
  status: string;
  title: string;
}) {
  return (
    <section className="terminal-window role-state">
      <TerminalBar path="~/blindsample/results" status={status} />
      <div className="terminal-body">
        <CommandLine>{command}</CommandLine>
        <h1 className="terminal-title">{title}</h1>
        <div className="role-state__content">{children}</div>
      </div>
    </section>
  );
}

function ResultsLoading() {
  return (
    <section
      className="terminal-window loading-shell"
      aria-label="Loading buyer results"
    >
      <TerminalBar path="~/blindsample/results" status="CONNECTING" />
      <div className="terminal-body">
        <CommandLine>capability authenticate --role buyer</CommandLine>
        <div className="skeleton-line skeleton-line--short" />
        <div className="skeleton-line" />
        <div className="skeleton-block" />
      </div>
    </section>
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
      return "0G TEE verification did not pass.";
    case "zero_g_authentication_failed":
      return "0G rejected the configured production credential.";
    case "zero_g_invalid_response":
      return "0G returned output that failed strict validation.";
    case "service_misconfigured":
      return "The production 0G configuration is incomplete.";
    case "zero_g_unavailable":
      return "0G did not complete the evaluation request.";
    case "result_persistence_failed":
      return "The verified result set could not be stored atomically.";
    default:
      return "The evaluation stopped before a complete verified 0G result was available.";
  }
}
