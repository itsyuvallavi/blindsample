# BlindSample

BlindSample lets a buyer evaluate a private CSV sample without receiving its
rows. The buyer provides an evaluation name and plain-text questions.
BlindSample decides how to test each question only after reading the submitted
CSV, then returns one audited result per question.

Built for the **Best AI Product on 0G** track at ETHGlobal Lisbon 2026.

## What the product does

1. A buyer enters an evaluation name and one or more plain-text questions.
2. A separate seller link accepts one CSV containing 1–50 parsed data records.
3. BlindSample parses the actual headers and rows.
4. It generates and validates a fresh internal plan for every question,
   fingerprinted to both the question and submitted sample.
5. Exact calculations run in application code. Questions that require
   record-level judgment use private 0G classification.
6. The buyer sees one `1–100`, `unable_to_score`, or `error` result per
   question, plus safe audit evidence.

BlindSample never calculates an overall score. A result describes only the
submitted records and cannot prove that the sample represents the seller's
complete dataset.

## Why 0G is load-bearing

When a question needs semantic judgment, evidence is classified through 0G
Private Computer using:

- `X-0G-Provider-Trust-Mode: private`
- a TeeML provider
- `verify_tee: true`
- a required `tee_verified === true` response

The model returns rubric labels per submitted record, not a final score.
BlindSample validates those labels and calculates the final integer itself.
No numeric semantic result is published without verified private 0G execution.

Objective questions use deterministic application code and make no 0G request.

TEE verification proves protected execution. It does not prove that a judgment
is correct.

## Defensible semantic scoring

Each semantic plan contains generated evidence fields, a per-record rubric,
score meanings, confidence, and internal negative, intermediate, and positive
controls. The buyer never creates or maintains these fields.

A semantic result is published only when:

- all controls receive their expected labels;
- at least three submitted records provide usable evidence;
- usable evidence covers at least 80% of submitted records;
- a repeated classification of a canonical subset agrees at least 80%; and
- both 0G requests are private and TEE verified.

All submitted records for one question are packaged into a single
classification request. A second packaged request repeats a canonical subset
for agreement checking. BlindSample does not make one request per record, and
a failed first pass prevents the second request.

Insufficient or unreliable evidence produces `unable_to_score`. A
configuration, Router, model-output, or verification failure produces
`error`, with evidence coverage shown as unavailable rather than `0%`.
Neither state is converted into an arbitrary number.

Tests cover control failure, unstable repeated judgments, row-order
invariance, irrelevant-column invariance, prompt-injection cells, missing
evidence, and false TEE verification.

## CSV and result contracts

- UTF-8 CSV only
- 1–50 parsed data records; the header does not count
- quoted embedded newlines are counted correctly
- 20 columns maximum
- 200 KB maximum
- no truncation, hidden sampling, or discarded rows
- one buyer question produces one result record
- scored results are integers from 1 to 100
- insufficient or unreliable evidence produces `unable_to_score`
- execution or provider failures produce `error`, never a zero score
- raw CSV rows, prompts, and capability tokens are never persisted

A one-record CSV is accepted, but its coverage is extremely limited. A
semantic contract will normally be unable to score because it requires at
least three usable records.

## Privacy and access model

The buyer and seller receive separate high-entropy capability links:

- the seller can read the buyer's plain-text questions and submit one sample;
- the buyer can read status and results;
- the seller cannot read results;
- the buyer cannot submit data; and
- a completed evaluation cannot be overwritten.

Capabilities are transported in URL fragments, sent to the API as bearer
credentials, and stored only as HMAC-SHA256 hashes. They are never stored in
`localStorage`.

The bounded CSV is handled in memory by the Vercel function, sent to 0G when
semantic classification is required, and never written to Supabase or
application logs. BlindSample does not claim browser-to-enclave end-to-end
encryption: TLS protects transport and the server handles the sample
transiently.

## Architecture

```text
Buyer questions → separate capability links
                              |
Seller → bounded CSV → in-memory parser
                              |
                    fresh plan generation
                              |
                    header/plan validation
                         |             |
              exact calculation   semantic rubric
                         |       0G Private Computer
                         |             |
                         +-- app score-+
                              |
                    question-level results
                              |
                plans + safe audit in Supabase
                              |
                         Buyer results
```

Supabase initially stores only the questions. When evaluation completes, the
question JSON is replaced with the generated, sample-fingerprinted plans.
Supabase also stores aggregate result evidence, safe 0G request traces, token
hashes, and non-sensitive dimensions. Raw CSV rows are never persisted.

BlindSample does not use 0G Storage, a custom smart contract, payments,
accounts, or dataset delivery in this MVP.

## Application routes

| Route | Purpose |
|---|---|
| `/` | Create an evaluation from plain-text questions |
| `/submit/[id]` | Seller question review and CSV submission |
| `/results/[id]` | Buyer status and question-level results |
| `POST /api/evaluation-contracts` | Retired; returns `410 question_only_workflow` |
| `POST /api/evaluations` | Create links from a name and questions |
| `GET /api/evaluations/[id]` | Return the capability-scoped view |
| `POST /api/evaluations/[id]/submit` | Claim and evaluate one bounded sample |
| `GET /api/health` | Non-secret readiness |

## Local development

Requirements:

- Node.js 22
- npm 10.9.4
- a funded 0G inference key created in Private trust mode
- a Supabase `sb_secret_...` server key
- a random capability pepper containing at least 32 characters

```bash
npm ci
cp .env.example .env.local
npm run check
npm run dev
```

Fill the server-only values in `.env.local`. Never add `NEXT_PUBLIC_` to a
secret, commit `.env.local`, or use a real seller dataset during development.

Optional live verification:

```bash
npm run test:0g
npm run test:scoring
npm run test:supabase
npm run test:e2e
```

Testnet and mainnet 0G keys, endpoints, and Router balances are separate.
The end-to-end test uses synthetic data and removes its evaluation row in
cleanup, including after a failed scoring attempt.

## Important implementation paths

- [Submission-time evaluation plans](src/lib/evaluation-plans)
- [Internal evaluation contracts](src/lib/evaluation-contracts)
- [Deterministic scoring](src/lib/scoring/deterministic.ts)
- [Semantic scoring](src/lib/scoring/semantic.ts)
- [0G client](src/lib/zero-g/client.ts)
- [CSV parser](src/lib/csv/parse-sample.ts)
- [Supabase repository](src/lib/supabase/evaluations.ts)
- [Current schema migration](supabase/migrations/20260726013444_defensible_evaluation_contracts.sql)
- [Execution plan](docs/EXECUTION_PLAN.md)
- [Build log](docs/BUILD_LOG.md)

## Verification

```bash
npm run check
```

The command runs lint, TypeScript, unit tests, and the production build.
GitHub Actions runs the same checks on Node.js 22.

## License

[MIT](LICENSE)
