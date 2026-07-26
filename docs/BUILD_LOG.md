# BlindSample Build Log

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

- Published `itsyuvallavi/blindsample` as a public repository.
- Created the `build/mvp` implementation branch.
- Added Next.js 16.2.12, React 19.2.8, TypeScript, Tailwind CSS, and a Node.js
  22 runtime contract.
- Replaced generator content with a minimal BlindSample landing route and
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

- The `tee_verified` field is verification reported by 0G Router. BlindSample
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

- Created the user-owned `BlindSample` Supabase project in `eu-west-1`.
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
- Created and Git-connected the Vercel `blindsample` project. Local
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
- Deployed the exact committed worktree to the protected
  `blindsample-git-build-mvp-yuval-lavis-projects.vercel.app` preview.
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
- Protected Preview:
  `https://blindsample-git-build-mvp-yuval-lavis-projects.vercel.app`.

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
