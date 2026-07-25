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
