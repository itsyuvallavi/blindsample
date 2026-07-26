# CipherQuery Execution Plan

Current architecture plan, following:

**Inspection → Mapping → Review → Pre-mortem → Mitigation → Planning → Acceptance**

## 1. Inspection

The former implementation had five paths that conflicted with the product
decision:

- a local deterministic executor answered exact questions without 0G;
- a plan generator could mark a question unable before inference;
- semantic questions ran independently and could consume two requests each;
- semantic failures were converted into partial per-question results; and
- the result UI could display local scores beside a failed 0G question.

Persistence replaced buyer questions with generated plans containing an
ordinary dataset fingerprint. Production logging was already metadata-only,
and the raw sample was already memory-only.

## 2. Mapping

The evaluation boundary is now one atomic server operation:

```text
identify and parse a bounded CSV, JSONL, NDJSON, or flat Parquet sample
        |
package evaluation ID + all questions + all records
        |
make exactly one private 0G request, with no retry
        |
require TEE verification
        |
validate the complete response
        |
valid all-question set? ---- no ----> failed + results:null
        |
       yes
        |
complete + safe aggregate results
```

The model decides how to evaluate each question and makes every semantic or
per-unit judgment. For countable questions, the application only counts the
model's booleans and applies the published rounding rule. It never reads the
sample to make or replace a judgment.

## 3. Review

### Execution

- Every question, including exact percentages, reaches 0G.
- One evaluation always makes at most one inference request.
- `requestVerifiedPrivateCompletion` has no retry loop.
- The response must belong to the submitted evaluation ID.
- Every original question ID must occur exactly once.
- `unable` is a valid model result; request-level failure is not.

### Validation

Scored results require:

- integer score from 0–100;
- exact score definitions for 0 and 100;
- an allowed evaluation-basis unit;
- integer confidence from 0–100;
- one 0G boolean judgment per countable unit;
- application-derived numerator, denominator, and
  `round(numerator / denominator × 100)` for countable results; and
- bounded, aggregate-only evidence.

Unable results require `score`, `numerator`, and `denominator` to be `null`.
Any invalid item rejects the entire response.

### Persistence

Supabase retains the original buyer questions. Completion writes only safe
results, safe diagnostics, counts, and timestamps. Failure atomically writes
`results: null`.

### UI

Only a version `3.0.0` result set with one successful verified 0G request is
displayable. Existing hybrid rows fail closed.

## 4. Pre-mortem

| Failure | Impact |
|---|---|
| Partial or duplicate output | Some questions appear complete when they are not |
| Invented question ID | Model answers a question the buyer did not ask |
| Arithmetic mismatch | Published score contradicts its evidence |
| Missing TEE trace | Privacy and sponsor claims fail |
| 401/403 or timeout | Stale/local score may be mistaken for a result |
| Model copies a cell into evidence | Seller data leaks through persistence or UI |
| Retry or per-question fan-out | Unexpected inference cost |
| Failed retry retains old results | Buyer sees a previous run |
| Legacy hybrid result is rendered | Product violates the 0G-only decision |
| Raw prompt/response reaches logs | Private data is retained |

## 5. Mitigation

| Risk | Mitigation | Evidence |
|---|---|---|
| Partial/extra IDs | Exact one-to-one ID validator | Scoring tests |
| Wrong evaluation | Required top-level evaluation ID | Parser tests |
| Bad arithmetic | Derive only mechanical arithmetic from 0G judgments | Arithmetic test |
| Missing TEE | Client rejects absent/false verification | Client and scoring tests |
| Request failure | Submission calls `fail`, never `complete` | Submission tests |
| Cell leakage | Reject persisted text containing private cell values | Privacy test |
| Parser expansion | Enforce raw, decoded, normalized, row, and column limits before inference | Format tests |
| Cost fan-out | One call site, no retry, hard `1/1` diagnostics | Request-count test |
| Stale results | Claim and failure clear `results` and `completed_at` | Repository code |
| Legacy rows | Runtime atomic-result guard | Buyer source test |
| Logging leak | Allowlisted request metadata only | Observability test |
| Wrong production endpoint | Production requires mainnet Router URL | Config test |

