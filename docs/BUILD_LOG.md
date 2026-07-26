# CipherQuery Build Log

This log records completed milestones and material decisions. It intentionally
does not contain command transcripts, secrets, raw datasets, or speculative
daily notes.

## 2026-07-25 — Repository foundation

Completed:

- Selected the Best AI Product on 0G track.
- Fixed the MVP around one independent 1–100 score per buyer question.
- Explicitly removed overall scoring, marketplace payments, custom contracts,
  0G Storage, custom enclave deployment, and key release from the MVP.
- Defined the initial Router-based private-inference architecture.
- Added sponsor qualification requirements, implementation phases, acceptance
  criteria, and documentation rules.

Pending:

- Publish the public GitHub repository.
- Configure access to 0G Private Computer.
- Prove a private, TEE-verified inference request before building the UI.

## 2026-07-26 — Full execution review

Added:

- Reworked the execution plan into the required Inspection, Mapping, Review,
  Pre-mortem, Mitigation, Planning, and Acceptance sequence.
- Mapped the buyer and seller pages, API routes, evaluation state machine,
  data flow, trust boundaries, secrets, and repository layout.
- Added Supabase only for questions, capability-token hashes, status, scores,
  and safe 0G trace metadata. Raw CSV storage remains prohibited.
- Defined Vercel Git previews, production promotion, environment separation,
  and post-deployment verification.
- Added risk mitigations, phase gates, small-commit discipline, and a complete
  sponsor-aligned acceptance checklist.

Why:

- The original plan did not describe asynchronous buyer/seller connectivity,
  database authorization, deployment environments, or failure recovery in
  enough detail to execute safely.

Verified:

- Reviewed the current local repository and Git history.
- Rechecked the 0G sponsor requirements and ETHGlobal repository rules.
- Reviewed current Supabase API-key, RLS, Data API exposure, Node.js support,
  and breaking-change guidance.
- Reviewed current Vercel Git deployment and environment-variable guidance.

Still blocked:

- The public GitHub remote requires GitHub CLI reauthentication.
- 0G, Supabase, and Vercel user-owned projects or credentials are not yet
  connected.

## 2026-07-26 — Reproducible application baseline

Completed:

- Published CipherQuery as a public GitHub repository.
- Created the `build/mvp` implementation branch.
- Added Next.js 16.2.12, React 19.2.8, TypeScript, Tailwind CSS, and a Node.js
  22 runtime contract.
- Replaced generator content with a minimal CipherQuery landing route and
  added a non-secret health endpoint.
- Added executable score-boundary tests for the 1–100 product contract.
- Added one GitHub Actions workflow for install, lint, typecheck, tests, and
  production build.
- Removed unused generator assets and agent-specific documentation files.
- Overrode vulnerable production transitive versions of PostCSS and Sharp.

Why:

- Establishes a small, reproducible, sponsor-ready application baseline before
  external service and product-flow code is introduced.

Verified:

- `npm run check`
- 1 test file and 2 tests passed.
- Next.js production build completed with `/` and `/api/health`.
- `npm audit --omit=dev` reports no production vulnerabilities.

Next:

- Add the reusable server-only 0G client and strict verified-response contract
  as a separate commit.

## 2026-07-26 — Private 0G verification

Completed:

- Added a server-only 0G Router client using the platform `fetch` API.
- Forced the `private` provider trust mode on every request.
- Requested `verify_tee: true` on every completion.
- Rejected responses without a positive TEE verification result and complete
  safe trace metadata.
- Added one retry for transient `429` and `503` responses without any
  lower-trust fallback.
- Added unit tests for configuration, routing headers, verification rejection,
  and retry behavior.
- Added an opt-in live test that loads the ignored local environment file.

Why:

- 0G Compute / Private Computer is the load-bearing sponsor integration and
  must fail closed before dataset scoring or UI code depends on it.

Verified:

- `npm run check`
- `npm run test:0g -- --disableConsoleIntercept`
- Live model: `glm-5.2`
- Live provider: `0x7DCFe6AEa70350C2090041524c9B4A9262DCe87D`
- Live request ID: `0e974680-08b3-4d14-913a-287e1f214fb6`
- Router verification result: `tee_verified: true`
- No API key, prompt body, or model response content was logged or committed.

Limitation:

- The `tee_verified` field is verification reported by 0G Router. CipherQuery
  does not independently reproduce the provider-signature verification.

Next:

- Add Supabase metadata persistence and separate buyer/seller capability
  tokens as a new commit.

## 2026-07-26 — CI lockfile portability

Completed:

- Reproduced the GitHub Actions install failure locally with npm 10.9.4.
- Regenerated the lockfile with the same npm release used by the Node.js 22
  workflow.
- Added the previously omitted cross-platform optional dependency records.
- Pinned npm 10.9.4 in the package metadata.

Why:

- The macOS/npm 11 lockfile passed locally but omitted Linux-side dependency
  records required by GitHub's Node.js 22 runner.

Verified:

- `npx npm@10.9.4 ci --ignore-scripts --no-audit --no-fund`
- `npm run check`
- `npx npm@10.9.4 audit --omit=dev`
- Clean install, 7 unit tests, and production build passed.
- Production dependency audit reports zero vulnerabilities.

Next:

- Push this isolated lockfile fix and require a green GitHub Actions result
  before adding Supabase code.

## 2026-07-26 — Private evaluation persistence

Completed:

- Created the user-owned Supabase backend for CipherQuery in `eu-west-1`.
- Created and deployed one reviewed `evaluations` migration.
- Added database checks for status, expiry, capability hashes, sample limits,
  and publication of only complete TEE-verified results.
