# BlindSample

BlindSample lets a buyer evaluate a private CSV sample without receiving its
rows. The buyer defines measurable questions, approves the exact scoring
contracts, and receives one audited result per question.

Built for the **Best AI Product on 0G** track at ETHGlobal Lisbon 2026.

## What the product does

1. A buyer creates evaluation criteria.
2. BlindSample converts them into versioned scoring contracts.
3. The buyer reviews and approves those contracts.
4. A separate seller link accepts one CSV containing 1–50 parsed data records.
5. Exact metrics run in application code. Semantic classification runs
   privately through 0G.
6. The buyer sees one `1–100` or `unable_to_score` result per approved
   question, plus safe audit evidence.

BlindSample never calculates an overall score. A result describes only the
submitted records and cannot prove that the sample represents the seller's
complete dataset.

## Why 0G is load-bearing

Every activated evaluation must contain at least one semantic criterion.
Semantic evidence is classified through 0G Private Computer using:

- `X-0G-Provider-Trust-Mode: private`
- a TeeML provider
- `verify_tee: true`
- a required `tee_verified === true` response

The model returns rubric labels per submitted record, not a final score.
BlindSample validates those labels and calculates the final integer itself.
No numeric semantic result is published without verified private 0G execution.

Objective criteria—including completeness, format validity, uniqueness,
freshness, numeric ranges, column availability, and category coverage—use
deterministic application code.

TEE verification proves protected execution. It does not prove that a judgment
is correct.

## Defensible semantic scoring

Each semantic contract includes a buyer-approved target and human-reviewed
negative, intermediate, and positive controls.

A semantic result is published only when:

- all controls receive their expected labels;
- at least three submitted records provide usable evidence;
- usable evidence covers at least 80% of submitted records;
- a repeated classification of a canonical subset agrees at least 80%; and
- both 0G requests are private and TEE verified.

Otherwise the result is `unable_to_score`. Uncertainty is never converted into
an arbitrary number.

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
- one accepted contract produces one result record
- scored results are integers from 1 to 100
- insufficient or unreliable evidence produces `unable_to_score`
- raw CSV rows, prompts, and capability tokens are never persisted

A one-record CSV is accepted, but its coverage is extremely limited. A
semantic contract will normally be unable to score because it requires at
least three usable records.

## Privacy and access model

The buyer and seller receive separate high-entropy capability links:

- the seller can read approved contracts and submit one sample;
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
Buyer → contract preview → buyer approval → separate capability links
                                              |
Seller → bounded CSV → in-memory parser -------+
                         |                     |
                         | exact metrics       | semantic evidence
                         v                     v
                  deterministic code     0G Private Computer
                         |                     |
                         +------ validated ----+
                                   |
                          question-level results
                                   |
                                Supabase
                                   |
                              Buyer results
```

Supabase stores only approved contracts, the contract-set hash, state,
aggregate result evidence, safe 0G request traces, token hashes, and
non-sensitive dimensions.

BlindSample does not use 0G Storage, a custom smart contract, payments,
accounts, or dataset delivery in this MVP.

## Application routes

| Route | Purpose |
|---|---|
| `/` | Create and approve an evaluation |
| `/submit/[id]` | Seller contract review and CSV submission |
| `/results/[id]` | Buyer status and question-level results |
| `POST /api/evaluation-contracts` | Compile a preview without creating links |
| `POST /api/evaluations` | Activate an approved contract set |
| `GET /api/evaluations/[id]` | Return the capability-scoped view |
| `POST /api/evaluations/[id]/submit` | Claim and evaluate one bounded sample |
| `GET /api/health` | Non-secret readiness |

## Local development

Requirements:

- Node.js 22
- npm 10.9.4
- a funded 0G testnet inference key created in Private trust mode
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
```

Testnet and mainnet 0G keys, endpoints, and Router balances are separate.

## Important implementation paths

- [Evaluation contracts](src/lib/evaluation-contracts)
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
