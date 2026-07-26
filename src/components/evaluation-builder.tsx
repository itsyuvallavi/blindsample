"use client";

import { useState } from "react";

import {
  BrowserApiError,
  createEvaluation,
  type CreatedEvaluationResponse,
  type Question,
} from "../lib/browser/evaluations";
import { PRODUCT_LIMITS } from "../lib/product-contract";
import { SecurityRail } from "./security-rail";
import { StatusMessage } from "./status-message";

const INITIAL_QUESTIONS: Question[] = [
  {
    id: "question_1",
    text: "Does this sample contain the fields needed for my use case?",
  },
];

type CreatedLinks = CreatedEvaluationResponse & {
  buyerUrl: string;
  sellerUrl: string;
};

export function EvaluationBuilder() {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] =
    useState<Question[]>(INITIAL_QUESTIONS);
  const [created, setCreated] = useState<CreatedLinks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [touchedQuestions, setTouchedQuestions] = useState<Set<string>>(
    new Set(),
  );
  const [copied, setCopied] = useState<"buyer" | "seller" | null>(
    null,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setTitleTouched(true);
    setTouchedQuestions(new Set(questions.map((question) => question.id)));

    if (
      title.trim().length === 0 ||
      questions.some((question) => question.text.trim().length === 0)
    ) {
      setError("Add a title and complete every question.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await createEvaluation({ questions, title });
      setCreated({
        ...result,
        buyerUrl: new URL(result.buyerPath, window.location.origin).href,
        sellerUrl: new URL(result.sellerPath, window.location.origin).href,
      });
    } catch (caught) {
      setError(
        caught instanceof BrowserApiError
          ? caught.message
          : "BlindSample could not create this evaluation.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function updateQuestion(id: string, text: string) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, text } : question,
      ),
    );
  }

  function touchQuestion(id: string) {
    setTouchedQuestions((current) => new Set(current).add(id));
  }

  function addQuestion() {
    if (questions.length >= PRODUCT_LIMITS.maximumQuestions) {
      return;
    }

    setQuestions((current) => [
      ...current,
      { id: `q_${crypto.randomUUID()}`, text: "" },
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

  async function copyLink(role: "buyer" | "seller", url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(role);
      window.setTimeout(() => setCopied(null), 1_500);
    } catch {
      setError("Copy failed. Select the link and copy it manually.");
    }
  }

  if (created) {
    return (
      <section
        className="workbench-panel"
        aria-labelledby="links-title"
      >
        <p className="workbench-panel__marker">SECURED LINKS CREATED</p>
        <SecurityRail />
        <h2 id="links-title" className="panel-title">
          Share the seller link. Keep the buyer link.
        </h2>
        <p className="panel-copy">
          Each link carries separate, role-scoped access until it expires.
          Only token hashes are stored, so BlindSample cannot recover the
          links.
        </p>

        <div className="capability-stack">
          <CapabilityLink
            label="Seller link"
            description="Send this to the dataset owner. It permits one TLS-encrypted CSV submission into 0G private compute."
            value={created.sellerUrl}
            copied={copied === "seller"}
            onCopy={() => copyLink("seller", created.sellerUrl)}
          />
          <CapabilityLink
            label="Buyer link"
            description="Keep this private. It reveals only status, secured trace metadata, and verified question scores."
            value={created.buyerUrl}
            copied={copied === "buyer"}
            onCopy={() => copyLink("buyer", created.buyerUrl)}
          />
        </div>

        <div className="button-row">
          <a
            className="button-primary"
            href={created.buyerUrl}
          >
            Open buyer view
          </a>
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setTitle("");
              setQuestions(INITIAL_QUESTIONS);
              setTitleTouched(false);
              setTouchedQuestions(new Set());
            }}
            className="button-secondary"
          >
            Create another
          </button>
        </div>

        {error ? (
          <div className="message-wrap">
            <StatusMessage tone="error">{error}</StatusMessage>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="workbench-panel"
    >
      <p className="workbench-panel__marker">
        SECURED WORKBENCH · 0G
      </p>
      <SecurityRail />
      <div className="field-group">
        <label
          htmlFor="evaluation-title"
          className="field-label"
        >
          Evaluation title
        </label>
        <p
          id="title-help"
          className="field-helper"
          data-tone={
            titleTouched && title.trim().length === 0 ? "error" : "neutral"
          }
        >
          {titleTouched && title.trim().length === 0
            ? "Add a title so both roles can identify this evaluation."
            : "A private label for the buyer and seller."}
        </p>
        <input
          id="evaluation-title"
          aria-describedby="title-help"
          aria-invalid={titleTouched && title.trim().length === 0}
          aria-required="true"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => setTitleTouched(true)}
          maxLength={PRODUCT_LIMITS.maximumTitleCharacters}
          placeholder="Customer support dataset"
          className="text-input"
        />
      </div>

      <fieldset className="field-group">
        <div className="field-heading">
          <div>
            <legend>Buyer questions</legend>
            <p className="field-helper">
              Each question receives its own score from 1 to 100.
            </p>
          </div>
          <span className="field-count">
            {questions.length}/{PRODUCT_LIMITS.maximumQuestions}
          </span>
        </div>

        <div className="question-list">
          {questions.map((question, index) => (
            <div key={question.id} className="question-row">
              <div className="question-row__header">
                <label
                  htmlFor={question.id}
                  className="question-index"
                >
                  Question {index + 1}
                </label>
                <div className="question-actions">
                  <QuestionAction
                    label={`Move question ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => moveQuestion(index, -1)}
                  >
                    Up
                  </QuestionAction>
                  <QuestionAction
                    label={`Move question ${index + 1} down`}
                    disabled={index === questions.length - 1}
                    onClick={() => moveQuestion(index, 1)}
                  >
                    Down
                  </QuestionAction>
                  <QuestionAction
                    label={`Remove question ${index + 1}`}
                    disabled={questions.length === 1}
                    onClick={() => removeQuestion(question.id)}
                  >
                    Remove
                  </QuestionAction>
                </div>
              </div>
              <textarea
                id={question.id}
                value={question.text}
                onChange={(event) =>
                  updateQuestion(question.id, event.target.value)
                }
                onBlur={() => touchQuestion(question.id)}
                aria-describedby={`${question.id}-help`}
                aria-invalid={
                  touchedQuestions.has(question.id) &&
                  question.text.trim().length === 0
                }
                aria-required="true"
                maxLength={PRODUCT_LIMITS.maximumQuestionCharacters}
                rows={2}
                className="text-area"
                placeholder="Is this dataset suitable for my support classifier?"
              />
              <p
                id={`${question.id}-help`}
                className="field-helper"
                data-tone={
                  touchedQuestions.has(question.id) &&
                  question.text.trim().length === 0
                    ? "error"
                    : "neutral"
                }
              >
                {touchedQuestions.has(question.id) &&
                question.text.trim().length === 0
                  ? "Write the suitability question this score must answer."
                  : "The result for this question will be one integer from 1 to 100."}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addQuestion}
          disabled={questions.length >= PRODUCT_LIMITS.maximumQuestions}
          className="button-quiet add-question"
        >
          Add question
        </button>
      </fieldset>

      {error ? (
        <div className="message-wrap">
          <StatusMessage tone="error">{error}</StatusMessage>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="button-primary button-wide"
      >
        {submitting ? "Creating secured links…" : "Create private evaluation"}
      </button>
    </form>
  );
}

function QuestionAction({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="button-mini"
    >
      {children}
    </button>
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
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