## 6. Planning

### Milestone A — atomic evaluator

Status: complete.

- Add one batch prompt for all questions and records.
- Add strict response parsing and safe evidence validation.
- Remove deterministic, plan, two-pass, and partial-result executors.
- Keep the 0G client non-retrying.

Commit: `a3b72d3 refactor: make 0G evaluation atomic`

### Milestone B — atomic persistence and UI

Status: complete.

- Keep original questions in Supabase.
- Clear stale results when a retry begins.
- Require verified `3.0.0` results before completing or displaying.
- Use the required running, success, and failure messages.
- Display “Evaluated by 0G” on every result.

### Milestone C — documentation and acceptance

Status: complete.

- Align README, plan, and build log.
- Run source scans for removed paths and forbidden environment fallbacks.
- Run lint, TypeScript, non-live tests, and production build.
- Commit documentation separately.
- Push both commits to `main`.

No paid live request is part of this milestone.

## 7. Acceptance

### Required behavior

- [x] Exact percentage questions invoke 0G.
- [x] Multiple questions produce exactly one 0G request.
- [x] 401/403, timeout, invalid JSON, and missing TEE fail the whole run.
- [x] Failed runs publish and display zero scores.
- [x] Every successful result maps to one original question ID.
- [x] Count arithmetic is derived from 0G judgments without local question answering.
- [x] No local question-answering fallback is reachable.
- [x] No raw sample, prompt, response, or copied cell value reaches persistence.
- [x] Every displayed result says “Evaluated by 0G.”
- [x] Production rejects a non-mainnet 0G Router URL.

### Final checks

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] source and secret scans
- [x] clean Git status
- [x] commits pushed to `main`

Live 0G, scoring, and end-to-end suites remain opt-in and require explicit
paid approval.

## 8. Structured sample formats

### Inspection

The original upload boundary accepted only UTF-8 CSV. CSV remains common, but
JSONL/NDJSON is useful for event and model records, while Parquet is common for
analytical exports. Supporting them must not alter scoring, privacy, cost, or
atomic publication behavior.

### Mapping and review

The filename extension selects one strict parser. Each parser returns the same
ordered columns-and-rows representation:

- CSV preserves the existing strict header and row behavior.
- JSONL requires one top-level object per nonblank line, rejects duplicate or
  case-ambiguous keys, preserves large numeric text, and canonicalizes nested
  values.
- Parquet reads metadata before records, accepts flat non-repeated scalar
  schemas with uncompressed or Snappy compression, and preserves 64-bit
  integers.

The normalized representation is passed to the existing one-request evaluator.
The filename and format do not enter the prompt, persistence, logs, or buyer
result.

### Pre-mortem and mitigation

| Failure | Mitigation |
|---|---|
| Renamed invalid file bypasses validation | Parser validates content after extension dispatch |
| Compressed Parquet expands excessively | Metadata-first 1 MB decoded-data limit |
| Different formats produce different judgments | Cross-format normalization equivalence test |
| JSON number precision is lost | Lossless JSON number parsing |
| Nested or encrypted Parquet creates unsafe ambiguity | Fail closed before inference |
| Invalid input spends 0G tokens | Parse and validate before submission is claimed |

### Acceptance

- [x] CSV behavior remains covered by its original tests.
- [x] JSONL, NDJSON, and Parquet have parser and limit tests.
- [x] Equivalent files normalize to identical records.
- [x] Invalid files make zero scoring calls and zero persistence writes.
- [x] Raw values and filenames do not reach persisted completion input.
- [x] The seller UI accepts and labels all supported formats.
- [x] Lint, TypeScript, non-live tests, production build, and production
      dependency audit pass.
- [x] No paid or live 0G request is required for format acceptance.
