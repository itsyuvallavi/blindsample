"use client";

import { useEffect, useRef, useState } from "react";

import { readCapabilityToken } from "../lib/browser/capability";
import {
  BrowserApiError,
  readEvaluation,
  submitSample,
  type SellerEvaluation,
} from "../lib/browser/evaluations";
import { parseSample } from "../lib/samples/parse-sample";
import {
  SampleError,
  type SampleFormat,
} from "../lib/samples/types";
import { PRODUCT_LIMITS } from "../lib/product-contract";
import { StatusMessage } from "./status-message";
import {
  WorkflowProgress,
  type WorkflowStage,
} from "./workflow-progress";

type FilePreflight = {
  columnCount: number;
  columns: string[];
  file: File;
  format: SampleFormat;
  rowCount: number;
};

export function SellerSubmission({
  evaluationId,
}: {
  evaluationId: string;
}) {
  const tokenRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectionVersionRef = useRef(0);
  const [evaluation, setEvaluation] =
    useState<SellerEvaluation | null>(null);
  const [preflight, setPreflight] = useState<FilePreflight | null>(
    null,
  );
  const [submittedRowCount, setSubmittedRowCount] = useState<
    number | null
  >(null);
  const [consent, setConsent] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;

    async function load() {
      await Promise.resolve();
      const token = readCapabilityToken(window.location.hash);

      if (!token) {
        if (active) {
          setRequestError("This seller link is invalid or incomplete.");
          setLoading(false);
        }
        return;
      }

      tokenRef.current = token;

      try {
        const response = await readEvaluation(evaluationId, token);

        if (!active) {
          return;
        }

        if (response.role !== "seller") {
          setRequestError("This link does not grant seller access.");
          setLoading(false);
          return;
        }

        setEvaluation(response.evaluation);
        setComplete(response.evaluation.status === "complete");
      } catch (caught) {
        if (active) {
          setRequestError(errorMessage(caught));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [evaluationId]);

  async function inspectFile(selected: File | null) {
    const selectionVersion = selectionVersionRef.current + 1;
    selectionVersionRef.current = selectionVersion;
    setFileError(null);
    setRequestError(null);
    setPreflight(null);

    if (!selected) {
      setInspecting(false);
      return;
    }

    if (selected.size > PRODUCT_LIMITS.maximumFileBytes) {
      setFileError(fileIssue("sample_too_large"));
      return;
    }

    setInspecting(true);

    try {
      const parsed = await parseSample({
        bytes: new Uint8Array(await selected.arrayBuffer()),
        fileName: selected.name,
      });

      if (selectionVersionRef.current !== selectionVersion) {
        return;
      }

      setPreflight({
        columnCount: parsed.columnCount,
        columns: parsed.columns,
        file: selected,
        format: parsed.format,
        rowCount: parsed.rowCount,
      });
    } catch (caught) {
      if (selectionVersionRef.current !== selectionVersion) {
        return;
      }

      setFileError(
        caught instanceof SampleError
          ? fileIssue(caught.code)
          : fileIssue("unsupported_format"),
      );
    } finally {
      if (selectionVersionRef.current === selectionVersion) {
        setInspecting(false);
      }
    }
  }

  async function refreshEvaluation() {
    const token = tokenRef.current;

    if (!token) {
      return;
    }

    try {
      const response = await readEvaluation(evaluationId, token);

      if (response.role === "seller") {
        setEvaluation(response.evaluation);
      }
    } catch {
      // The original submission error remains the useful seller message.
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);

    const token = tokenRef.current;

    if (!preflight || !consent || !token) {
      setRequestError(
        "Choose a valid dataset sample and confirm the sample limitation. No 0G request was made.",
      );
      return;
    }

    setSubmitting(true);

    try {
      await submitSample(evaluationId, token, preflight.file);
      setSubmittedRowCount(preflight.rowCount);
      setComplete(true);
      setEvaluation((current) =>
        current ? { ...current, status: "complete" } : current,
      );
      setPreflight(null);
    } catch (caught) {
      setRequestError(errorMessage(caught));
      await refreshEvaluation();
    } finally {
      setSubmitting(false);
    }
  }

  function openFilePicker() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  if (loading) {
    return <SellerLoading />;
  }

  if (!evaluation) {
    return (
      <PageIntro
        label="Seller"
        title="This private link is unavailable."
        description="Ask the buyer to create a new evaluation link."
      >
        <StatusMessage tone="error">
          {requestError ?? "The evaluation could not be loaded."}
        </StatusMessage>
      </PageIntro>
    );
  }

  if (complete) {
    return (
      <PageIntro
        label="Seller"
        title="Private evaluation complete"
        description="The buyer can now view one 0G result for each question. Your dataset sample was not stored."
        workflowStage="results"
      >
        <StatusMessage tone="success">
          The buyer’s result link is ready. You can close this page.
        </StatusMessage>
        <CompletionFacts
          completion={evaluation.completion}
          fallbackQuestionCount={evaluation.questions.length}
          fallbackRowCount={submittedRowCount}
        />
      </PageIntro>
    );
  }

  if (evaluation.status === "processing") {
    return (
      <PageIntro
        label="Seller"
        title="0G evaluation in progress"
        description="The sample is being evaluated privately. Results are published only after the complete response is verified."
        workflowStage="results"
      >
        <ProcessingSteps />
      </PageIntro>
    );
  }

  const buttonLabel = inspecting
    ? "Checking sample…"
    : !preflight
      ? "Choose a sample first"
      : !consent
        ? "Confirm the sample limitation"
        : submitting
          ? "0G evaluation in progress…"
          : "Run private evaluation";

  return (
    <main className="seller-flow">
      <header className="seller-flow__intro">
        <p className="role-kicker">
          Seller task
          <span className="link-validity">Link verified</span>
        </p>
        <h1 className="role-title">Submit a private sample</h1>
        <p className="seller-for">
          Evaluation <strong>{evaluation.title}</strong>
        </p>
        <p className="role-description">
          Review the questions, then upload up to 50 records. Your raw rows
          never go to the buyer.
        </p>
        <WorkflowProgress current="sample" />
      </header>

      <section className="buyer-question-card" aria-labelledby="buyer-questions">
        <h2 id="buyer-questions">
          Questions to evaluate
          <span aria-label={`${evaluation.questions.length} questions`}>
            {evaluation.questions.length}
          </span>
        </h2>
        <ol>
          {evaluation.questions.map((question, index) => (
            <li key={question.id}>
              <span>{index + 1}</span>
              <p>{question.question}</p>
            </li>
          ))}
        </ol>
      </section>

      <form className="seller-submit-card" onSubmit={handleSubmit}>
        <section aria-labelledby="sample-heading">
          <input
            ref={fileInputRef}
            id="sample-file"
            className="sample-file-input"
            type="file"
            accept=".csv,.jsonl,.ndjson,.parquet,text/csv,application/x-ndjson,application/vnd.apache.parquet"
            aria-describedby={
              preflight ? undefined : "sample-file-help"
            }
            aria-invalid={Boolean(fileError)}
            aria-required="true"
            onChange={(event) =>
              void inspectFile(event.target.files?.[0] ?? null)
            }
          />

          {preflight ? (
            <>
              <h2 id="sample-heading">Sample ready</h2>
              <PreflightSummary
                preflight={preflight}
                onReplace={openFilePicker}
              />
            </>
          ) : (
            <>
              <h2 id="sample-heading">Choose your sample</h2>
              <p className="section-support">
                CSV, JSONL, NDJSON, or Parquet. Up to{" "}
                {PRODUCT_LIMITS.maximumRows} records,{" "}
                {PRODUCT_LIMITS.maximumColumns} columns, and 200 KB.
              </p>
              <div
                className={`sample-dropzone${dragActive ? " sample-dropzone--active" : ""}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (event.currentTarget === event.target) {
                    setDragActive(false);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  void inspectFile(
                    event.dataTransfer.files[0] ?? null,
                  );
                }}
              >
                <label htmlFor="sample-file">
                  <strong>
                    {inspecting
                      ? "Checking your sample…"
                      : "Choose a dataset sample or drop it here"}
                  </strong>
                  <span id="sample-file-help">
                    A free check runs in this browser before any 0G
                    request.
                  </span>
                </label>
              </div>
            </>
          )}

          {fileError ? (
            <div className="message-wrap" aria-live="polite">
              <StatusMessage tone="error">{fileError}</StatusMessage>
            </div>
          ) : null}

          <div className="privacy-strip" id="privacy-heading">
            <strong>Your sample stays private</strong>
            <span>
              Encrypted in transit · processed in memory · never shown to the
              buyer
            </span>
          </div>
          <label className="check-row">
            <input
              name="sample-limitation-confirmed"
              type="checkbox"
              checked={consent}
              aria-required="true"
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              I understand the results apply only to this sample.
            </span>
          </label>
        </section>

        {evaluation.status === "failed" ? (
          <FailureNotice evaluation={evaluation} />
        ) : null}

        {requestError ? (
          <div className="message-wrap" aria-live="assertive">
            <StatusMessage tone="error">{requestError}</StatusMessage>
          </div>
        ) : null}

        {submitting ? <ProcessingSteps /> : null}

        <button
          type="submit"
          disabled={!preflight || !consent || inspecting || submitting}
          aria-busy={submitting}
          className="button-primary button-wide seller-run-button"
        >
          {buttonLabel}
        </button>
        <p className="token-disclosure" aria-live="polite">
          No 0G tokens are spent before this click. One request begins after
          confirmation.
        </p>
      </form>
    </main>
  );
}

function PreflightSummary({
  onReplace,
  preflight,
}: {
  onReplace: () => void;
  preflight: FilePreflight;
}) {
  const visibleHeaders = preflight.columns.slice(0, 8);
  const hiddenHeaderCount =
    preflight.columns.length - visibleHeaders.length;

  return (
    <div className="preflight-card" aria-live="polite">
      <div className="preflight-card__header">
        <div>
          <p className="preflight-status">Ready to evaluate</p>
          <strong>{preflight.file.name}</strong>
          <small>{formatBytes(preflight.file.size)}</small>
        </div>
        <button
          type="button"
          className="button-quiet"
          onClick={onReplace}
        >
          Replace
        </button>
      </div>
      <dl className="preflight-facts">
        <div>
          <dt>Format</dt>
          <dd>{formatLabel(preflight.format)}</dd>
        </div>
        <div>
          <dt>Records</dt>
          <dd>{preflight.rowCount}</dd>
        </div>
        <div>
          <dt>Columns</dt>
          <dd>{preflight.columnCount}</dd>
        </div>
        <div>
          <dt>Validation</dt>
          <dd>Passed locally</dd>
        </div>
      </dl>
      <div className="header-preview">
        <span>Headers</span>
        <div>
          {visibleHeaders.map((header) => (
            <code key={header}>{header}</code>
          ))}
          {hiddenHeaderCount > 0 ? (
            <code>+{hiddenHeaderCount} more</code>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FailureNotice({
  evaluation,
}: {
  evaluation: SellerEvaluation;
}) {
  return (
    <div className="seller-failure" role="alert">
      <strong>The previous evaluation did not complete.</strong>
      <p>{failureReason(evaluation.failure.code)}</p>
      <p>
        {evaluation.failure.requestMade
          ? "A 0G request was made and may have used tokens. Retrying starts one new request."
          : "No 0G request was made. You can retry after checking the file and service configuration."}
      </p>
    </div>
  );
}

function ProcessingSteps() {
  return (
    <div className="evaluation-progress" aria-live="polite">
      <p>0G evaluation in progress</p>
      <ol>
        <li data-state="complete">Sample validated</li>
        <li data-state="complete">Questions prepared</li>
        <li data-state="current">Running private evaluation</li>
        <li data-state="queued">Verifying complete results</li>
      </ol>
    </div>
  );
}

function CompletionFacts({
  completion,
  fallbackQuestionCount,
  fallbackRowCount,
}: {
  completion: SellerEvaluation["completion"];
  fallbackQuestionCount: number;
  fallbackRowCount: number | null;
}) {
  const facts = [
    ["Records evaluated", completion?.rowCount ?? fallbackRowCount],
    [
      "Questions completed",
      completion?.questionCount ?? fallbackQuestionCount,
    ],
    ["No score produced", completion?.unableCount],
    [
      "Private inference",
      completion?.privateInferenceUsed === false ? "No" : "Used",
    ],
  ].filter(
    (fact): fact is [string, number | string] =>
      fact[1] !== null && fact[1] !== undefined,
  );

  return (
    <dl className="seller-completion-facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PageIntro({
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

function SellerLoading() {
  return (
    <div
      className="loading-shell"
      aria-label="Loading seller evaluation"
    >
      <div className="skeleton-line skeleton-line--short" />
      <div className="skeleton-line" />
      <div className="skeleton-block" />
    </div>
  );
}

function errorMessage(caught: unknown) {
  if (caught instanceof BrowserApiError) {
    if (caught.code === "scoring_failed") {
      return "The private evaluation did not complete, so no results were published.";
    }

    return caught.message;
  }

  return "CipherQuery could not complete this submission.";
}

function fileIssue(code: SampleError["code"]) {
  const action = {
    empty_sample:
      "Add at least one structured data record, then choose the sample again.",
    invalid_csv:
      "Check that every row has the same number of cells and every header is unique, then choose the CSV again.",
    invalid_encoding:
      "Export the text sample using UTF-8 encoding, then choose it again.",
    invalid_jsonl:
      "Check that every JSONL line is one valid object with unambiguous keys.",
    invalid_parquet:
      "Export the Parquet sample again and check that its schema is valid.",
    normalized_sample_too_large:
      "Reduce the decoded content in this sample.",
    sample_too_large:
      "Choose a sample no larger than 200 KB.",
    too_many_columns: `Reduce the sample to ${PRODUCT_LIMITS.maximumColumns} columns or fewer.`,
    too_many_rows: `Reduce the sample to ${PRODUCT_LIMITS.maximumRows} records or fewer.`,
    unsupported_format:
      "Choose a CSV, JSONL, NDJSON, or Parquet sample.",
    unsupported_parquet:
      "Use a flat Parquet table with supported primitive columns.",
  }[code];

  return `${action} No 0G request was made.`;
}

function failureReason(code: string | null) {
  switch (code) {
    case "tee_verification_failed":
      return "The private execution could not be verified.";
    case "zero_g_authentication_failed":
      return "0G rejected the configured service credential.";
    case "zero_g_invalid_response":
      return "0G returned a response that did not pass validation.";
    case "zero_g_unavailable":
      return "0G did not finish the request in time.";
    case "result_persistence_failed":
      return "The verified result could not be published.";
    default:
      return "No complete, verified result set was available.";
  }
}

function formatBytes(bytes: number) {
  return bytes < 1_000
    ? `${bytes} B`
    : `${(bytes / 1_000).toFixed(1)} KB`;
}

function formatLabel(format: SampleFormat) {
  switch (format) {
    case "csv":
      return "CSV";
    case "jsonl":
      return "JSONL";
    case "parquet":
      return "Parquet";
  }
}
