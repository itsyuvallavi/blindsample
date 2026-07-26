# BlindSample Execution Plan

This is the single current plan for BlindSample. It follows the required
sequence:

**Inspection → Mapping → Review → Pre-mortem → Mitigation → Planning → Acceptance**

## 1. Inspection

### Repository

- Public repository: `https://github.com/itsyuvallavi/blindsample`
- Implementation branch: `build/mvp`
- Pull request: draft review from `build/mvp` into `main`
- Application: Next.js App Router, TypeScript, Node.js 22
- Persistence: one private Supabase `evaluations` table
- Hosting: Vercel preview connected to the repository
- Sponsor integration: server-side 0G Private Computer

### Current implementation

- Buyer contract creation, preview, review, and explicit approval
- Independent buyer and seller capability links
- In-memory CSV parsing with 1–50 parsed-record, 20-column, and 200-KB limits
- Deterministic objective metrics
- Private 0G semantic classifications
- Server-calculated scores with calibration and consistency checks
- One stored result per approved contract
- Explicit `unable_to_score` state
- Buyer, seller, API, Supabase, and UI tests
- Clean Terminal-inspired interface

### Fixed product decisions

- No overall score, average, recommendation, marketplace, payment, or dataset
  delivery
- No raw CSV, prompts, or capability tokens stored
- Results apply only to the submitted records
- A sample cannot prove completeness or representativeness of a larger dataset
- TEE verification proves protected execution, not judgment accuracy

### Hackathon fit

BlindSample targets **Best AI Product on 0G**. The final submission needs a
public repository, a working demo, a sub-three-minute video, clear 0G usage,
setup instructions, team details, and an explicit statement that no custom
smart contract was deployed.

## 2. Mapping

### User flow

```text
Buyer defines criteria
        |
        v
BlindSample compiles versioned evaluation contracts
        |
        v
Buyer reviews and approves exact contract-set hash
        |
        +--------------------+
        |                    |
        v                    v
Seller capability       Buyer capability
submit only             results only
        |
        v
CSV parsed in memory, all 1–50 records retained
        |
        +-----------------------------+
        |                             |
        v                             v
deterministic objective code     private 0G classification
                                      |
                               controls + repeat pass
        |                             |
        +--------------+--------------+
                       v
             one safe result per contract
                       |
                       v
                    Supabase
                       |
                       v
                 buyer result view
```

### Evaluation contracts

Each buyer criterion is compiled into a versioned contract containing:

- question ID and original wording
- normalized criterion
- deterministic or semantic method
- required evidence and columns
- all-submitted-records population rule
- meanings for scores 1, 25, 50, 75, and 100
- aggregation method
- minimum records and coverage
- unable-to-score conditions
- contract version

The canonical contract set is SHA-256 hashed. The seller link is created only
after the buyer approves that exact hash.

### Evaluation engine

Deterministic criteria:

- completeness
- format validity
- uniqueness
- date freshness
- numeric range
- column availability
- category coverage

Semantic criteria:

- relevance or suitability against a buyer-approved target

The 0G model returns only validated per-record rubric labels. Application code
maps labels to `1`, `25`, `50`, `75`, or `100` and calculates the integer
aggregate.

### Sponsor tension

Purely deterministic evaluations would bypass 0G and weaken sponsor fit. The
MVP resolves this by requiring at least one semantic contract before
activation, while still using exact code for arithmetic.

If a semantic contract lacks enough submitted evidence, it may fail during
preflight without spending a 0G request. This yields `unable_to_score`, never a
numeric semantic result. Every published numeric semantic result requires two
private, TEE-verified 0G requests.

### Capability boundary

| Capability | Read contracts | Submit CSV | Read results |
|---|---:|---:|---:|
| Seller | yes | yes | no |
| Buyer | yes | no | yes |

Tokens are independent 256-bit values, expire, remain in URL fragments, move
to the API as bearer credentials, and are stored only as HMAC-SHA256 hashes.