- Enabled RLS and removed direct `anon` and `authenticated` table grants.
- Added a server-only Supabase client that accepts only current
  `sb_secret_...` keys.
- Added separate 256-bit buyer and seller capabilities and stores only their
  HMAC-SHA256 hashes.
- Added environment-scoped evaluation creation, role-specific reads, an
  atomic submission claim, completion, failure, and retry transitions.
- Created and Git-connected the Vercel project for CipherQuery. Local
  `.vercel` metadata remains ignored.

Why:

- Buyer and seller sessions must coordinate asynchronously without accounts,
  while the private CSV and raw access tokens must never be persisted.

Verified:

- The deployed table has RLS enabled and contains no rows.
- `anon` and `authenticated` cannot select or insert.
- `service_role` retains the server operations required by the application.
- Supabase security and performance advisors returned only expected
  informational notices for the deliberately policy-free locked table and its
  unused new index.
- Capability and Supabase configuration tests pass without real secrets.

Pending user-owned configuration:

- Add the Supabase `sb_secret_...` key and a random 32-or-more-character
  `ACCESS_TOKEN_PEPPER` to `.env.local` and the Vercel project.

Next:

- Run live server CRUD and role-separation checks, then build the strict
  question-to-score pipeline.

## 2026-07-26 — Live persistence verification

Completed:

- Added an opt-in live Supabase integration test.
- Verified separate buyer and seller capabilities against the deployed table.
- Verified that two concurrent seller claims produce exactly one winner.
- Verified completion with two independent scores and a TEE-verified trace.
- Verified that raw capabilities are not stored and that test rows are removed.
- Added all required 0G, Supabase, and capability variables to Vercel
  Production and Preview; credentials are stored as sensitive values.

Why:

- The persistence milestone is not complete until authorization, concurrency,
  state transitions, and cleanup work against the owned cloud project.

Verified:

- `npm run test:supabase`
- One live integration test passed.
- The `evaluations` table returned to zero rows after cleanup.
- Vercel lists all six required variables for Production and Preview without
  exposing their values.

Next:

- Implement the strict CSV-to-question-score pipeline as a separate commit.

## 2026-07-26 — Current CI action runtimes

Completed:

- Updated GitHub checkout and Node setup actions from v4 to v6.
- Kept application verification pinned to Node.js 22 and npm 10.9.4.

Why:

- GitHub's hosted runner warned that the v4 action wrappers still targeted the
  deprecated Node.js 20 runtime.

Verified:

- The preceding application workflow passed; this isolated update will be
  verified by its own push and pull-request checks.

## 2026-07-26 — Strict independent scoring

Completed:

- Added the pinned `csv-parse` parser without the larger CSV package bundle.
- Added strict evaluation-title and question validation.
- Added in-memory UTF-8 CSV parsing with 200 KB, 200-row, and 20-column limits.
- Preserved cell values while trimming and validating headers.
- Added a fixed scoring prompt that treats cells as untrusted data, forbids
  disclosure, and requests one independent integer score per exact question ID.
- Added a strict response parser that rejects prose, extra keys, explanations,
  overall scores, missing or duplicate IDs, decimals, and out-of-range values.
- Added one corrective retry for malformed output with no lower-trust fallback.
- Added seller-submission orchestration with an atomic claim, safe failure
  codes, TEE-gated completion, and no raw-sample persistence.
- Added an opt-in real two-question 0G scoring test.

Why:

- The product promise depends on converting a private sample into exact
  question-level numbers without allowing model-format drift or raw-data
  persistence.

Verified:

- 10 unit-test files and 44 tests pass; live tests remain opt-in.
- Lint and typecheck pass.
- Both the new scoring live test and the unchanged minimal 0G live proof were
  attempted. Each returned HTTP 401 before model execution, confirming that
  the current inference credential must be refreshed rather than indicating a
  prompt or parser failure.

Next:

- Match the replacement key to its 0G network and rerun the live proofs.
- Build the buyer and seller API routes and pages.

## 2026-07-26 — Capability-scoped application API

Completed:

- Matched the replacement testnet Router key to 0G's separate testnet API
  endpoint.
- Added evaluation creation with strict JSON validation and separate buyer and
  seller paths whose tokens remain in URL fragments.
- Added role-aware evaluation reads using bearer capabilities and uncached
  responses.
- Added a bounded multipart seller upload route that passes one CSV sample
  directly to the in-memory scoring pipeline.
- Added safe HTTP mappings for invalid input, unavailable links, concurrent
  submissions, scoring failures, and persistence failures.
- Added request-size checks and rejected undeclared form fields.

Why:

- The browser pages need a narrow server boundary that preserves role
  separation and never exposes internal errors, raw samples, prompts, or
  secrets.

Verified:

- The original mainnet request rejected the testnet key with HTTP 401.
- The official testnet endpoint authenticated the same key and returned HTTP
  402, proving that Router funding is now the remaining live-inference gate.
- 11 unit-test files and 52 tests pass; three live suites remain opt-in.
- Lint, typecheck, and the production build pass with all three evaluation
  routes compiled as dynamic Node.js handlers.

Next:

- Fund the testnet Router balance and rerun both live 0G proofs.
- Build the buyer creation, seller submission, and buyer results pages.

## 2026-07-26 — Buyer and seller product flow

Completed:

- Replaced the static landing route with the working buyer evaluation form.
- Added question creation, removal, reordering, limits, loading, errors, and
  separate buyer and seller capability links.
