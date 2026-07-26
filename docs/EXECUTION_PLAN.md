# BlindSample Execution Plan

This plan follows the required sequence:

**Inspection → Mapping → Review → Pre-mortem → Mitigation → Planning → Acceptance**

It is the single source of truth for scope, architecture, delivery, sponsor
compliance, and definition of done.

## 1. Inspection

### Repository state

- Public repository: `https://github.com/itsyuvallavi/blindsample`.
- Initial commit: `9b72209 docs: establish BlindSample project scope`.
- Implementation branch: `build/mvp`.
- The reproducible Next.js, Node.js 22, test, and CI baseline is complete.
- A real private 0G request has returned `tee_verified: true`.
- Product routes, persistence, strict scoring, the Supabase project, and the
  Vercel project do not yet exist.

### Product rules already agreed

- The buyer creates multiple questions.
- The seller submits a CSV sample.
- Every question receives one independent integer score from 1 to 100.
- There is no overall score, average, weighting, or written recommendation.
- The buyer never receives raw dataset rows.
- Results apply only to the seller-submitted sample.

### Hackathon requirements

BlindSample targets **Best AI Product on 0G**. The final submission must
include:

- A working live product or runnable build
- Proof that 0G Compute / Private Computer performs inference
- A public GitHub repository with setup instructions
- Meaningful Git history created during the hackathon
- A live demo link
- A demo video shorter than three minutes
- A clear explanation of the 0G features or SDKs used
- Team names and sponsor-requested contact details
- Contract deployment addresses, or an explicit statement that no custom
  contracts were deployed

The project must disclose any reused project-specific work. BlindSample is
being built from scratch; normal open-source libraries and official starter
references may be used and documented.

### Current platform constraints

- 0G Router is the supported fast path for server-side applications.
- Every production evaluation must request `private` trust mode and
  `verify_tee: true`.
- A model with live `TeeML` availability must be selected from the 0G model
  catalog.
- Supabase is needed only because the buyer and seller must use different
  links on different devices and the buyer may return later for results.
- Supabase will store metadata and scores, never CSV contents.
- Supabase's current `sb_secret_...` key will be used server-side; legacy
  `service_role` keys will not be introduced for a new project.
- Supabase no longer guarantees that newly created tables are automatically
  exposed to the Data API, so exposure and grants must be configured and
  verified explicitly.
- Node.js 22 will be pinned because current Supabase client releases no longer
  support Node.js 20 and the 0G tooling supports Node.js 22.
- Vercel's Git integration will provide branch previews and production
  deployments from `main`.

## 2. Mapping

### Users and links

The buyer creates an evaluation and receives two separate capability links:

1. **Seller link** — permits reading the questions and submitting one sample.
2. **Buyer link** — permits reading status and question-level results.

The links contain independent 256-bit random tokens in the URL fragment, not
the query string. The browser reads the fragment and sends the token to the
application API. Raw tokens are returned once and are never stored in the
database.

### Site map

| Route | Audience | Purpose |
|---|---|---|
| `/` | Buyer | Product explanation and evaluation creation |
| `/submit/[evaluationId]` | Seller | Review questions and submit CSV sample |
| `/results/[evaluationId]` | Buyer | Wait for and view question-level scores |
| `/api/evaluations` | Buyer UI | Create evaluation and issue both links |
| `/api/evaluations/[id]` | Buyer or seller UI | Return only the data allowed by the presented token |
| `/api/evaluations/[id]/submit` | Seller UI | Validate sample, call 0G, and complete evaluation |
| `/api/health` | Operations | Report non-secret application readiness |

### Evaluation state machine

```text
waiting_for_seller
        |
        v
    processing
      /     \
     v       v
 complete   failed
```

- Only a valid seller token may move `waiting_for_seller` to `processing`.
- The transition is conditional so duplicate submissions cannot run two paid
  0G requests.
- A failed evaluation may be retried through the same seller link.
- A completed evaluation cannot be overwritten.
- Expired evaluations reject both buyer and seller access.

### Data flow and trust boundaries