### Persistence boundary

Supabase may store:

- approved contracts and contract-set hash
- state and timestamps
- safe row and column counts
- scored or unable result records
- aggregate measurements
- control and agreement status
- model, provider, request ID, and TEE status for 0G calls

Supabase must not store:

- CSV contents or individual rows
- raw prompts or model chain-of-thought
- raw capability tokens
- credentials or direct personal/payment identifiers

## 3. Review

### Product

- The product answers a real pre-purchase question: whether a private sample
  suits the buyer's stated use.
- Contract review makes the score interpretable before the seller submits.
- Per-question results avoid a misleading universal dataset-quality number.
- `unable_to_score` is more trustworthy than fabricated certainty.

### Technical

- Supabase is justified for asynchronous two-party coordination.
- Server-only 0G calls keep the inference key out of the browser.
- Capability links avoid account scope while preserving strict role
  separation.
- Deterministic code removes avoidable model arithmetic.
- Two 0G passes, human-reviewed controls, and explicit thresholds improve
  repeatability without claiming model agreement is ground truth.

### Scope

Included:

- CSV evaluation
- approved contracts
- hybrid scoring
- 0G Private Computer
- safe persistence
- separate links
- Vercel preview
- automated and live checks

Excluded:

- 0G Storage
- custom contracts
- wallet connection
- payments
- accounts
- analytics
- emails
- arbitrary file formats
- proof that a sample represents a complete dataset

## 4. Pre-mortem

| Failure | Impact |
|---|---|
| Model directly invents the score | Result is not defensible |
| Controls fail but a number is published | Known unreliable judgment appears valid |
| Repeated labels are unstable | Result cannot be reproduced |
| TEE verification is absent or false | Sponsor and privacy claims fail |
| Semantic path is optional | Core demo can bypass 0G |
| CSV is truncated or sampled silently | Score describes hidden, changing evidence |
| Quoted newlines inflate row count | Valid CSV is rejected or limits are wrong |
| Seller reads results or buyer submits | Capability model is broken |
| Duplicate submissions overwrite results | State and cost become inconsistent |
| Raw rows enter Supabase or logs | Privacy promise is false |
| UI presents too much technical detail | Real users cannot understand the product |
| Docs still describe the old model-scoring path | Reviewers cannot trust the repository |
| Router has no testnet balance | Live semantic demo fails |
| Preview deploy is behind the branch | Judges see an obsolete product |

## 5. Mitigation

| Risk | Mitigation | Acceptance evidence |
|---|---|---|
| Invented model score | Model output schema forbids scores; server calculates | Override test |
| Bad controls | Require 100% control accuracy | Control-failure test |
| Instability | Repeat canonical subset; require 80% agreement | Unstable-output test |
| Weak evidence | Require 3 usable records and 80% coverage | Missing-evidence test |
| Unverified 0G | Require private mode, TeeML, `verify_tee`, and true trace | False/missing TEE tests |
| 0G bypass | Require a semantic contract to activate | Compiler test |
| Input drift | Parse full CSV; 1–50 records; reject 0 and 51; no truncation | CSV boundary tests |
| Role leak | Server-side bearer authorization and role-specific views | Permission tests |
| Overwrite | Atomic processing claim and immutable complete state | Concurrent claim test |
| Raw-data leak | In-memory handling and aggregate-only schema | Repository/schema/live checks |
| Dense UI | Progressive disclosure and one primary action per state | Browser review |
| Documentation drift | One README, one execution plan, one build log | Repository review |
| Live dependency failure | Fund testnet key and keep completed verified demo evidence | Live 0G and scoring tests |
| Stale deployment | Deploy the exact pushed commit to Preview | Vercel inspection |

## 6. Planning

### Phase 1 — Repository and services

Status: complete.