- Added the seller page with buyer-question review, bounded CSV selection,
  explicit privacy consent, safe retry behavior, and no raw-row preview.
- Added buyer polling with waiting, processing, failed, and complete result
  states.
- Added question-level score rendering without an overall score or progress
  bars.
- Added the safe 0G trace panel and a qualified explanation of Router-reported
  TEE verification.
- Rebuilt the interface around the Hallmark Lumen reference using the
  Workbench macrostructure, a night-foundry palette, Instrument Serif,
  blueprint rules, and a purpose-built private-compute topology.
- Added visible TLS, 0G private TEE, and no-CSV-storage security rails across
  buyer creation and seller submission.
- Added no-index metadata, no-referrer headers, and restrictive browser
  security headers for every route.

Why:

- These three screens turn the verified scoring pipeline into a real
  two-party product while preserving the agreed privacy and numerical-output
  contract.

Verified:

- 12 unit-test files and 57 tests pass; three live suites remain opt-in.
- Lint, typecheck, and production build pass.
- Browser-tested evaluation creation, fragment-only role links, buyer waiting,
  seller question review, CSV selection, privacy-consent gating, safe scoring
  failure, and buyer failure state.
- The 320, 375, 414, 768, and 1280-pixel layouts have no horizontal overflow
  or wrapped clickable labels.
- The primary buyer action is visible within a 1280 by 800 first viewport.
- The Hallmark slop gates and WCAG contrast pairs pass; the lowest reviewed
  muted-text pair measures 5.70:1.
- Browser console checks returned no errors.
- Private pages emit `noindex, nofollow` and `Referrer-Policy: no-referrer`.
- Deleted the synthetic browser-test evaluation and confirmed the Supabase
  table returned to zero rows.
- Committed the complete UI milestone as `53397cf` and pushed it to
  `build/mvp`.
- Updated all six Vercel Preview variables from the local testnet
  configuration without exposing their values.
- Deployed the exact committed worktree to a protected Vercel preview.
- Confirmed the deployed health route returns HTTP 200 with the expected
  security headers.
- Confirmed the deployed creation API persists an evaluation and returns
  separate fragment-only buyer and seller paths.
- Deleted that isolated Vercel verification evaluation, confirmed Supabase
  returned to zero rows, and found no preview runtime warnings or errors.

Next:

- Fund the testnet Router balance, rerun both live proofs, and complete one
  successful end-to-end browser evaluation.

## 2026-07-26 — Defensible evaluation contracts

Completed:

- Replaced the earlier model-direct scoring path with buyer-approved,
  versioned evaluation contracts.
- Enforced 1–50 parsed CSV records, excluding the header and preserving quoted
  embedded newlines without truncation.
- Added deterministic scoring for completeness, format validity, uniqueness,
  freshness, numeric ranges, column availability, and category coverage.
- Changed semantic inference to return only per-record rubric labels.
- Added buyer-authored targets plus human-reviewed negative, intermediate, and
  positive controls.
- Added a repeated canonical-subset classification, 80% agreement threshold,
  80% evidence-coverage threshold, and three-record semantic minimum.
- Added `unable_to_score` for insufficient evidence, failed controls,
  instability, invalid output, or unverified 0G execution.
- Added a SHA-256 contract-set hash so link activation is bound to the exact
  contract set the buyer reviewed.
- Migrated Supabase from `questions` and `scores` to approved `contracts` and
  structured `results`, with per-result 0G traces.

Why:

- Privacy and TEE verification do not make an AI judgment accurate. A score
  must be grounded in an approved rubric, exact evidence rules, calibration,
  and fail-closed behavior.
- Exact arithmetic belongs in deterministic application code, not a language
  model.

Verified:

- Boundary tests cover zero, one, fifty, and fifty-one records, header
  exclusion, quoted newlines, and no truncation.
- Reliability tests cover known objective fixtures, missing evidence,
  control failure, unstable output, row order, irrelevant columns,
  prompt-injection cells, and false TEE verification.
- N accepted contracts produce N result records and no overall score.
- The new migration is deployed to the owned Supabase project.
- Live role separation, one-winner concurrent claim, structured persistence,
  token-hash storage, and cleanup passed against the deployed schema.
- Commits `16e8f36` through `fecb1da` were pushed independently to
  `build/mvp`.

Supersedes:

- The earlier “Strict independent scoring” model-direct prompt and
  model-selected score contract.
- The earlier 200-row limit. The current product contract is 1–50 parsed data
  records.

## 2026-07-26 — Clean Terminal product interface

Completed:

- Replaced the dense Lumen workbench with the Hallmark Terminal/Cobalt
  developer-tool direction.
- Reduced the landing screen to one promise, one creation card, and three
  short steps.
- Moved scoring configuration, full contract rules, and result audit evidence
  behind progressive disclosures.
- Kept private 0G execution, separate capabilities, and the absence of an
  overall score visible without overwhelming the primary flow.
- Updated buyer, seller, and result states for approved contracts and
  structured result evidence.

Why:

- The product must feel safe and understandable to a non-technical buyer.
  Security detail should be available on demand instead of competing with the
  main action.

Verified:

- Browser review confirmed the simplified creation and contract-review states.
- TypeScript, lint, 78 unit tests, and the production build pass.
- No secret-like values appear in the UI diff.
- Committed and pushed as `2c64925 feat: simplify the private terminal
  workflow`.

Next:

- Refresh the protected Vercel Preview from the exact pushed branch.
- Rerun the opt-in 0G and calibrated semantic live tests with the current
  funded testnet key.
