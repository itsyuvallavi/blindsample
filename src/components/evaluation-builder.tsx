"use client";

import { useEffect, useState } from "react";

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

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;

    if (target < 0 || target >= questions.length) {
      return;
    }

    setQuestions((current) => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [
        reordered[target],
        reordered[index],
      ];
      return reordered;
    });
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
      <section className="terminal-window" aria-labelledby="links-title">
        <TerminalBar path="~/blindsample/links" status="READY" />
        <div className="terminal-body">
          <CommandLine>private links create</CommandLine>
          <p className="terminal-success">
            Two role-specific links created
          </p>
          <h2 id="links-title" className="terminal-title">
            Share one link. Keep one link.
          </h2>
          <p className="terminal-copy">
            BlindSample will send the seller&apos;s sample and all questions
            together in one 0G request. Creating these links did not spend
            0G tokens.
          </p>

          <div className="capability-stack">
            <CapabilityLink
              label="Send this link to the seller"
              description="The seller can review your questions and submit one CSV. They cannot see your results."
              value={created.sellerUrl}
              copied={copied === "seller"}
              onCopy={() => copyLink("seller", created.sellerUrl)}
            />
            <CapabilityLink
              label="Keep this private results link"
              description="This is your link for status and question-level results. Do not send it to the seller."
              value={created.buyerUrl}
              copied={copied === "buyer"}
              onCopy={() => copyLink("buyer", created.buyerUrl)}
            />
          </div>

          <div className="button-row">
            <a className="button-primary" href={created.buyerUrl}>
              Open my private results
            </a>
            <button
              type="button"
              className="button-secondary"
              onClick={resetDraft}
            >
              New evaluation
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={handleCreate} className="terminal-window">
      <TerminalBar path="~/new-evaluation" status="READY" />
      <div className="terminal-body">
        <CommandLine>start private evaluation</CommandLine>
        <h2 className="terminal-title">Create an evaluation</h2>
        <p className="terminal-copy">
          Ask plain-language questions. BlindSample decides how to test each
          one after reading the submitted CSV.
        </p>

        <label className="field-group">
          <span className="field-label">Evaluation name</span>
          <input
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
            <legend>Questions</legend>
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
                onMove={(direction) =>
                  moveQuestion(index, direction)
                }
                onRemove={() => removeQuestion(question.id)}
                canMoveUp={index > 0}
                canMoveDown={index < questions.length - 1}
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

        <ExperiencePreviews question={questions[0]?.question} />

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
        <p className="terminal-footnote">
          Creating links is free. 0G tokens are spent only if a submitted
          question needs private AI evaluation.
        </p>
        <button
          type="button"
          className="button-quiet discard-draft"
          onClick={resetDraft}
        >
          Discard draft
        </button>
      </div>
    </form>
  );
}

function QuestionEditor({
  canMoveDown,
  canMoveUp,
  canRemove,
  index,
  onChange,
  onMove,
  onRemove,
  question,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  canRemove: boolean;
  index: number;
  onChange: (question: string) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  question: EvaluationQuestion;
}) {
  return (
    <div className="question-row criterion-editor">
      <div className="question-row__header">
        <span className="question-index">
          [{String(index).padStart(2, "0")}]
        </span>
        {canMoveUp || canMoveDown || canRemove ? (
          <div className="question-actions">
            {canMoveUp ? (
              <MiniButton onClick={() => onMove(-1)}>
                Move up
              </MiniButton>
            ) : null}
            {canMoveDown ? (
              <MiniButton onClick={() => onMove(1)}>
                Move down
              </MiniButton>
            ) : null}
            {canRemove ? (
              <MiniButton onClick={onRemove}>Remove</MiniButton>
            ) : null}
          </div>
        ) : null}
      </div>

      <label className="field-group">
        <span className="field-label">
          What do you want to know about this dataset?
        </span>
        <textarea
          className="text-area"
          rows={3}
          maxLength={PRODUCT_LIMITS.maximumQuestionCharacters}
          value={question.question}
          onChange={(event) => onChange(event.target.value)}
          placeholder="What percentage of records contain all required price fields?"
          required
        />
      </label>
    </div>
  );
}

function MiniButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="button-mini"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ExperiencePreviews({ question }: { question?: string }) {
  return (
    <div className="experience-previews">
      <details className="experience-preview">
        <summary>Preview seller experience</summary>
        <div className="experience-preview__body">
          <p className="preview-label">
            Example only · Seller submission
          </p>
          <h3>Review the questions, then choose one CSV.</h3>
          <p>
            BlindSample sends the parsed sample and all questions together to
            private 0G compute. The buyer never receives the sample rows.
          </p>
        </div>
      </details>
      <details className="experience-preview">
        <summary>Preview example results</summary>
        <div className="experience-preview__body example-result">
          <div>
            <p className="preview-label">
              Example only · Private buyer result
            </p>
            <h3>
              {question?.trim() ||
                "Does this dataset meet my requirement?"}
            </h3>
          </div>
          <p className="example-score">
            82<small>/100</small>
          </p>
          <p>
            Every answer is evaluated by 0G and shown separately.
            BlindSample never calculates an overall dataset score.
          </p>
        </div>
      </details>
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

export function TerminalBar({
  path,
  status,
}: {
  path: string;
  status: string;
}) {
  return (
    <div className="terminal-bar">
      <span className="terminal-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <code>{path}</code>
      <span className="terminal-status">{status}</span>
    </div>
  );
}

export function CommandLine({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="command-line">
      <span>$</span> {children}
    </p>
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
    : "BlindSample could not complete this operation.";
}
