"use client";

import { useEffect, useRef, useState } from "react";

import { readCapabilityToken } from "../lib/browser/capability";
import {
  BrowserApiError,
  readEvaluation,
  submitSample,
  type SellerEvaluation,
} from "../lib/browser/evaluations";
import { PRODUCT_LIMITS } from "../lib/product-contract";
import { SecurityRail } from "./security-rail";
import { StatusMessage } from "./status-message";
import { CommandLine, TerminalBar } from "./evaluation-builder";

export function SellerSubmission({
  evaluationId,
}: {
  evaluationId: string;
}) {
  const tokenRef = useRef<string | null>(null);
  const [evaluation, setEvaluation] =
    useState<SellerEvaluation | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      await Promise.resolve();
      const token = readCapabilityToken(window.location.hash);

      if (!token) {
        if (active) {
          setError("This seller link is invalid or incomplete.");
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
          setError("This link does not grant seller access.");
          setLoading(false);
          return;
        }

        setEvaluation(response.evaluation);
        setComplete(response.evaluation.status === "complete");
      } catch (caught) {
        if (active) {
          setError(errorMessage(caught));
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

  function selectFile(selected: File | null) {
    setError(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (selected.size > PRODUCT_LIMITS.maximumFileBytes) {
      setFile(null);
      setError("The CSV sample must not exceed 200 KB.");
      return;
    }

    setFile(selected);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const token = tokenRef.current;

    if (!file || !consent || !token) {
      setError("Select a CSV file and confirm the privacy notice.");
      return;
    }

    setSubmitting(true);

    try {
      await submitSample(evaluationId, token, file);
      setComplete(true);
      setEvaluation((current) =>
        current ? { ...current, status: "complete" } : current,
      );
      setFile(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <SellerLoading />;
  }

  if (!evaluation) {
    return (
      <PageIntro
        label="Seller submission"
        title="This private link is unavailable."
        description="Ask the buyer to create a new evaluation link."
      >
        <StatusMessage tone="error">
          {error ?? "The evaluation could not be loaded."}
        </StatusMessage>
      </PageIntro>
    );
  }

  if (complete) {
    return (
      <PageIntro
        label="Submission complete"
        title="Evaluation complete — all questions evaluated by 0G."
        description="BlindSample evaluated only the submitted records and did not save the CSV or expose its rows to the buyer."
      >
        <StatusMessage tone="success">
          One private, TEE-verified 0G response produced the complete result
          set.
        </StatusMessage>
      </PageIntro>
    );
  }

  if (evaluation.status === "processing") {
    return (
      <PageIntro
        label="0G evaluation"
        title="0G evaluation in progress."
        description="The buyer result will update only after every question has a valid result from one verified response."
      >
        <StatusMessage>
          Keep this page open or return later with the same seller link.
        </StatusMessage>
      </PageIntro>
    );
  }

  return (
    <div className="role-workbench">
      <section>
        <p className="role-kicker">SELLER SUBMISSION</p>
        <h1 className="role-title">{evaluation.title}</h1>
        <p className="role-description">
          Your CSV travels over TLS into 0G private compute. The buyer receives
          only secured, question-level scores—never your sample rows.
        </p>

        <div className="question-review">
          <h2>Questions from the buyer</h2>
          <ol className="review-list">
            {evaluation.questions.map((question, index) => (
              <li key={question.id}>
                <span className="question-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{question.question}</strong>
                  <small>
                    This question is included in the single 0G evaluation
                    request.
                  </small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="terminal-window submission-panel"
      >
        <TerminalBar path="~/blindsample/submit" status="AUTHORIZED" />
        <div className="terminal-body">
          <CommandLine>sample submit --memory-only</CommandLine>
          <SecurityRail />
          <h2 className="terminal-title">Submit a CSV sample</h2>
          <p className="terminal-copy">
            1–50 parsed data records, maximum 200 KB and 20 columns. The header
            is excluded from the record count. All parsed records and buyer
            questions are evaluated together by 0G.
          </p>
          <p className="cost-boundary">
            Selecting a file is free. 0G tokens are spent only when you start
            the private evaluation.
          </p>

          <label className="field-label field-group">
            CSV file
            <input
              id="sample-file"
              type="file"
              accept=".csv,text/csv"
              aria-invalid={Boolean(error) && !file}
              aria-required="true"
              onChange={(event) =>
                selectFile(event.target.files?.[0] ?? null)
              }
              className="file-input"
            />
          </label>

          {file ? (
            <div className="selected-file">
              <span>{file.name}</span>
              <span>{formatBytes(file.size)}</span>
            </div>
          ) : null}

          <div className="privacy-note">
            <h3>Protected transit. Private 0G execution.</h3>
            <p>
              TLS protects the file in transit. The Vercel function holds it
              only in memory. Every buyer question is evaluated by private 0G
              compute and requires TEE verification. The CSV is never written
              to Supabase.
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={consent}
                aria-required="true"
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>
                I understand the result describes only these submitted
                records, not my complete dataset.
              </span>
            </label>
          </div>

          {evaluation.status === "failed" ? (
            <div className="message-wrap">
              <StatusMessage>
                The previous attempt failed safely. You can retry with this
                seller link.
              </StatusMessage>
            </div>
          ) : null}

          {error ? (
            <div className="message-wrap">
              <StatusMessage tone="error">{error}</StatusMessage>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!file || !consent || submitting}
            aria-busy={submitting}
            className="button-primary button-wide"
          >
            {submitting
              ? "0G evaluation in progress…"
              : "Start private evaluation"}
          </button>
          <p className="readiness-note" aria-live="polite">
            {!file
              ? "Select a CSV sample to continue."
              : !consent
                ? "Confirm the submitted-data limitation."
                : "Ready to evaluate all questions in one 0G request."}
          </p>
        </div>
      </form>
    </div>
  );
}

function PageIntro({
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
  return caught instanceof BrowserApiError
    ? caught.message
    : "BlindSample could not complete this submission.";
}

function formatBytes(bytes: number) {
  return bytes < 1_000
    ? `${bytes} B`
    : `${(bytes / 1_000).toFixed(1)} KB`;
}