```text
Buyer browser
  questions
      |
      v
Next.js API ── metadata + token hashes ──> Supabase
      |
      └── returns buyer and seller capability links

Seller browser
  CSV sample + seller token
      |
      v
Next.js API
  validates CSV in memory
  never logs or persists raw rows
      |
      v
0G Router
  private trust mode
  TeeML provider
  verify_tee: true
      |
      v
scores + verification trace
      |
      v
Next.js API
  strict schema validation
  stores scores and trace metadata only
      |
      v
Supabase <── buyer result polling ── Next.js API <── Buyer browser
```

### Supabase data model

Use one `evaluations` table to keep the MVP atomic and small:

| Field | Purpose |
|---|---|
| `id` | Public UUID used in routes |
| `environment` | Isolates preview and production rows |
| `title` | Buyer-provided evaluation label |
| `status` | State machine value |
| `questions` | Validated JSON array of `{id, text}` |
| `scores` | Nullable JSON array of `{questionId, score}` |
| `buyer_token_hash` | HMAC-SHA256 of buyer capability token |
| `seller_token_hash` | HMAC-SHA256 of seller capability token |
| `sample_row_count` | Non-sensitive sample metadata |
| `sample_column_count` | Non-sensitive sample metadata |
| `zero_g_model` | Model used |
| `zero_g_provider` | Provider returned in trace |
| `zero_g_request_id` | Request identifier for evidence and support |
| `tee_verified` | Must be true before results are published |
| `error_code` | Sanitized operational state, never prompt or CSV content |
| `created_at` | Audit timestamp |
| `updated_at` | State timestamp |
| `completed_at` | Successful evaluation timestamp |
| `expires_at` | Capability-link expiry |

Database rules:

- CSV contents and model prompts are forbidden from this table.
- Enable RLS.
- Grant no browser role direct access.
- Access Supabase only from server routes using a server-only secret key.
- Explicitly configure and verify Data API exposure and required server grants.
- Do not use Supabase Auth, Storage, Realtime, Edge Functions, or additional
  tables for the MVP.

### Secrets and configuration

Local secrets live in `.env.local`; deployed secrets live in Vercel
environment variables.

| Variable | Visibility | Purpose |
|---|---|---|
| `ZERO_G_API_KEY` | Server secret | 0G Router authentication |
| `ZERO_G_MODEL` | Server config | Chosen TeeML model |
| `SUPABASE_URL` | Server config | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server secret | Server-only database access |
| `ACCESS_TOKEN_PEPPER` | Server secret | HMAC hashing of capability tokens |

No secret receives a `NEXT_PUBLIC_` prefix. Secrets must never be pasted into
documentation, chat, source control, URLs, screenshots, or build logs.

### Repository map

```text
app/
  api/
  results/[evaluationId]/
  submit/[evaluationId]/
components/
lib/
  access/
  csv/
  scoring/
  supabase/
  zero-g/
supabase/
  migrations/
tests/
.github/workflows/ci.yml
README.md
docs/EXECUTION_PLAN.md
docs/BUILD_LOG.md
```

No additional top-level documentation files should be added unless a sponsor
explicitly requires one.

## 3. Review

### Product review

- The narrow output contract is distinctive and easy to demonstrate.
- Independent question scores match the buyer's actual decision process better
  than a generic dataset-quality score.
- Numeric-only output reduces UI and model-output complexity.
- The buyer/seller link flow makes the product usable by two real parties
  without adding account registration.

### Sponsor-fit review

- 0G is load-bearing: without private 0G inference, BlindSample cannot produce
  its core result.
- The project is an end-user product, not infrastructure.
- `private` routing and TEE verification are visible in the final UI.
- 0G Storage, Agentic ID, a custom provider, and a smart contract are not
  required by the product prize and would add unsupported scope.

### Architecture review

- Supabase is justified for asynchronous buyer/seller coordination.
- Polling every few seconds is sufficient; Realtime would add a client key,
  policies, and another failure mode without improving the demo materially.
- Capability links are sufficient for the MVP, provided buyer and seller
  tokens are separate, high entropy, hashed at rest, single-purpose, and
  expiring.