- Complete one successful synthetic end-to-end browser evaluation.

## 2026-07-26 — Acceptance run and repeatable live lifecycle test

Completed:

- Added an opt-in live lifecycle test covering contract preview, exact-hash
  activation, separate capabilities, seller submission, buyer results, and
  seller result denial.
- Added automatic cleanup that removes the synthetic evaluation after success
  or failure without printing raw capability tokens.
- Reran the deployed Supabase authorization, concurrency, persistence, and
  cleanup test.
- Completed a current private, TEE-verified 0G request.
- Completed the current calibrated two-pass semantic scoring test.
- Pushed the lifecycle test as `2583f25 test: cover the live evaluation
  lifecycle`.
- Confirmed the Git-connected Vercel Preview deployed exact commit
  `2583f25ba01caff95943490f4f9262c65c73fa0c`.
- Confirmed Preview status `READY`, Next.js detection, health HTTP 200, and
  the configured CSP, no-referrer, no-frame, no-sniff, permissions, transport,
  and no-index headers.
- Found no build errors and no error/fatal runtime logs for the deployment.

Verified:

- `npm run check`: 78 unit tests pass; four opt-in live suites remain skipped
  during normal CI.
- `npm run test:supabase`: pass.
- `npm run test:0g`: pass before the remaining testnet balance was consumed.
- `npm run test:scoring`: pass before the remaining testnet balance was
  consumed.
- Protected Vercel preview: verified.

Blocked:

- The final synthetic end-to-end submission now receives HTTP 402 from 0G.
  The same key successfully authenticated and completed the two preceding live
  suites, then its Router balance was exhausted.
- The application records the safe `zero_g_unavailable` state, returns HTTP
  502 to the seller, publishes no result, and the live test removes its
  synthetic row.

Needed:

- Top up the current 0G testnet Router balance, then run `npm run test:e2e`.

## 2026-07-26 — Mainnet semantic diagnostic

Completed:

- Consolidated runtime configuration around one server-only 0G inference key.
- Selected mainnet `glm-5.2` after the Router API rejected the dashboard-listed
  OGM models with HTTP 403 and omitted them from the authenticated model
  catalog.
- Ran the hard-capped original-pass semantic diagnostic with no retry.
- Received a TEE-verified response that passed strict JSON parsing, returned
  all five classifications, and passed every calibration control.
- Updated the checked-in environment example and client fallback to the
  verified mainnet Router configuration.

Verified:

- The diagnostic made exactly one successful inference request.
- The full local suite passes: 98 tests passed and five opt-in live suites
  remained skipped.
- TypeScript and lint pass.

Remaining:

- Run the two-pass semantic acceptance test only under a separately approved
  two-request budget.
- Run the browser evaluation after restarting the local development server.

## 2026-07-26 — Five-scenario multi-question matrix

Completed:

- Added five synthetic end-to-end scenarios with at least two independent
  question results per dataset.
- Covered 13 question results: five deterministic completeness questions and
  eight semantic questions.
- Capped each evaluation at four inference requests and the full matrix at 16
  requests. The 0G client remains configured with no automatic retry.
- Ran the matrix once against the real API handlers, Supabase persistence, and
  private 0G scoring path.
- Verified during the run that the first four evaluations reached `complete`,
  accounting for 12 inference requests and ten question results.
- Observed four HTTP 200, TEE-verified `glm-5.2` responses for the first
  scenario. Each response finished with `stop`.
- Verified after the run that no synthetic `Semantic matrix:` evaluations
  remained in Supabase.

Limitation:

- The command continued in a background shell after its output stream
  detached. The test cleanup completed, but the final sanitized result table
  and process exit code were not retained.
- Because the synthetic rows were intentionally deleted, the final scores,
  total request count, and total cost cannot be reconstructed. This run is not
  claimed as a passing acceptance result, and it must not be rerun without a
  new explicit paid-run approval.

Mitigation:

- The matrix command now writes its sanitized summary to
  `tmp/semantic-e2e-report.json` before assertions and cleanup.
- The report path is constrained to the ignored `tmp/` directory. It contains
  question IDs, expected and actual scores, control labels, request counts,
  TEE status, and aggregate cost, but no dataset rows, capability tokens, or
  credentials.
- Committed and pushed the scenario harness as `ea8686d` and durable report
  capture as `808b18d`.

Verified:

- `npm run check` passes after the report-capture change: lint, TypeScript, 102
  unit tests, and the production build.

## 2026-07-26 — One-question UI scoring proof

Inspection:

- Ran the real browser workflow from buyer setup through seller CSV submission
  and private buyer results.
- Used one semantic question and five synthetic rows equal to the approved
  positive customer-support example.

Initial result:

- The UI safely published `UNABLE` instead of a misleading numeric score.
- Both private `glm-5.2` requests returned HTTP 200, TEE verification, valid
  structured output, and 100% record agreement.
- The negative and positive controls passed on both requests.
- The original default intermediate control, `A general product question.`,
  was consistently classified as `weak` instead of the required
  `intermediate`.
- The exact cause was therefore an incorrectly calibrated product default, not
  output parsing, inference instability, or record classification.

Mitigation:

- Centralized the default semantic contract in
  `src/lib/evaluation-contracts/default-semantic.ts`.
- Replaced the ambiguous intermediate example with a previously verified
  mixed example that may be answered by documentation or an agent.
- Reused the same default in the live API flow and added a regression test so
  the rejected control cannot silently return.
