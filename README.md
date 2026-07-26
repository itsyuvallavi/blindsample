# CipherQuery

CipherQuery is an encrypted evaluation layer for private structured data. The
seller's CSV, JSONL, NDJSON, or flat Parquet sample travels over encrypted
transport, is handled only in memory, and is evaluated through one private,
TEE-verified 0G request. The buyer receives question-level answers without
receiving the raw records.

Built for the **Best AI Product on 0G** track at ETHGlobal Lisbon 2026.

## Naming

**CipherQuery** is the product and package name. Legacy infrastructure slugs,
database migration comments, and browser storage keys may retain their original
values so existing deployments, evaluation links, and saved drafts continue to
work. They are compatibility identifiers, not the public brand.

## Product flow

1. The buyer names an evaluation and writes 1–20 plain-text questions.
2. CipherQuery creates separate seller and buyer capability links.
3. The seller submits one CSV, JSONL, NDJSON, or flat Parquet sample with 1–50
   records.
4. The server parses the complete bounded sample in memory.
5. The sample and all original questions are sent together in exactly one 0G
   request.
6. CipherQuery validates the verified response as one atomic result set.
7. The buyer sees one independent result per question, each marked
   **Evaluated by 0G**.

CipherQuery never calculates an overall dataset score and never answers a
buyer question locally.

## Atomic 0G evaluation

Every evaluation uses:

- `X-0G-Provider-Trust-Mode: private`
- `verify_tee: true`
- a required `tee_verified === true` trace
- `temperature: 0`
- forced structured function output
- model reasoning enabled for cross-row checks
- no automatic retry
- one hard-coded request per evaluation

The response must identify the evaluation and contain every original question
ID exactly once. Each result contains:

- `scored` or `unable` status
- an integer score from 0–100, or `null` when unable
- reader-facing meanings for 0 and 100
- evaluation basis
- numerator and denominator when applicable
- a concise aggregate explanation
- confidence
- evidence limited to row numbers, aggregate counts, and sanitized reasons

For count-based questions, 0G returns one boolean judgment per evaluated unit.
CipherQuery validates the schema, coverage, question IDs, evidence bounds,
evaluation ID, and TEE trace, then mechanically counts those 0G judgments and
applies the documented rounding rule. It never uses the sample to make or
replace a model judgment. Holistic questions keep the model's validated score.
The per-unit judgments are discarded after safe aggregate results are built.

Any request failure, timeout, 401/403, missing TEE verification, invalid JSON,
partial result set, invented question, unsafe evidence, or invalid arithmetic
fails the entire evaluation. Failed evaluations store and display no scores.

## Privacy boundary

The raw sample, full prompt, and raw 0G response exist only in server memory for
the duration of the request. They are never written to Supabase, logs,
analytics, browser storage, or error tracking.

Supabase stores only:

- buyer questions and their question-set hash
- capability-token HMACs
- status and timestamps
- internal row and column counts, never returned to the buyer
- validated aggregate result records
- safe request diagnostics and TEE metadata

The buyer API exposes only the original questions, count-free result
summaries, scores or unable states, confidence, and 0G verification metadata.
It never returns sample size, row references, numerator/denominator values, or
aggregate counts.

The app does not create or store a dataset fingerprint because the MVP does
not require deduplication. Capability tokens are independent 256-bit values,
transported in URL fragments, sent as bearer credentials, and stored only as
HMAC-SHA256 hashes.

TLS protects transport. TEE verification proves that 0G reports protected
execution; it does not prove that a model judgment is correct.

## State model

- Running: `0G evaluation in progress.`
- Success: `Evaluation complete — all questions evaluated by 0G.`
- Failure: `Evaluation failed — no scores were produced.`

A run becomes `complete` only after one verified response produces a valid
result for every question. A failed run writes `results: null`. Old hybrid
result records fail closed in the current UI and are not reused.

## Architecture

```text
Buyer name + questions
        |
        v
Separate buyer/seller capability links
        |
        v
Seller sample -> format-specific bounded in-memory parser
        |
        v
ONE request: evaluation ID + all questions + all parsed records
        |
        v
0G Private Computer + required TEE verification
        |
        v
Strict schema, ID, arithmetic, and privacy validation
        |
        +-- valid complete set --> safe Supabase result --> buyer
        |
        +-- any failure --------> failed + results:null --> buyer
```