- Publish the repository and branch.
- Configure 0G testnet, Supabase, and Vercel.
- Add `.gitignore`, `.env.example`, CI, and Node.js 22.
- Store secrets only in local/Vercel environments.

Commits:

- `chore: scaffold the verified web application`
- service-specific follow-up commits recorded in the build log

### Phase 2 — Private coordination

Status: complete.

- Add the locked Supabase table and migration.
- Add independent capability creation and hashing.
- Add role-scoped reads, atomic claim, completion, failure, and retry.
- Verify RLS, revoked browser grants, live role separation, and cleanup.

### Phase 3 — Defensible evaluation

Status: complete.

Small commits:

- `fix: enforce the 50-record sample contract`
- `feat: define defensible evaluation contracts`
- `feat: calculate objective scores deterministically`
- `feat: calibrate private semantic classifications`
- `feat: persist approved contracts and audit results`

### Phase 4 — Product UI

Status: complete.

- Buyer creation and approval
- Seller contract review and CSV submission
- Buyer wait, failure, and result states
- Question-level evidence with advanced detail collapsed by default
- Terminal-inspired, clean, inviting presentation

Commit:

- `feat: simplify the private terminal workflow`

### Phase 5 — Documentation and acceptance

Status: in progress.

1. Align README, this plan, and build log.
2. Run lint, typecheck, 78 unit tests, and production build.
3. Run live Supabase authorization and cleanup verification.
4. Run live 0G private inference and semantic scoring.
5. Complete one end-to-end evaluation with synthetic data.
6. Deploy the exact pushed commit to Vercel Preview.
7. Inspect runtime logs and browser security headers.
8. Commit and push documentation and acceptance evidence.

### Commit discipline

- One coherent concern per commit.
- Commit after each verified milestone.
- Push `build/mvp` after every milestone.
- Explain what changed and why in the commit subject or build log.
- Stage explicit files; never use broad staging around secrets or diagnostics.
- Do not commit `.env.local`, `.vercel`, build output, live CSVs, or temporary
  diagnostic tests.
- Do not merge to `main` or create a production deployment during MVP review.

## 7. Acceptance

### Product

- [x] Buyer reviews exact contracts before seller-link activation.
- [x] Seller and buyer links are separate and role restricted.
- [x] Seller submits 1–50 parsed CSV records with no truncation.
- [x] One accepted contract yields one result.
- [x] No overall score exists.
- [x] Insufficient or unreliable evidence yields `unable_to_score`.
- [x] Results state the submitted-data-only limitation.

### Reliability

- [x] Objective fixtures match known mathematics.
- [x] Model output cannot override the calculated score.
- [x] Controls are human reviewed and fail closed.
- [x] Repeat agreement uses a documented 80% threshold.
- [x] Row order and irrelevant columns do not materially alter valid results.
- [x] Prompt-injection cells remain untrusted data.
- [x] Missing or false TEE verification blocks semantic publication.

### Privacy and persistence

- [x] CSV rows and prompts are absent from the schema.
- [x] Only HMAC capability hashes are stored.
- [x] Browser roles have no direct table grants.
- [x] Completed results cannot be overwritten.
- [x] Live Supabase role and concurrency checks passed with cleanup.

### Repository

- [x] Meaningful, focused commit history exists.
- [x] `.gitignore` excludes secrets and generated output.
- [x] README identifies the 0G integration and limitations.
- [x] One execution plan and one build log remain.
- [x] Unit suite, lint, typecheck, and production build pass.

### Final live gates

- [ ] Current testnet key completes a private, TEE-verified 0G request.
- [ ] Current testnet key completes the calibrated semantic scoring test.
- [ ] One browser evaluation completes end to end with synthetic data.
- [ ] Current pushed commit is available on Vercel Preview.
- [ ] Preview health, security headers, and runtime logs pass inspection.
- [ ] Demo video, project description, team details, and submission form are
  complete.

The MVP is acceptance-complete only when all final live gates are checked or a
specific external blocker is documented honestly.