- Committed the fix as `ba68feb fix: calibrate default semantic control`.

Acceptance:

- Repeated the complete UI flow with the corrected contract.
- The private buyer page displayed `100/100` for the single approved question.
- Five of five records were evaluated with 100% coverage.
- Negative, positive, and intermediate controls all matched their expected
  labels on both passes.
- Repeated-classification agreement was 100%.
- Exactly two inference requests were made. Both used `glm-5.2`, returned HTTP
  200 with `stop`, were TEE verified, and used attempt 1 with no retry.
- Usage was 1,662 total tokens: 1,328 prompt and 334 completion.
- Reported cost was `0.008950328 0G`.
- The unsuccessful synthetic evaluations were removed. The successful buyer
  result remains available temporarily for visual review through its private
  capability and expires automatically.

## 2026-07-26 — UX proof-plan implementation

Inspection:

- Rechecked the six UX findings against the buyer builder, review state,
  seller submission, buyer results, shared frame, and responsive styles.
- Preserved the existing scoring, capability-token, Supabase, and 0G request
  boundaries. This slice made no live 0G inference request.

Mapping:

- Mapped semantic-contract safety and draft recovery to the buyer builder and
  new browser-draft helpers.
- Mapped role clarity and link ownership to the shared frame and the three
  buyer/seller surfaces.
- Mapped score meanings, previews, controls, and motion to the review state
  and global styles.

Review:

- Identified stale semantic approval as the highest-risk failure: a buyer
  could edit a question while retaining an unrelated target and examples.
- Limited browser persistence to draft title, criteria, and semantic review
  fingerprints. CSV contents, results links, seller links, and capability
  tokens are never placed in the draft store.
- Kept preview content static so opening a preview cannot invoke 0G or create
  an evaluation.

Pre-mortem:

- A restored draft could overwrite a newer edit during hydration.
- An approved semantic contract could remain approved after a material edit.
- A preview could accidentally call a paid endpoint.
- Small controls or source-order choices could fail on mobile.
- Motion could ignore reduced-motion preferences.

Mitigation:

- Added schema-validated, versioned draft persistence with delayed hydration,
  explicit discard, and tests for rejected private or malformed fields.
- Added semantic-contract fingerprints. Editing the question, columns, target,
  or score anchors marks the contract as needing review.
- Added a deterministic guard that rejects a changed question when the
  untouched customer-support scoring setup remains in place.
- Added static seller/results previews, 44px minimum controls, task-first
  mobile ordering, transform/opacity-only transitions, and a reduced-motion
  override.

Planning and implementation:

- Commit `eaeeb96` adds semantic review gating and privacy-safe draft recovery.
- Commit `12c1638` clarifies the journey, roles, score meanings, controls,
  previews, cost boundary, and restrained motion.
- Kept the implementation inside existing product components plus three small
  single-purpose helpers/tests; no new service or dependency was introduced.

Acceptance:

- `npm run lint`, `npm run typecheck`, and the full non-live test suite pass:
  111 tests passed and six opt-in live suites remained skipped.
- `npm run build` completed successfully.
- Local browser testing confirmed that changing the default semantic question
  while leaving the customer-support rubric untouched is rejected with an
  explicit explanation.
- The reviewed state shows the 1, 50, and 100 meanings without hover, plus all
  five technical score anchors when expanded.
- Seller and buyer-result previews are marked `Example only` and open without
  network evaluation.
- A changed draft survived a page reload with its review marked stale, then
  was removed with `Discard draft`.
- At 375px, the builder appears before marketing content, horizontal overflow
  is zero, summaries are 48px high, and action buttons are at least 44px high.
- Desktop and mobile viewport screenshots were visually reviewed. The
  browser's full-page mobile capture produced an empty raster, so acceptance
  relied on the rendered live viewport, normal mobile screenshot, DOM order,
  and measured layout instead.

## 2026-07-26 — Question-only evaluation planning

Inspection:

- Confirmed that buyer-authored immutable contracts were stored before any CSV
  existed and were passed directly into scoring during seller submission.
- Confirmed the default semantic constructor hard-coded `message` and
  customer-support controls.
- Confirmed deterministic and semantic scoring rejected missing required
  columns before any 0G call, which made an unrelated saved plan permanently
  incompatible with a new dataset.

Mapping:

- Evaluation creation now stores only an evaluation name and question IDs/text.
- Seller submission parses the real CSV before generating any technical plan.
- Generated plans are fingerprinted to the exact question and parsed sample,
  validated against the real headers, then passed to scoring.
- Completion replaces the question JSON in the existing audit column with the
  generated plans; no schema migration or raw-row persistence was required.

Review:

- The plan generator is deterministic application code. It recognizes exact
  completeness and uniqueness requests, maps question terms and aliases to
  real headers, and infers text-bearing evidence only when necessary.
- Semantic plans contain internal fields, controls, confidence, score
  meanings, evidence requirements, and a record-level rubric. The model can
  return labels only; application code still calculates the final score.
- Objective-only evaluations are allowed and make zero 0G requests.

Pre-mortem:

- A stale plan could be reused after a question or sample changed.
- A generated plan could hallucinate a nonexistent header.
- A preflight failure could still consume a private inference request.
- All-unable results could misleadingly imply that the dataset failed.
- Retained live-test fixtures could silently continue using the retired
  buyer-authored contract API.

Mitigation:

- Added question and dataset fingerprints to every generated plan.
- Added plan validation before the request budget is created or consumed.
- A missing-column plan is regenerated once with the real headers; a second
  invalid plan becomes a plain-language unable result without inference.
