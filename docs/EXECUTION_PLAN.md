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
and the raw CSV was already memory-only.

## 2. Mapping

The evaluation boundary is now one atomic server operation:

```text
parse bounded CSV in memory
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
CSV to make or replace a judgment.

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
- [x] No raw CSV, prompt, response, or copied cell value reaches persistence.
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
