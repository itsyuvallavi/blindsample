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
        title="The buyer can now view the scores."
        description="The TLS-encrypted upload was processed through 0G private compute. BlindSample did not save the CSV or expose its rows to the buyer."
      >
        <StatusMessage tone="success">
          0G reported TEE-verified execution before BlindSample published any
          score.
        </StatusMessage>
      </PageIntro>
    );
  }

  if (evaluation.status === "processing") {
    return (
      <PageIntro
        label="Private scoring"
        title="This sample is already processing."
        description="The buyer result will update when verified scoring finishes."
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
          <h2>Buyer questions</h2>
          <ol className="review-list">
            {evaluation.questions.map((question, index) => (
              <li key={question.id}>
                <span className="question-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{question.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="workbench-panel submission-panel"
      >
        <p className="workbench-panel__marker">
          SECURED SUBMISSION · 0G
        </p>
        <SecurityRail />
        <h2 className="panel-title">Submit a CSV sample</h2>
        <p className="panel-copy">
          Maximum 200 KB, 200 data rows, and 20 columns. Include one header
          row.
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
          <h3>Encrypted transit. Private execution.</h3>
          <p>
            TLS protects the file in transit. BlindSample&apos;s Vercel
            function holds it only in memory while 0G performs private,
            TEE-verified inference. The CSV is never written to Supabase.
          </p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={consent}
              aria-required="true"
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              I understand this encrypted upload is used only for this 0G
              private evaluation.
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
            ? "Sending securely to 0G…"
            : "Send to 0G private compute"}
        </button>
        <p className="readiness-note" aria-live="polite">
          {!file
            ? "Select a CSV sample to continue."
            : !consent
              ? "Confirm the privacy notice to continue."
              : "Ready for private scoring."}
        </p>
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