- Semantic evidence coverage is checked before inference.
- Replaced the all-unable badge with `NO SCORES PRODUCED`, an explanation that
  this does not mean the dataset failed, and an explicit AI-request indicator.
- Migrated opt-in live fixtures to name-plus-question creation while keeping
  every live suite disabled by default.

Planning and implementation:

- Commit `2512fd4` replaces buyer-authored contracts with submission-time
  planning, removes the saved `message` default, and simplifies buyer/seller
  surfaces.
- Commit `c8ad93f` adds focused question-only, BTC planning, invalid-plan,
  zero-request, semantic audit, and all-unable presentation regressions.

Acceptance:

- Lint and TypeScript pass.
- 119 local tests pass; six paid/live suites remain skipped.
- The production build passes. One combined `npm run check` build attempt hit
  intermittent Google Fonts DNS, and an immediate standalone build completed.
- The clean five-row BTC fixture maps the completeness question to
  `timestamp, open, high, low, close, volume` and returns `100` in code.
- The BTC context question maps to
  `symbol, open, high, low, close, market_context` and uses mocked private
  per-record judgments to produce an auditable score.
- Neither generated BTC plan contains `message` or customer-support controls.
- An invalid plan is rejected before the mocked 0G requester is called.
- Local rendered-browser inspection found one name field, plain-text question
  fields, zero selectors, and none of the retired scoring-configuration labels.
- No live 0G request or paid end-to-end test was run.

Production handoff:

- Vercel deployed commit `4dde769` from `main` to production with status
  `READY`.
- Created a completely new production evaluation,
  `f703eb2f-0b8e-4db7-9321-8901750d0f80`, containing the two BTC acceptance
  questions. No legacy evaluation contract or link was reused.
- The rendered handoff exposed separate seller and private-results capability
  links. Their secret tokens are intentionally not stored in the repository or
  this log.
- Link creation made no 0G inference request. No CSV was submitted and no paid
  end-to-end test was run.

## 2026-07-26 — Private-compute error-state correction

Inspection:

- The production BTC run generated the correct deterministic and semantic
  plans. The deterministic question scored `100`.
- The semantic question passed plan and evidence preflight, then made one
  original-pass request. 0G returned HTTP `401` in 93 ms with no model,
  provider, TEE trace, token usage, or reported cost.
- Because the original pass failed, CipherQuery correctly did not make the
  repeat-agreement request.
- The scorer caught the request error and converted it into
  `unable_to_score` with zero-valued evidence, while the run-level diagnostics
  retained the real request. This caused the result card to incorrectly say
  that no 0G call was needed.

Mapping:

- `scored` means a real integer from 1–100 was calculated.
- `unable_to_score` means the question or submitted evidence cannot support a
  safe answer.
- `error` means private-compute execution failed. Records evaluated and
  coverage are unavailable, not zero.
- One semantic question is sent as one packaged set of records plus one
  sequential repeat-agreement package. It is never one request per record.

Review:

- The 401 was unrelated to batching, row count, the generated plan, or the
  model's semantic judgment. The model never received an authorized request.
- Vercel production contained the expected 0G variable names, but the deployed
  credential was rejected by the Router.
- Existing completed rows must remain immutable, so legacy
  `model_or_verification_failed` results are normalized from their stored
  request diagnostics at display time.

Pre-mortem:

- A provider failure could continue to look like `0%` dataset coverage.
- A configuration failure could incorrectly imply that a model request was
  made.
- A stored legacy result could remain misleading after the code fix.
- A retry or per-record fan-out could unexpectedly increase paid calls.
- Raw provider bodies or private submitted records could leak into the audit.

Mitigation:

- Added a typed, sanitized execution-error object with error code, HTTP status,
  outcome, and whether a request was actually made.
- Error evidence stores `null` for records evaluated and coverage.
- Added legacy normalization using the existing allowlisted request audit.
- Kept the no-retry client and sequential two-pass request budget.
- Added mocked 401 and packaged-request regressions without logging request
  content, secrets, or raw records.
- Updated the three Vercel production 0G variables from the active local
  configuration. Values were never printed or committed.

Planning and implementation:

- Commit `bfd3410` introduces the execution-error model, legacy normalization,
  provider-error mapping, and mocked regression coverage.
- Commit `fc31d5e` renders errors as `ERROR / not scored`, displays `N/A`
  evidence, and removes the false no-call message.
- Commit `0aa8691` classifies empty, malformed, and truncated model output as
  execution errors rather than evidence failures.
- Commit `ff7a227` documents request packaging and the three distinct result
  states.

Acceptance:

- Focused error, packaging, presentation, and source-contract tests pass.
- Lint and TypeScript pass.
- The full local suite passes: 124 tests passed and all six opt-in live suites
  remained skipped.
- The combined check reached the production build but encountered the known
  intermittent Google Fonts DNS failure. One immediate standalone production
  build completed successfully.
- No live 0G request or paid inference test was run.

## 2026-07-26 — Atomic 0G-only evaluation

Inspection:

- Identified the local deterministic executor, pre-inference unable path,
  two-request semantic executor, partial publication behavior, generated-plan
  persistence, and legacy partial-result UI.
- Confirmed production logging already retained only allowlisted request
  metadata and never request or response content.

Mapping and review:

- Replaced the hybrid flow with one request containing the evaluation ID, all
  buyer questions, CSV headers, and every bounded parsed row.
- The model now returns one strict result per question. Application code only
  validates schema, IDs, arithmetic, privacy, and verification.