- A server-side 0G Router call is faster to ship and keeps the API key private.
- The privacy statement must acknowledge that the Vercel function handles the
  CSV transiently before sending it to 0G.

### Scope decision

Include:

- Buyer evaluation creation
- Separate buyer and seller links
- CSV validation
- Real private and verified 0G inference
- Strict question-level scoring
- Supabase metadata/result persistence
- Vercel preview and production deployment
- Automated validation and a manual live verification
- Complete hackathon documentation and demo evidence

Exclude:

- Purchasing
- Dataset delivery
- Smart contracts
- 0G Storage
- User accounts
- Email
- Analytics or session replay
- Arbitrary file formats
- Custom TEE/provider infrastructure
- Proof that a sample represents the full dataset

## 4. Pre-mortem

Assume the submission failed. The most likely reasons are:

| Failure | Consequence |
|---|---|
| GitHub authentication remains broken | No public repository or Vercel Git connection |
| No TeeML model is available | Private request returns 503 and the core demo stops |
| 0G returns malformed or unstable scores | Missing, duplicated, or non-numeric results |
| TEE verification is false or absent | Sponsor proof is invalid |
| CSV reaches logs or Supabase | Privacy claim is false |
| Seller and buyer links authorize the wrong actions | Results or submission access leaks |
| Two seller submissions run concurrently | Duplicate inference cost and inconsistent results |
| Supabase table is not exposed or grants are wrong | Server receives database authorization errors |
| Supabase secret reaches the browser | Entire evaluation database is compromised |
| Vercel request exceeds time or body limits | Seller submission fails in production |
| Preview and production data collide unexpectedly | Demo shows the wrong evaluation |
| UI shows an overall score or explanation | Product violates its fixed output contract |
| Repository accumulates duplicate docs or generated files | Reviewers cannot identify the real implementation |
| Demo relies on a live network with no rehearsal | A transient dependency failure ruins judging |
| README does not point to the 0G integration | Sponsor cannot verify eligibility quickly |

## 5. Mitigation

| Risk | Prevention | Fallback | Verification |
|---|---|---|---|
| GitHub authentication | Reauthenticate before scaffolding | Push immediately after auth is restored | Public repository loads and initial commit is visible |
| TeeML unavailability | Query live model catalog during setup and pin a working model | Allow retry or a second explicitly configured TeeML model; never downgrade privacy | Live request succeeds in private mode |
| Malformed model output | Temperature 0, fixed prompt, strict JSON schema, exact ID matching | One corrective retry, then fail safely | Unit tests cover missing, duplicate, extra, decimal, and out-of-range scores |
| Missing TEE proof | Always send `verify_tee: true` | Mark evaluation failed; never publish unverified scores | Stored and displayed `tee_verified` equals true |
| Raw-data leakage | Parse and forward only in memory; no request-body logging, analytics, or persistence | Delete any accidental test row and rotate affected test data | Database inspection and repository search find no CSV contents |
| Capability-link leakage | 256-bit tokens, URL fragments, separate roles, HMAC hashes, expiry | Invalidate evaluation and create a new one | Seller token cannot fetch scores; buyer token cannot submit |
| Duplicate submission | Conditional state transition before inference | Return existing state instead of starting another call | Concurrent integration test produces one inference invocation |
| Supabase grants | Create schema through one reviewed migration; explicitly enable access required by server | Use dashboard SQL editor only to diagnose, then update the migration | Migration list, Data API call, and security advisor pass |
| Secret exposure | Server-only client module and unprefixed environment variables | Rotate key immediately | Browser bundle and network responses contain no secret |
| Vercel limits | Maximum 200 KB file, 200 rows, 20 columns, 20 questions; explicit timeout handling | Reject before upload with an actionable message | Production test with boundary and oversized files |
| Environment collision | Store `VERCEL_ENV` with every row and scope queries by it | Use a dedicated demo evaluation in production | Preview cannot retrieve production evaluation |
| Product-contract drift | Central score schema and no overall-score component | Block merge when tests fail | UI and API tests assert N questions → N scores only |
| Repository pollution | One plan, one build log, explicit staging, lockfile committed, generated files ignored | Remove accidental files before commit without rewriting legitimate history | `git status`, `git diff --check`, and repository tree review |
| Live-demo failure | Rehearse with a small synthetic CSV and keep a completed result link | Show the previously completed verified result, then explain the transient live failure | Full video and live rehearsal under three minutes |
| Unclear sponsor evidence | Dedicated README section with file paths and visible UI trace | Show the exact server integration during judging | Reviewer can locate private header, `verify_tee`, and trace handling quickly |

