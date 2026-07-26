"use client";

import { useEffect, useState } from "react";

import { readCapabilityToken } from "../lib/browser/capability";
import {
  BrowserApiError,
  readEvaluation,
  type BuyerEvaluation,
} from "../lib/browser/evaluations";
import type { GeneratedEvaluationPlan } from "../lib/evaluation-plans/types";
import { completedResultPresentation } from "../lib/results/presentation";
import {
  type EvaluationResult,
  unableReasonExplanation,
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
          has not submitted records yet. BlindSample will create fresh plans
          only after reading the submitted CSV.
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
        command="evaluation watch --private"
        title={evaluation.title}
      >
        <p className="terminal-copy">
          BlindSample is matching each question to the submitted headers,
          validating a fresh plan, and running exact calculations or private
          record-level judgments as needed.
        </p>
        <StatusMessage>
          Unstable or insufficient evidence resolves to unable to score.
        </StatusMessage>
      </ResultIntro>
    );
  }

  if (evaluation.status === "failed") {
    return (
      <ResultIntro
        status="FAILED SAFE"
        command="evaluation inspect --failure"
        title="No results were published"
      >
        <p className="terminal-copy">
          The protected evaluation did not complete. The seller may retry
          with the same capability.
        </p>
        <StatusMessage tone="error">
          {failureMessage(evaluation.errorCode)}
        </StatusMessage>
        <p className="terminal-copy">
          Recorded 0G attempts:{" "}
          {evaluation.inferenceDiagnostics.requestCount.made}.
        </p>
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
  const resultByQuestion = new Map(
    evaluation.results?.map((result) => [result.questionId, result]),
  );
  const resultsAreComplete =
    resultByQuestion.size === evaluation.questions.length &&
    evaluation.questions.every((question) =>
      resultByQuestion.has(question.id),
    );

  if (
    !evaluation.results ||
    !evaluation.plans ||
    !resultsAreComplete
  ) {
    return (
      <StatusMessage tone="error">
        The stored result set is incomplete and cannot be displayed.
      </StatusMessage>
    );
  }

  const inferenceDiagnostics = evaluation.inferenceDiagnostics;
  const presentation = completedResultPresentation(
    evaluation.results,
  );
  const { allUnable } = presentation;
  const planByQuestion = new Map(
    evaluation.plans.map((plan) => [plan.questionId, plan]),
  );
  const aiRequestMade =
    inferenceDiagnostics.requestCount.made > 0;
  const finishReasons = [
    ...new Set(
      inferenceDiagnostics.requests
        .map((request) => request.finishReason)
        .filter((reason): reason is string => reason !== null),
    ),
  ];

  return (
    <section className="terminal-window">
      <TerminalBar
        path="~/blindsample/results"
        status={presentation.status}
      />
      <div className="terminal-body">
        <CommandLine>
          results read --questions {evaluation.questions.length}
        </CommandLine>
        <div className="results-header">
          <div>
            <p
              className={
                allUnable ? "terminal-copy" : "terminal-success"
              }
            >
              {presentation.headline}
            </p>
            <h1 className="terminal-title">{evaluation.title}</h1>
            <p className="terminal-copy">
              {allUnable
                ? "The explanations below describe why BlindSample could not safely answer the questions. They do not mean the dataset failed."
                : `No overall score is calculated. Every result applies only to the ${evaluation.sampleRowCount ?? 0} submitted records.`}
            </p>
            <p className="terminal-copy">
              AI request made: {aiRequestMade ? "yes" : "no"}.
            </p>
          </div>
          <span className="verification-badge">
            {presentation.badge}
          </span>
        </div>

        <div className="score-list">
          {evaluation.questions.map((question, index) => {
            const result = resultByQuestion.get(
              question.id,
            ) as EvaluationResult;
            const plan = planByQuestion.get(question.id);

            return (
              <ResultRecord
                key={question.id}
                index={index}
                plan={plan}
                question={question.question}
                result={result}
              />
            );
          })}
        </div>

        <details className="verification-trace">
          <summary>How this evaluation was verified</summary>
          <p className="verification-copy">
            TEE verification proves protected execution for the listed 0G
            requests. It does not prove judgment accuracy. BlindSample stores
            the generated plan with the result and calculates final scores in
            application code.
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
            <TraceItem
              label="AI request made"
              value={aiRequestMade ? "yes" : "no"}
            />
            <TraceItem
              label="0G attempts"
              value={`${inferenceDiagnostics.requestCount.made}/${inferenceDiagnostics.requestCount.maximum}`}
            />
            <TraceItem
              label="router finish"
              value={
                finishReasons.length > 0
                  ? finishReasons.join(", ")
                  : "not reported"
              }
            />
            <TraceItem
              label="reported tokens"
              value={reportedTokens(inferenceDiagnostics)}
            />
            <TraceItem
              label="reported cost"
              value={reportedCost(inferenceDiagnostics)}
            />
            <TraceItem
              label="overall score"
              value="not calculated"
            />
          </dl>
        </details>
      </div>
    </section>
  );
}

function ResultRecord({
  index,
  plan,
  question,
  result,
}: {
  index: number;
  plan: GeneratedEvaluationPlan | undefined;
  question: string;
  result: EvaluationResult;
}) {
  return (
    <article className="score-row result-record">
      <header>
        <div>
          <p className="question-index">
            result[{String(index).padStart(2, "0")}] ·{" "}
            {result.evidence.method}
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

      {result.status === "unable_to_score" ? (
        <p className="terminal-copy">
          {unableReasonExplanation(result.reason)}
        </p>
      ) : null}

      <details className="result-audit">
        <summary>View audit evidence</summary>
        <dl className="result-evidence-grid">
          <TraceItem
            label="records"
            value={`${result.evidence.recordsEvaluated}/${result.evidence.recordsSubmitted}`}
          />
          <TraceItem
            label="coverage"
            value={`${Math.round(result.evidence.coverageRatio * 100)}%`}
          />
          <TraceItem
            label="plan"
            value={plan?.planVersion ?? result.evidence.contractVersion}
          />
          <TraceItem
            label="confidence"
            value={
              plan ? `${Math.round(plan.confidence * 100)}%` : "not stored"
            }
          />
          <TraceItem
            label="relevant fields"
            value={
              plan?.relevantColumns.length
                ? plan.relevantColumns.join(", ")
                : "none"
            }
          />
          <TraceItem
            label="controls"
            value={result.evidence.controlCheck}
          />
          <TraceItem
            label="agreement"
            value={
              result.evidence.agreement.ratio === null
                ? "n/a"
                : `${Math.round(result.evidence.agreement.ratio * 100)}%`
            }
          />
          <TraceItem
            label="measurement"
            value={
              result.evidence.measurement
                ? `${result.evidence.measurement.value} ${result.evidence.measurement.unit.replace("_", " ")}`
                : "not published"
              }
          />
          {result.evidence.semanticFailure ? (
            <TraceItem
              label="semantic failure"
              value={`${result.evidence.semanticFailure.pass} · ${result.evidence.semanticFailure.kind.replaceAll("_", " ")}`}
            />
          ) : null}
        </dl>

        {result.evidence.zeroG ? (
          <div className="zero-g-requests">
            <p>
              0G private trace · {result.evidence.zeroG.requests.length}{" "}
              verified request
              {result.evidence.zeroG.requests.length === 1 ? "" : "s"}
            </p>
            <dl>
              {result.evidence.zeroG.requests.map(
                (request, requestIndex) => (
                  <div key={request.requestId}>
                    <dt>request[{requestIndex}]</dt>
                    <dd>
                      {request.model} · {request.provider} ·{" "}
                      {request.requestId}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </div>
        ) : (
          <p className="local-method-note">
            No 0G call was needed for this deterministic or preflight-unable
            result.
          </p>
        )}

        <p className="result-limitation">
          {result.evidence.limitation}
        </p>
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
      return "0G verification did not pass. No semantic result was published.";
    case "service_misconfigured":
    case "zero_g_unavailable":
      return "Private 0G inference is temporarily unavailable.";
    case "result_persistence_failed":
      return "The result set could not be stored atomically.";
    default:
      return "The evaluation stopped without publishing a partial result.";
  }
}