- Supabase keeps the original questions and stores only safe aggregate results
  after complete validation.

Pre-mortem and mitigation:

- Partial, duplicate, invented, wrong-evaluation, arithmetically inconsistent,
  unverified, or cell-copying output rejects the entire result set.
- A failed request writes `failed` and `results: null`; no local, partial, or
  previous score is displayable.
- Removed retry/fan-out configuration and hard-coded one request per
  evaluation.
- Production now rejects any 0G base URL other than the mainnet Router.

Planning and implementation:

- Commit `a3b72d3` removes the deterministic, plan-generation, two-pass,
  fallback, partial-presentation, and obsolete diagnostic paths.
- Added a versioned atomic result schema, one-request prompt, strict validator,
  safe persistence guard, and required 0G provenance UI.

Acceptance so far:

- Lint and TypeScript pass.
- 79 non-live tests pass; four opt-in live suites remain skipped.
- Exact percentage, multi-question single-call, 401, invalid JSON, missing TEE,
  arithmetic, evidence privacy, one-to-one IDs, safe logging, and production
  endpoint tests pass.
- The production build passes with Next.js 16.2.12 using webpack. External
  Google Fonts were removed so builds no longer depend on font-network access;
  the Terminal UI uses explicit local system font stacks.
- Commits `a3b72d3`, `d4abd98`, and `1217e87` were pushed to `main`.
- No live or paid 0G request was made.

## 2026-07-26 — Seller and buyer UX simplification

Inspection:

- The seller page mixed upload instructions, infrastructure copy, and terminal
  controls across two columns.
- CSV validity was checked only after submission except for the file-size
  limit.
- The buyer API returned sample row/column counts and complete model evidence,
  allowing the buyer to infer the seller's submitted sample size.

Mapping and review:

- Replaced the seller page with one centered task flow: buyer questions, CSV
  choice, free local preflight, sample consent, and one private-evaluation CTA.
- Replaced terminal-style buyer results with one simple card per question, a
  clear no-overall-score statement, and a compact 0G verification summary.
- Moved buyer privacy enforcement to the repository response boundary so old
  and new links receive the same count-free view.

Pre-mortem and mitigation:

- A hidden API field could leak sample size even if CSS hides it: buyer views
  no longer contain row/column counts, arithmetic, row numbers, or aggregate
  evidence.
- A malformed CSV could spend tokens before the seller understands the
  problem: the browser now runs the same bounded parser before enabling the
  CTA and every local error states that no 0G request was made.
- An all-unable run could imply dataset failure: it now says “No scores were
  produced” and explicitly explains that this is not a failed requirement.
- A failed run could appear complete: only a complete verified result set is
  sanitized and returned to the buyer.

Planning and implementation:

- Commit `e5247a4` contains the seller flow, buyer results, privacy boundary,
  responsive styles, and regression tests.
- A follow-up acceptance slice adds the seller-only completion summary:
  records evaluated, questions completed, unable count, and private-inference
  use. These values are never added to the buyer view.
- No live 0G request was made.

Acceptance:

- Lint and TypeScript passed.
- All 87 non-live tests passed; four opt-in live suites remained skipped.
- The production build passed.
- Local browser verification confirmed the seller page loads without an error
  overlay or horizontal overflow, the free preflight reported the expected
  record/column/header summary, consent gates the CTA, and the buyer waiting
  state exposes no record-count label.
- Desktop visual inspection passed. A 390 px DOM/layout check reported no
  horizontal overflow; the browser's mobile full-page screenshot renderer
  returned a blank capture even though the rendered DOM remained populated.
- The temporary evaluation used for browser verification was deleted from
  Supabase and a follow-up query confirmed zero matching rows.

## 2026-07-26 — 0G output allowance increase

Inspection:

- A verified one-request evaluation with three questions and five rows received
  HTTP 200 from 0G but ended with `finish_reason: length`.
- The request used its full 1,780-token output allowance, leaving the strict
  JSON response incomplete and therefore correctly unpublished.

Mitigation:

- Increased the existing output-token formula and hard ceiling by 10×.
- The same three-question, five-row evaluation now permits 17,800 output
  tokens; the ceiling is now 40,960.
- Preserved the atomic one-request rule. No retries or additional inference
  requests were added.

Acceptance:

- Added regression coverage for the 17,800-token case and the 40,960-token
  ceiling.
- Targeted tests, TypeScript, and lint pass.
- No live or paid 0G request was made.

## 2026-07-26 — Staged 0G reliability and quality loop

Inspection:

- Ten paid E2E scenarios reached 0G successfully: every request returned HTTP
  200, `finish_reason: stop`, and verified TEE provenance.
- Seven responses passed strict validation and published 14 question results.
  All 14 published scores exactly matched the benchmark expectations.
- Three responses were rejected as `zero_g_invalid_response`. They were not
  timeouts or token-limit failures, but the stored diagnostics did not identify
  the exact safe validator reason.

Mapping and review:

- Enumerated the response validator's envelope, question ID, result shape,
  arithmetic, evidence, privacy, and numeric rejection paths.
- Kept atomic publication: one invalid question still fails the whole
  evaluation and publishes zero scores.
- Added a typed, privacy-safe output-validation status and failure code to
  diagnostics. Raw prompts, rows, cell values, and model responses remain
  excluded from persistence and logs.

Pre-mortem and mitigation:

- Automatic retries could spend tokens without improving the prompt: every
  scenario still has exactly one attempt.
- Large batches obscure the cause and waste calls: the default paid cycle now
  runs only the three previously failing scenarios.