The MVP intentionally excludes 0G Storage, smart contracts, wallets,
payments, accounts, and dataset delivery.

## Limits

- UTF-8 CSV, JSONL, and NDJSON
- flat Parquet with uncompressed or Snappy-compressed scalar columns
- 1–50 parsed records; header excluded
- 20 columns
- 200 KB uploaded file and normalized sample
- 1 MB maximum decoded Parquet column data
- quoted CSV newlines and nested JSONL values supported
- JSONL nested values are converted to canonical JSON strings
- encrypted, nested, repeated, or unsupported-codec Parquet is rejected
- no truncation or hidden sampling
- 1–20 buyer questions
- 300 characters per question

## Application routes

| Route | Purpose |
|---|---|
| `/` | Product overview, workflow, and privacy model |
| `/new` | Create an evaluation from a name and questions |
| `/docs` | Product, privacy, scoring, and 0G documentation |
| `/submit/[id]` | Seller question review and memory-only dataset submission |
| `/results/[id]` | Buyer status and question-level 0G results |
| `POST /api/evaluations` | Create capability links |
| `GET /api/evaluations/[id]` | Read the capability-scoped view |
| `POST /api/evaluations/[id]/submit` | Run one atomic 0G evaluation |
| `GET /api/health` | Non-secret readiness |

## Local development

Requirements:

- Node.js 22
- npm 10.9.4
- a funded 0G Private trust-mode inference key
- a Supabase server secret key
- a random capability pepper of at least 32 characters

```bash
npm ci
cp .env.example .env.local
npm run check
npm run dev
```

Production must use:

```dotenv
ZERO_G_BASE_URL=https://router-api.0g.ai/v1
ZERO_G_API_KEY=sk-...
ZERO_G_MODEL=<private-capable-model>
```

`TEST_ZERO_G_API_KEY` is not read by the application. Never prefix secrets
with `NEXT_PUBLIC_`, commit `.env.local`, or test with a real seller dataset.

Paid 0G suites require both their suite flag and `ALLOW_PAID_0G=1`:

```bash
ALLOW_PAID_0G=1 npm run test:0g
ALLOW_PAID_0G=1 npm run test:scoring
ALLOW_PAID_0G=1 npm run test:e2e
```

The E2E reliability loop is deliberately staged:

```bash
# Three baseline scenarios. Run this after every scoring change.
ALLOW_PAID_0G=1 npm run test:e2e

# Three harder interval and semantic-quality scenarios. Run only after baseline passes.
ALLOW_PAID_0G=1 npm run test:e2e:hard

# Three seeded adversarial datasets with nine independently known scores.
ALLOW_PAID_0G=1 npm run test:e2e:adversarial

# One maximum-size, five-question prompt-injection stress scenario.
ALLOW_PAID_0G=1 npm run test:e2e:stress

# The complete staged suite. Run only after the smaller tiers pass.
ALLOW_PAID_0G=1 npm run test:e2e:full
```

Each scenario makes one 0G request, has no automatic retry, checks every score
against a precomputed expectation, and deletes its temporary Supabase row.
Failed output validation logs only a safe failure code, never raw model output.

The Supabase-only live check is separate and makes no 0G request:

```bash
npm run test:supabase
```

Do not run a paid suite without explicit cost approval.

## Important paths

- [Atomic 0G evaluator](src/lib/scoring/score-sample.ts)
- [Strict response validator](src/lib/scoring/evaluation-output.ts)
- [Private prompt envelope](src/lib/scoring/evaluation-prompt.ts)
- [0G client](src/lib/zero-g/client.ts)
- [Submission state transition](src/lib/evaluations/submit.ts)
- [Supabase repository](src/lib/supabase/evaluations.ts)
- [Buyer results](src/components/buyer-results.tsx)
- [Execution plan](docs/EXECUTION_PLAN.md)
- [Build log](docs/BUILD_LOG.md)

## Verification

```bash
npm run check
```

This runs lint, TypeScript, all non-live tests, and the production build.
GitHub Actions runs the same checks on Node.js 22.

## License

[MIT](LICENSE)