## 6. Planning

### Phase 0 — Unblock owned services

User-owned actions:

1. [x] Reauthenticate GitHub CLI.
2. [x] Create/fund a 0G Private Computer account and create a Private API key.
3. [x] Create or connect a Supabase project in the nearest available EU region.
4. [x] Connect or authenticate the Vercel account.

No secret should be sent through chat. Secrets are entered locally and later
added directly to Vercel.

Gate:

- GitHub, 0G, Supabase, and Vercel access are available.

### Phase 1 — Publish and scaffold

Status: complete on 2026-07-26.

Implementation:

- Create the public `itsyuvallavi/blindsample` repository and push the existing
  commit.
- Create a `build/mvp` branch so Vercel can provide previews before production.
- Scaffold a Next.js TypeScript application using Node.js 22.
- Pin dependencies and commit the lockfile.
- Add lint, typecheck, unit-test, and build scripts.
- Add one GitHub Actions workflow running those checks on Node.js 22.
- Update the build log with what was added, why, and how it was verified.

Commit:

```text
chore: scaffold the verified web application
```

Why:

Establishes a reproducible application and CI baseline before external
integrations.

Gate:

- Clean install, lint, typecheck, test, and production build pass.

### Phase 2 — Add Supabase persistence

Status: complete on 2026-07-26.

Implementation:

- Check the installed Supabase CLI version and discover migration commands via
  `--help`.
- Create one migration with `supabase migration new`.
- Add the `evaluations` table, checks, timestamps, indexes, RLS, grants, and
  explicit Data API exposure configuration.
- Add a server-only Supabase client using `SUPABASE_SECRET_KEY`.
- Generate buyer/seller capability tokens and store only HMAC hashes.
- Implement state transitions and environment isolation.
- Run Supabase security and performance advisors.
- Test server CRUD, token separation, expiry, and concurrent submission.
- Record only material results in the build log.

Commit:

```text
feat: persist evaluations without storing samples
```

Why:

Allows independent buyer and seller sessions while keeping raw datasets out of
persistent storage.

Gate:

- Separate links work across two browser sessions.
- Direct browser access to the database is denied.
- No CSV or raw capability token exists in Supabase.

### Phase 3 — Prove 0G privately

Status: complete on 2026-07-26.

Implementation:

- Query the live 0G model catalog and select a TeeML model.
- Build a server-only 0G client.
- Send `X-0G-Provider-Trust-Mode: private`.
- Send `verify_tee: true`.
- Execute one synthetic question/sample request.
- Validate `x_0g_trace.tee_verified === true`.
- Capture only non-sensitive request ID, provider, model, and verification
  status.
- Add retry handling for transient 503/rate-limit errors without falling back
  to a weaker trust mode.

Commit:

```text
feat: add private verified scoring through 0G
```

Why:

Proves the load-bearing sponsor integration before UI work.

Gate:

- A real private request returns question-level scores and verified TEE trace.

### Phase 4 — Build the scoring pipeline

Status: implementation complete on 2026-07-26. The replacement testnet key
authenticates against the testnet Router; live scoring verification is pending
testnet Router funding after the authenticated request returned HTTP 402.

Implementation:

- Define strict schemas for evaluation creation, questions, CSV constraints,
  0G output, and stored results.
- Parse CSV server-side in memory.
- Normalize headers and sample rows without mutating their meaning.
- Enforce 200 KB, 200 rows, 20 columns, and 20 questions.
- Construct a fixed scoring prompt.
- Reject any response that does not contain exactly one integer score from 1
  to 100 for every submitted question ID.
- Retry malformed output once.
- Publish results only after successful TEE verification.
- Persist scores and trace metadata atomically; never persist raw sample data.