- A parser failure could be mistaken for poor scoring: integration completion
  and expected-score accuracy are reported separately.
- Relaxing validation could leak private values or accept broken arithmetic:
  validation remains strict; the prompt now includes an explicit final schema,
  arithmetic, unique-row, and privacy checklist.

Planning:

- `test:e2e` runs the three-scenario baseline.
- `test:e2e:hard` runs three interval/semantic-quality scenarios only after the
  baseline passes.
- `test:e2e:full` retains the ten-scenario sweep only after both smaller tiers
  pass.
- Every tier has a hard request-count guard, no retries, exact score
  expectations, aggregate quality output, and per-scenario Supabase cleanup.

Acceptance:

- Lint, TypeScript, 91 non-live tests, and the production build pass.
- Commits `2cb2f2a` and `9153af2` were pushed to `main`.
- No additional paid 0G request was made while implementing this repair.

## 2026-07-26 — Exact-score reliability acceptance

Inspection and mitigation:

- Reproduced schema, truncation, duplicate-detection, semantic-consistency,
  countability, and cross-column judgment failures in progressively harder
  paid tiers.
- Kept exactly one 0G request per evaluation and no automatic retry.
- Switched countable results to 0G per-unit boolean judgments. The application
  performs only safe counting and rounding; it never answers a buyer question
  from the CSV.
- Forced structured function output, retained model reasoning for cross-row
  checks, isolated each question to its referenced columns, and normalized
  persisted prose to aggregate-only summaries.
- Added seeded adversarial generators and a maximum-size, five-question stress
  case containing prompt-injection text.

Acceptance:

- Baseline: 3/3 datasets and 6/6 independently expected scores matched.
- Hard: 3/3 datasets and 6/6 expected scores matched.
- Seeded adversarial: 3/3 datasets and 9/9 expected scores matched.
- Maximum-size stress: 1/1 dataset and 5/5 expected scores matched.
- Combined accepted accuracy evidence: 26/26 exact question scores. Every
  scenario used one verified 0G request and no retry.
- A final real-browser seller-to-buyer run packed two questions into one
  verified request and displayed the independently expected 75/100 and 50/100
  results. The buyer view exposed neither raw cell values nor sample size,
  labeled both results “Evaluated by 0G,” and produced no browser errors.
- The synthetic browser evaluation was deleted from Supabase after the check.
- The free suite passes with 108 tests; six paid/live suites remain skipped by
  default. Lint, TypeScript, and the production build pass.

## 2026-07-26 — Premium public site and focused role flows

Inspection:

- The public homepage mixed product explanation and buyer setup in one dense
  terminal-style workbench.
- Monospace display type, repeated command-line chrome, inline previews, and
  legacy CSS made the product feel technical without making the workflow
  clearer.
- Seller and buyer pages were functionally focused, but shared the same visual
  shell as marketing and repeated several explanations.
- Source mapping found an unreferenced security-rail component and roughly 30
  legacy CSS selectors with no matching UI usage.

Mapping and implementation:

- Split public explanation, buyer setup, and documentation across `/`, `/new`,
  and `/docs`.
- Added separate public and task shells. Capability pages contain no public
  navigation, reducing the chance that a seller or buyer leaves a private
  session accidentally.
- Rebuilt the homepage around one primary action, an explicitly illustrative
  result preview, a three-step workflow, and concrete privacy proof.
- Removed question ordering controls, terminal furniture, and buyer-side
  experience previews from the evaluation builder.
- Simplified the seller and buyer presentation while preserving their
  validation, fail-closed, and question-level result behavior.
- Replaced the terminal-heavy visual tokens and stylesheet with a responsive,
  accessible dark product system. No animation or icon dependency was added.
- Deleted the unreferenced `security-rail.tsx` component.

Pre-mortem and mitigation:

- Public navigation could cause private capability links to be lost: seller
  and buyer pages use a navigation-free task shell.
- Moving details into Docs could hide critical decisions: CSV limits, consent,
  token timing, sample limitation, and TEE caveat remain inline.
- A presentation refactor could affect evaluation behavior: no files under
  `src/lib` or `src/app/api` were changed.
- A marketing preview could be mistaken for a real result: it is labeled
  “Illustrative result” and contains no live data or capability URL.
- Motion could reduce accessibility: transitions use opacity/transform only
  and honor `prefers-reduced-motion`.

Acceptance:

- Added source-contract tests for the route split, Docs guarantees, focused
  task shell, keyboard skip link, and removal of ordering/terminal controls.
- Lint, TypeScript, 97 non-live tests, and the production build pass.
- Browser verification passed at 1280 px and 390 px for `/`, `/new`, and
  `/docs`: no error overlays, console errors, or horizontal overflow.
- The private seller shell exposed no public navigation and made no 0G
  request during verification.
- A focused secret scan found only documented placeholders and explicit
  test-only credentials; `.env.example` remains the only tracked env file.
- No paid or live 0G request was made.

## 2026-07-26 — Protected-service messaging

- Reframed the public, buyer, seller, results, and Docs copy around the actual
  protection path: TLS-encrypted transport, memory-only handling, 0G Private
  Computer, TEE verification, and no raw-row disclosure.
- Avoided an end-to-end-encryption claim because the server parses the bounded
  CSV in memory before the private 0G request.
- Updated metadata and copy-contract tests to keep the protection message
  consistent across routes.
- Lint, TypeScript, 97 non-live tests, the production build, and the refreshed
  localhost page pass. No live or paid 0G request was made.
