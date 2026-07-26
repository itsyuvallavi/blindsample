"use client";

import { useState } from "react";

import type {
  CriterionDraft,
  CriterionKind,
  EvaluationContractPreview,
} from "../lib/evaluation-contracts/types";
import {
  BrowserApiError,
  createEvaluation,
  type CreatedEvaluationResponse,
  previewEvaluationContracts,
} from "../lib/browser/evaluations";
import { PRODUCT_LIMITS } from "../lib/product-contract";
import { StatusMessage } from "./status-message";

const CRITERION_OPTIONS: { label: string; value: CriterionKind }[] = [
  { label: "Semantic relevance · 0G", value: "semantic_relevance" },
  { label: "Completeness", value: "completeness" },
  { label: "Format validity", value: "format_validity" },
  { label: "Uniqueness", value: "uniqueness" },
  { label: "Date freshness", value: "date_freshness" },
  { label: "Numeric range", value: "numeric_range" },
  { label: "Column availability", value: "column_availability" },
  { label: "Category coverage", value: "category_coverage" },
];

type CreatedLinks = CreatedEvaluationResponse & {
  buyerUrl: string;
  sellerUrl: string;
};

export function EvaluationBuilder() {
  const [title, setTitle] = useState("Customer support sample");
  const [criteria, setCriteria] = useState<CriterionDraft[]>([
    createCriterion("semantic_relevance", "criterion_1"),
  ]);
  const [preview, setPreview] =
    useState<EvaluationContractPreview | null>(null);
  const [approved, setApproved] = useState(false);
  const [created, setCreated] = useState<CreatedLinks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<"buyer" | "seller" | null>(
    null,
  );

  function invalidatePreview() {
    setPreview(null);
    setApproved(false);
    setError(null);
  }

  function updateCriterion(id: string, next: CriterionDraft) {
    setCriteria((current) =>
      current.map((criterion) => (criterion.id === id ? next : criterion)),
    );
    invalidatePreview();
  }

  function changeCriterionKind(id: string, kind: CriterionKind) {
    const current = criteria.find((criterion) => criterion.id === id);
    const next = createCriterion(kind, id);
    updateCriterion(
      id,
      current
        ? { ...next, question: current.question } as CriterionDraft
        : next,
    );
  }

  function addCriterion() {
    if (criteria.length >= PRODUCT_LIMITS.maximumQuestions) {
      return;
    }

    setCriteria((current) => [
      ...current,
      createCriterion("completeness", `q_${crypto.randomUUID()}`),
    ]);
    invalidatePreview();
  }

  function removeCriterion(id: string) {
    if (criteria.length === 1) {
      return;
    }

    setCriteria((current) =>
      current.filter((criterion) => criterion.id !== id),
    );
    invalidatePreview();
  }

  function moveCriterion(index: number, direction: -1 | 1) {
    const target = index + direction;

    if (target < 0 || target >= criteria.length) {
      return;
    }

    setCriteria((current) => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [
        reordered[target],
        reordered[index],
      ];
      return reordered;
    });
    invalidatePreview();
  }

  async function handlePreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Add an evaluation title.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await previewEvaluationContracts(criteria);
      setPreview(result);
      setApproved(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function activateEvaluation() {
    if (!preview || !approved) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const result = await createEvaluation({
        approvedContractSetHash: preview.contractSetHash,
        criteria,
        title,
      });
      setCreated({
        ...result,
        buyerUrl: new URL(result.buyerPath, window.location.origin).href,
        sellerUrl: new URL(result.sellerPath, window.location.origin).href,
      });
    } catch (caught) {
      setError(errorMessage(caught));
      setPreview(null);
      setApproved(false);
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

  if (created) {
    return (
      <section className="terminal-window" aria-labelledby="links-title">
        <TerminalBar path="~/blindsample/capabilities" status="ACTIVE" />
        <div className="terminal-body">
          <CommandLine>activate --approved-contracts</CommandLine>
          <p className="terminal-success">
            seller capability activated · buyer capability sealed
          </p>
          <h2 id="links-title" className="terminal-title">
            Share one link. Keep one link.
          </h2>
          <p className="terminal-copy">
            Each URL contains a different expiring capability in its fragment.
            BlindSample stores only HMAC hashes.
          </p>

          <div className="capability-stack">
            <CapabilityLink
              label="seller://submit"
              description="Can read approved contracts and submit one CSV. Cannot read results."
              value={created.sellerUrl}
              copied={copied === "seller"}
              onCopy={() => copyLink("seller", created.sellerUrl)}
            />
            <CapabilityLink
              label="buyer://results"
              description="Can read status and audit results. Cannot submit or replace data."
              value={created.buyerUrl}
              copied={copied === "buyer"}
              onCopy={() => copyLink("buyer", created.buyerUrl)}
            />
          </div>

          <div className="button-row">
            <a className="button-primary" href={created.buyerUrl}>
              Open buyer view
            </a>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setCreated(null);
                setPreview(null);
                setApproved(false);
                setError(null);
              }}
            >
              New evaluation
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (preview) {
    return (
      <section className="terminal-window" aria-labelledby="review-title">
        <TerminalBar path="~/blindsample/contracts" status="REVIEW" />
        <div className="terminal-body">
          <CommandLine>
            contracts preview --count {preview.contracts.length}
          </CommandLine>
          <h2 id="review-title" className="terminal-title">
            Review the exact scoring rules.
          </h2>
          <p className="terminal-copy">
            No seller link exists yet. Approval is bound to this contract set;
            any edit requires a new review.
          </p>

          <div className="contract-review-list">
            {preview.contracts.map((contract, index) => (
              <article
                key={contract.questionId}
                className="contract-review"
              >
                <header>
                  <span>
                    {String(index + 1).padStart(2, "0")} ·{" "}
                    {contract.method}
                  </span>
                  <code>{contract.contractVersion}</code>
                </header>
                <h3>{contract.originalQuestion}</h3>
                <p>{contract.normalizedCriterion}</p>
                <details>
                  <summary>View scoring details</summary>
                  <dl className="contract-review-grid">
                    <div>
                      <dt>population</dt>
                      <dd>all submitted records · no sampling</dd>
                    </div>
                    <div>
                      <dt>minimum</dt>
                      <dd>
                        {contract.minimumEvidence.records} records ·{" "}
                        {Math.round(
                          contract.minimumEvidence.coverageRatio * 100,
                        )}
                        % coverage
                      </dd>
                    </div>
                    <div>
                      <dt>aggregation</dt>
                      <dd>{contract.aggregationMethod}</dd>
                    </div>
                    <div>
                      <dt>columns</dt>
                      <dd>
                        {contract.requiredColumns.length
                          ? contract.requiredColumns.join(", ")
                          : "CSV headers"}
                      </dd>
                    </div>
                  </dl>
                  <div className="anchor-line" aria-label="Score anchors">
                    {Object.entries(contract.scoringAnchors).map(
                      ([score, meaning]) => (
                        <span key={score} title={meaning}>
                          {score}
                        </span>
                      ),
                    )}
                  </div>
                  <p className="terminal-list-label">required evidence</p>
                  <ul>
                    {contract.requiredEvidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="terminal-list-label">unable to score when</p>
                  <ul>
                    {contract.unableToScoreConditions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>

          <label className="check-row contract-approval">
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            <span>
              I approve these exact contracts and understand every result
              applies only to the submitted records.
            </span>
          </label>

          {error ? (
            <div className="message-wrap">
              <StatusMessage tone="error">{error}</StatusMessage>
            </div>
          ) : null}

          <div className="button-row">
            <button
              type="button"
              className="button-primary"
              disabled={!approved || submitting}
              aria-busy={submitting}
              onClick={activateEvaluation}
            >
              {submitting ? "Activating…" : "Approve & activate links"}
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={submitting}
              onClick={invalidatePreview}
            >
              Edit criteria
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={handlePreview} className="terminal-window">
      <TerminalBar path="~/new-evaluation" status="READY" />
      <div className="terminal-body">
        <CommandLine>start private evaluation</CommandLine>
        <h2 className="terminal-title">Create an evaluation</h2>
        <p className="terminal-copy">
          Start with one question. You can add more before sharing.
        </p>

        <label className="field-group">
          <span className="field-label">Name</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={PRODUCT_LIMITS.maximumTitleCharacters}
            className="text-input"
            placeholder="Customer support sample"
            required
          />
        </label>

        <fieldset className="field-group">
          <div className="field-heading">
            <legend>Questions</legend>
            <span className="field-count">
              {criteria.length}/{PRODUCT_LIMITS.maximumQuestions}
            </span>
          </div>

          <div className="question-list">
            {criteria.map((criterion, index) => (
              <CriterionEditor
                key={criterion.id}
                criterion={criterion}
                index={index}
                onChange={(next) => updateCriterion(criterion.id, next)}
                onKindChange={(kind) =>
                  changeCriterionKind(criterion.id, kind)
                }
                onMove={(direction) => moveCriterion(index, direction)}
                onRemove={() => removeCriterion(criterion.id)}
                canMoveUp={index > 0}
                canMoveDown={index < criteria.length - 1}
                canRemove={criteria.length > 1}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addCriterion}
            disabled={criteria.length >= PRODUCT_LIMITS.maximumQuestions}
            className="button-quiet add-question"
          >
            + add criterion
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
          {submitting ? "Preparing review…" : "Review evaluation"}
        </button>
        <p className="terminal-footnote">
          Nothing is shared until you approve the scoring rules.
        </p>
      </div>
    </form>
  );
}

function CriterionEditor({
  canMoveDown,
  canMoveUp,
  canRemove,
  criterion,
  index,
  onChange,
  onKindChange,
  onMove,
  onRemove,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  canRemove: boolean;
  criterion: CriterionDraft;
  index: number;
  onChange: (criterion: CriterionDraft) => void;
  onKindChange: (kind: CriterionKind) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="question-row criterion-editor">
      <div className="question-row__header">
        <span className="question-index">
          [{String(index).padStart(2, "0")}]
        </span>
        <div className="question-actions">
          <MiniButton disabled={!canMoveUp} onClick={() => onMove(-1)}>
            ↑
          </MiniButton>
          <MiniButton disabled={!canMoveDown} onClick={() => onMove(1)}>
            ↓
          </MiniButton>
          <MiniButton disabled={!canRemove} onClick={onRemove}>
            rm
          </MiniButton>
        </div>
      </div>

      <label className="field-group">
        <span className="field-label">What should we check?</span>
        <select
          className="text-input"
          value={criterion.kind}
          onChange={(event) =>
            onKindChange(event.target.value as CriterionKind)
          }
        >
          {CRITERION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field-group">
        <span className="field-label">Your question</span>
        <textarea
          className="text-area"
          rows={2}
          maxLength={PRODUCT_LIMITS.maximumQuestionCharacters}
          value={criterion.question}
          onChange={(event) =>
            onChange({ ...criterion, question: event.target.value })
          }
          required
        />
      </label>

      <details className="criterion-details">
        <summary>Scoring setup</summary>
        <p>
          These defaults make the result measurable and testable. Adjust them
          if your CSV uses different columns or examples.
        </p>
        <CriterionSettings criterion={criterion} onChange={onChange} />
      </details>
    </div>
  );
}

function CriterionSettings({
  criterion,
  onChange,
}: {
  criterion: CriterionDraft;
  onChange: (criterion: CriterionDraft) => void;
}) {
  switch (criterion.kind) {
    case "completeness":
    case "column_availability":
      return (
        <ColumnsInput
          value={criterion.columns}
          onChange={(columns) => onChange({ ...criterion, columns })}
        />
      );
    case "format_validity":
      return (
        <div className="settings-grid">
          <TextSetting
            label="column"
            value={criterion.column}
            onChange={(column) => onChange({ ...criterion, column })}
          />
          <label className="field-group">
            <span className="field-label">format</span>
            <select
              className="text-input"
              value={criterion.format}
              onChange={(event) =>
                onChange({
                  ...criterion,
                  format: event.target.value as typeof criterion.format,
                })
              }
            >
              <option value="email">email</option>
              <option value="iso_date">ISO date</option>
              <option value="number">number</option>
              <option value="url">URL</option>
              <option value="uuid">UUID</option>
            </select>
          </label>
        </div>
      );
    case "uniqueness":
      return (
        <TextSetting
          label="column"
          value={criterion.column}
          onChange={(column) => onChange({ ...criterion, column })}
        />
      );
    case "date_freshness":
      return (
        <div className="settings-grid">
          <TextSetting
            label="date.column"
            value={criterion.column}
            onChange={(column) => onChange({ ...criterion, column })}
          />
          <NumberSetting
            label="maximum_age_days"
            value={criterion.maximumAgeDays}
            onChange={(maximumAgeDays) =>
              onChange({ ...criterion, maximumAgeDays })
            }
          />
          <TextSetting
            label="reference_date"
            type="date"
            value={criterion.referenceDate}
            onChange={(referenceDate) =>
              onChange({ ...criterion, referenceDate })
            }
          />
        </div>
      );
    case "numeric_range":
      return (
        <div className="settings-grid">
          <TextSetting
            label="numeric.column"
            value={criterion.column}
            onChange={(column) => onChange({ ...criterion, column })}
          />
          <NumberSetting
            label="minimum"
            value={criterion.minimum}
            onChange={(minimum) => onChange({ ...criterion, minimum })}
          />
          <NumberSetting
            label="maximum"
            value={criterion.maximum}
            onChange={(maximum) => onChange({ ...criterion, maximum })}
          />
        </div>
      );
    case "category_coverage":
      return (
        <div className="settings-stack">
          <TextSetting
            label="category.column"
            value={criterion.column}
            onChange={(column) => onChange({ ...criterion, column })}
          />
          <TextSetting
            label="expected_values"
            helper="Comma-separated, case-insensitive categories."
            value={criterion.expectedValues.join(", ")}
            onChange={(value) =>
              onChange({
                ...criterion,
                expectedValues: splitList(value),
              })
            }
          />
        </div>
      );
    case "semantic_relevance":
      return (
        <div className="settings-stack semantic-settings">
          <ColumnsInput
            label="evidence_columns"
            value={criterion.columns}
            onChange={(columns) => onChange({ ...criterion, columns })}
          />
          <TextAreaSetting
            label="approved_target"
            value={criterion.target}
            onChange={(target) => onChange({ ...criterion, target })}
          />
          <p className="terminal-list-label">
            human-reviewed calibration controls
          </p>
          <TextAreaSetting
            label="negative"
            value={criterion.controls.negative}
            onChange={(negative) =>
              onChange({
                ...criterion,
                controls: { ...criterion.controls, negative },
              })
            }
          />
          <TextAreaSetting
            label="intermediate"
            value={criterion.controls.intermediate}
            onChange={(intermediate) =>
              onChange({
                ...criterion,
                controls: { ...criterion.controls, intermediate },
              })
            }
          />
          <TextAreaSetting
            label="positive"
            value={criterion.controls.positive}
            onChange={(positive) =>
              onChange({
                ...criterion,
                controls: { ...criterion.controls, positive },
              })
            }
          />
        </div>
      );
  }
}

function ColumnsInput({
  label = "columns",
  onChange,
  value,
}: {
  label?: string;
  onChange: (columns: string[]) => void;
  value: string[];
}) {
  return (
    <TextSetting
      label={label}
      helper="Comma-separated CSV headers, matched case-insensitively."
      value={value.join(", ")}
      onChange={(next) => onChange(splitList(next))}
    />
  );
}

function TextSetting({
  helper,
  label,
  onChange,
  type = "text",
  value,
}: {
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  type?: "date" | "text";
  value: string;
}) {
  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      <input
        className="text-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      {helper ? <span className="field-helper">{helper}</span> : null}
    </label>
  );
}

function NumberSetting({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      <input
        className="text-input"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        required
      />
    </label>
  );
}

function TextAreaSetting({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      <textarea
        className="text-area"
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}

function MiniButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="button-mini"
      disabled={disabled}
      onClick={onClick}
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
          {copied ? "copied" : "copy"}
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

export function CommandLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="command-line">
      <span>$</span> {children}
    </p>
  );
}

function createCriterion(
  kind: CriterionKind,
  id: string,
): CriterionDraft {
  switch (kind) {
    case "semantic_relevance":
      return {
        columns: ["message"],
        controls: {
          intermediate: "A general product question.",
          negative: "A weather report unrelated to customer support.",
          positive: "A customer asks an agent to fix a billing error.",
        },
        id,
        kind,
        question: "Is this useful for a customer support classifier?",
        target: "Customer support requests requiring an agent response.",
      };
    case "completeness":
      return {
        columns: ["message"],
        id,
        kind,
        question: "Are the required fields complete?",
      };
    case "format_validity":
      return {
        column: "email",
        format: "email",
        id,
        kind,
        question: "Do the submitted values use the expected format?",
      };
    case "uniqueness":
      return {
        column: "id",
        id,
        kind,
        question: "Are identifiers unique?",
      };
    case "date_freshness":
      return {
        column: "created_at",
        id,
        kind,
        maximumAgeDays: 30,
        question: "Are the submitted records recent enough?",
        referenceDate: new Date().toISOString().slice(0, 10),
      };
    case "numeric_range":
      return {
        column: "value",
        id,
        kind,
        maximum: 100,
        minimum: 0,
        question: "Are numeric values within the approved range?",
      };
    case "column_availability":
      return {
        columns: ["id", "message"],
        id,
        kind,
        question: "Are the required columns available?",
      };
    case "category_coverage":
      return {
        column: "category",
        expectedValues: ["positive", "negative"],
        id,
        kind,
        question: "Are the expected categories represented?",
      };
  }
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim());
}

function errorMessage(caught: unknown) {
  return caught instanceof BrowserApiError
    ? caught.message
    : "BlindSample could not complete this operation.";
}