Commit:

```text
feat: enforce independent question scoring
```

Why:

Turns private inference into the exact BlindSample product contract.

Gate:

- N questions always produce N valid scores and no overall score.

### Phase 5 — Build the site

Status: capability-scoped API routes complete on 2026-07-26; browser pages are
in progress.

Implementation:

- Landing page with a concise product explanation and buyer form.
- Dynamic question editor with add, remove, reorder, and validation.
- Success screen showing separately labeled seller and buyer links.
- Seller page showing questions, privacy limitations, CSV input, file
  metadata, consent, loading, and safe errors.
- Buyer results page polling every three seconds.
- Results table with one prominent score per question.
- Verification panel showing private evaluation status, TEE verification,
  model, provider, request ID, timestamp, and sample dimensions.
- Waiting, processing, failed, expired, malformed-file, and unavailable-model
  states.
- Responsive and accessible keyboard/focus behavior.
- No raw rows, overall score, AI prose, analytics, or session replay.

Commits:

```text
feat: add buyer evaluation and sharing flow
feat: add seller submission and result views
```

Why:

Separates the two user roles into a demoable end-to-end product without
introducing account management.

Gate:

- Buyer and seller complete the flow in separate browsers.

### Phase 6 — Verify the complete system

Automated tests:

- Token generation, hashing, role separation, and expiry
- CSV file, row, column, and malformed-input limits
- Exact question-to-score mapping
- Score integer/range enforcement
- Rejection of extra prose and overall scores
- TEE verification requirement
- State-transition and duplicate-submission behavior
- API authorization and safe error responses

Integration checks:

- Supabase migration and CRUD
- Mocked 0G success, malformed response, 503, and unverified response
- Full production build

Manual live checks:

- Strong, weak, mixed, malformed, and boundary-size synthetic samples
- Separate browser/incognito buyer and seller flow
- Database inspection proving no raw sample storage
- Network and bundle inspection proving no secret exposure
- One real private 0G request with TEE verification

Commit:

```text
test: verify privacy and scoring boundaries
```

Why:

Makes the privacy, authorization, and numerical-output claims demonstrable.

Gate:

- All automated checks and the live verification checklist pass.

### Phase 7 — Deploy through Vercel

Implementation:

- Import the GitHub repository into Vercel.
- Use Git integration rather than a duplicate custom deployment workflow.
- Configure `build/mvp` as preview and `main` as production.
- Add all five environment variables directly in Vercel for preview and
  production; mark secrets sensitive where supported.
- Confirm the app does not require real secrets at build time.
- Deploy preview, run smoke tests, then merge without squashing the small
  commits so history remains visible.
- Let the `main` merge create the production deployment.
- Inspect deployment status and error logs.
- Run production end-to-end verification.

Commit only if deployment documentation or configuration changes:

```text
docs: document production deployment
```

Why:

Provides the sponsor-required live product while preserving one deployment
source of truth.

Gate:

- Production URL is ready and a live private evaluation succeeds.

### Phase 8 — Complete documentation and submission

README must contain:

- Problem and users
- Exact question-level scoring contract
- Live URL and demo video
- Architecture and data-flow diagram
- 0G integration with exact source-file locations
- Supabase data-retention and access model
- Privacy guarantees and honest limitations
- Local setup, environment variables, scripts, and deployment
- Testing instructions and verified results
- Statement: `No custom contracts deployed`
- Team and contact details required by the submission form

Build log entry for every completed phase:

- Date and commit
- What was added
- Why it was added
- Verification performed
- Remaining blocker, if any

Submission:

- Select Best AI Product on 0G.
- Provide public repository.
- Provide production URL.
- Provide video shorter than three minutes.
- Explain Private Computer, private routing, TeeML, and TEE verification.
- Include team names, Telegram, and X.
- Enter `N/A — no custom contracts deployed` for contract addresses and confirm
  this treatment with the 0G sponsor desk.

Final commit:

```text
docs: complete hackathon handoff
```

Why:

Makes sponsor eligibility and reproduction straightforward for judges.

Gate:

