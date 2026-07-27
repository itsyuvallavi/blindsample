"use client";

import { useEffect, useRef, useState } from "react";

import {
  BrowserApiError,
  createEvaluation,
  type CreatedEvaluationResponse,
} from "../lib/browser/evaluations";
import {
  EVALUATION_DRAFT_STORAGE_KEY,
  parseEvaluationDraft,
  serializeEvaluationDraft,
  type EvaluationDraft,
} from "../lib/browser/evaluation-draft";
import type { EvaluationQuestion } from "../lib/evaluation-plans/types";
import { PRODUCT_LIMITS } from "../lib/product-contract";
import { StatusMessage } from "./status-message";

type CreatedLinks = CreatedEvaluationResponse & {
  buyerUrl: string;
  sellerUrl: string;
};

export function EvaluationBuilder() {
  const resultRef = useRef<HTMLElement>(null);
  const [initialDraft] = useState(createInitialEvaluationDraft);
  const [title, setTitle] = useState(initialDraft.title);
  const [questions, setQuestions] = useState(initialDraft.questions);
  const [created, setCreated] = useState<CreatedLinks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<"buyer" | "seller" | null>(
    null,
  );
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftPersistenceFailed, setDraftPersistenceFailed] =
    useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = parseEvaluationDraft(
        window.localStorage.getItem(EVALUATION_DRAFT_STORAGE_KEY),
      );

      if (restored) {
        setTitle(restored.title);
        setQuestions(restored.questions);
        setDraftRestored(true);
      }

      setDraftReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!draftReady || created) {
      return;
    }

    let persistenceFailed = false;

    try {
      window.localStorage.setItem(
        EVALUATION_DRAFT_STORAGE_KEY,
        serializeEvaluationDraft({ questions, title }),
      );
    } catch {
      persistenceFailed = true;
    }

    const timer = window.setTimeout(
      () => setDraftPersistenceFailed(persistenceFailed),
      0,
    );

    return () => window.clearTimeout(timer);
  }, [created, draftReady, questions, title]);

  useEffect(() => {
    if (!draftPersistenceFailed) {
      return;
    }

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () =>
      window.removeEventListener(
        "beforeunload",
        warnBeforeLeaving,
      );
  }, [draftPersistenceFailed]);

  useEffect(() => {
    if (created) {
      resultRef.current?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    }
  }, [created]);

  function updateQuestion(id: string, question: string) {
    setQuestions((current) =>
      current.map((item) =>
        item.id === id ? { ...item, question } : item,
      ),
    );
    setError(null);
  }

  function addQuestion() {
    if (questions.length >= PRODUCT_LIMITS.maximumQuestions) {
      return;
    }

    setQuestions((current) => [
      ...current,
      {
        id: `q_${crypto.randomUUID()}`,
        question: "",
      },
    ]);
  }

  function removeQuestion(id: string) {
    if (questions.length === 1) {
      return;
    }

    setQuestions((current) =>
      current.filter((question) => question.id !== id),
    );
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Add an evaluation name.");
      return;
    }

    const firstEmptyQuestion = questions.findIndex(
      (question) => !question.question.trim(),
    );

    if (firstEmptyQuestion >= 0) {
      setError(`Add question ${firstEmptyQuestion + 1}.`);
      return;
    }

    setSubmitting(true);

    try {
      const result = await createEvaluation({
        questions,
        title,
      });
      setCreated({
        ...result,
        buyerUrl: new URL(
          result.buyerPath,
          window.location.origin,
        ).href,
        sellerUrl: new URL(
          result.sellerPath,
          window.location.origin,
        ).href,
      });
      window.localStorage.removeItem(EVALUATION_DRAFT_STORAGE_KEY);
      setDraftRestored(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink(role: "buyer" | "seller", url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(role);
      window.setTimeout(() => setCopied(null), 1_500);
    } catch {
      setError("Copy failed. Select the URL and copy it manually.");
    }
  }

  function resetDraft() {
    const next = createInitialEvaluationDraft();
    window.localStorage.removeItem(EVALUATION_DRAFT_STORAGE_KEY);
    setTitle(next.title);
    setQuestions(next.questions);
    setCreated(null);
    setError(null);
    setDraftRestored(false);
    setDraftPersistenceFailed(false);
  }

  if (created) {
    return (
      <section
        ref={resultRef}
        className="builder-card links-ready"
        aria-labelledby="links-title"
      >
        <div className="builder-header">
          <p className="builder-step">Evaluation ready</p>
          <h2 id="links-title">Share one link. Keep one private.</h2>
          <p>
            Creating these links did not call 0G or spend tokens. After the
            seller submits, the dataset sample travels over encrypted
            transport into 0G private compute.
          </p>
        </div>

        <div className="capability-notice">
          <strong>These links grant access.</strong>
          <span>
            Send the seller link only to the seller. Keep the results link for
            yourself.
          </span>
        </div>

        <div className="capability-stack">
          <CapabilityLink
            label="Seller submission link"
            description="The seller can review your questions and submit one CSV, JSONL, NDJSON, or Parquet sample. They cannot see your results."
            value={created.sellerUrl}
            copied={copied === "seller"}
            onCopy={() => copyLink("seller", created.sellerUrl)}
          />
          <CapabilityLink
            label="Your private results link"
            description="Use this link to follow status and see the question-level results."
            value={created.buyerUrl}
            copied={copied === "buyer"}
            onCopy={() => copyLink("buyer", created.buyerUrl)}
          />
        </div>

        {error ? (
          <div className="message-wrap">
            <StatusMessage tone="error">{error}</StatusMessage>
          </div>
        ) : null}

        <div className="button-row">
          <a className="button-primary" href={created.buyerUrl}>
            Open private results
          </a>
          <button
            type="button"
            className="button-secondary"
            onClick={resetDraft}
          >
            Create another
          </button>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleCreate}
      className="builder-card builder-card--form"
      aria-label="Create a private evaluation"
    >
      <div className="builder-body">
        <label className="field-group">
          <span className="field-label">Evaluation name</span>
          <span className="field-support">
            A short label both you and the seller will recognize.
          </span>
          <input
            name="evaluation-title"
            autoComplete="off"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={PRODUCT_LIMITS.maximumTitleCharacters}
            className="text-input"
            placeholder="BTC market sample"
            required
          />
        </label>

        <fieldset className="field-group">
          <div className="field-heading">
            <div>
              <legend>Questions for the dataset</legend>
              <p className="field-support">
                Plain text only. Each question receives its own result.
              </p>
            </div>
            <span className="field-count">
              {questions.length}/{PRODUCT_LIMITS.maximumQuestions}
            </span>
          </div>

          <div className="question-list">
            {questions.map((question, index) => (
              <QuestionEditor
                key={question.id}
                question={question}
                index={index}
                onChange={(value) =>
                  updateQuestion(question.id, value)
                }
                onRemove={() => removeQuestion(question.id)}
                canRemove={questions.length > 1}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addQuestion}
            disabled={
              questions.length >= PRODUCT_LIMITS.maximumQuestions
            }
            className="button-quiet add-question"
          >
            + Add another question
          </button>
        </fieldset>

        {error ? (
          <div className="message-wrap">
            <StatusMessage tone="error">{error}</StatusMessage>
          </div>
        ) : null}

        {draftRestored ? (
          <div className="message-wrap">
            <StatusMessage>
              Draft restored from this browser.
            </StatusMessage>
          </div>
        ) : null}

        {draftPersistenceFailed ? (
          <div className="message-wrap">
            <StatusMessage tone="error">
              This browser could not save the draft. Keep this page open until
              you finish.
            </StatusMessage>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="button-primary button-wide"
        >
          {submitting ? "Creating private links…" : "Create private links"}
        </button>
        <p className="builder-footnote">
          No dataset is uploaded and no 0G request is made yet.
        </p>
        <button
          type="button"
          className="button-quiet discard-draft"
          onClick={resetDraft}
        >
          Clear draft
        </button>
      </div>
    </form>
  );
}

function QuestionEditor({
  canRemove,
  index,
  onChange,
  onRemove,
  question,
}: {
  canRemove: boolean;
  index: number;
  onChange: (question: string) => void;
  onRemove: () => void;
  question: EvaluationQuestion;
}) {
  const fieldId = `question-${question.id}`;

  return (
    <div className="question-row">
      <div className="question-row__header">
        <label className="question-index" htmlFor={fieldId}>
          Question {index + 1}
        </label>
        {canRemove ? (
          <button
            type="button"
            className="button-mini"
            onClick={onRemove}
          >
            Remove
          </button>
        ) : null}
      </div>

      <textarea
        id={fieldId}
        name="questions[]"
        className="text-area"
        rows={2}
        maxLength={PRODUCT_LIMITS.maximumQuestionCharacters}
        value={question.question}
        onChange={(event) => onChange(event.target.value)}
        placeholder="For example: Are the price records complete and sequential?"
        aria-label={`Question ${index + 1}`}
        required
      />
    </div>
  );
}

function CapabilityLink({
  copied,
  description,
  label,
  onCopy,
  value,
}: {
  copied: boolean;
  description: string;
  label: string;
  onCopy: () => void;
  value: string;
}) {
  return (
    <div className="capability-row">
      <p className="capability-row__label">{label}</p>
      <p className="capability-row__description">{description}</p>
      <div className="capability-row__controls">
        <input
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          className="text-input"
          aria-label={`${label} URL`}
        />
        <button
          type="button"
          onClick={onCopy}
          className="button-secondary"
          data-state={copied ? "success" : "default"}
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

function createInitialEvaluationDraft(): EvaluationDraft {
  return {
    questions: [
      {
        id: "question_1",
        question: "",
      },
    ],
    title: "",
  };
}

function errorMessage(caught: unknown) {
  return caught instanceof BrowserApiError
    ? caught.message
    : "CipherQuery could not complete this operation.";
}