- A reviewer can understand, run, verify, and judge the project from the
  README and links alone.

### Commit discipline

- Stage explicit files; never default to adding an unreviewed worktree.
- Run `git diff --check` and relevant tests before every commit.
- Each commit contains one coherent milestone.
- Use a concise subject describing what changed.
- Add a short commit body describing why when the reason is not obvious.
- Update `BUILD_LOG.md` in the same commit as the milestone.
- Do not squash the final branch; preserve the hackathon timeline.
- Never commit secrets, `.env.local`, raw datasets, request payloads, generated
  build output, routine logs, or demo recordings.

## 7. Acceptance

### Repository

- [ ] Public GitHub repository exists.
- [ ] Git history begins during the hackathon and contains small coherent
      commits.
- [ ] README, one execution plan, and one build log are the only project
      documentation files.
- [ ] Lockfile and the single CI workflow are committed.
- [ ] No secrets, raw datasets, generated artifacts, or unrelated files exist.
- [ ] `git status` is clean and `git diff --check` passes.

### Product

- [ ] Buyer can create 1–20 questions.
- [ ] Buyer receives distinct seller and buyer links.
- [ ] Seller can review the questions and submit a valid CSV.
- [ ] Buyer page moves through waiting, processing, and complete states.
- [ ] Every question receives exactly one independent integer score from 1 to
      100.
- [ ] No overall score, average, recommendation, or AI explanation appears.
- [ ] Buyer never receives raw dataset rows.
- [ ] Result clearly states that it applies only to the submitted sample.

### 0G

- [ ] Every real evaluation uses 0G Compute / Private Computer.
- [ ] Every request explicitly selects private trust mode.
- [ ] Every request uses a live TeeML model.
- [ ] Every request sets `verify_tee: true`.
- [ ] Results are published only when `tee_verified` is true.
- [ ] Model, provider, request ID, and verification status are visible.
- [ ] README points judges to the exact integration source.

### Supabase and privacy

- [ ] Supabase stores only questions, status, scores, token hashes, safe sample
      dimensions, and verification metadata.
- [ ] CSV contents, prompts, raw tokens, and secrets are absent.
- [ ] Browser roles cannot query the table directly.
- [ ] Seller token cannot read scores.
- [ ] Buyer token cannot submit a dataset.
- [ ] Completed evaluations cannot be overwritten.
- [ ] Expired links are rejected.
- [ ] Secret key exists only in server environments.

### Quality

- [ ] Lint, typecheck, unit tests, integration tests, and production build pass.
- [ ] Malformed, oversized, duplicated, expired, unauthorized, 503, malformed
      model, and unverified-response paths fail safely.
- [ ] Separate-browser end-to-end flow passes.
- [ ] Live 0G verification passes.
- [ ] Accessibility and responsive smoke checks pass.

### Deployment and submission

- [ ] Vercel preview deployment passes before production.
- [ ] Production URL is publicly accessible and functional.
- [ ] Production logs contain no raw datasets or secrets.
- [ ] Public README contains setup, architecture, privacy, limitations,
      testing, deployment, and 0G usage.
- [ ] Demo video is shorter than three minutes.
- [ ] Submission contains project description, repository, live URL, video,
      0G feature explanation, team contacts, and no-contract statement.

BlindSample is accepted only when every applicable checkbox is satisfied and a
fresh reviewer can complete the live flow without developer assistance.

## Authoritative references

- ETHGlobal 0G prize:
  <https://ethglobal.com/events/lisbon2026/prizes#0g>
- ETHGlobal rules:
  <https://ethglobal.com/rules>
- 0G Router quickstart:
  <https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/quickstart>
- 0G privacy:
  <https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/privacy>
- 0G verifiable execution:
  <https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/verifiable-execution>
- Supabase API keys:
  <https://supabase.com/docs/guides/getting-started/api-keys>
- Supabase RLS:
  <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase breaking-change changelog:
  <https://supabase.com/changelog?tags=breaking-change>
- Vercel Git deployments:
  <https://vercel.com/docs/git>
- Vercel environment management:
  <https://vercel.com/docs/environment-variables/manage-across-environments>
