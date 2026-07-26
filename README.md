# BlindSample

BlindSample is a private dataset suitability scorer built for the **Best AI
Product on 0G** track at ETHGlobal Lisbon 2026.

A buyer asks multiple questions about a dataset. A seller submits a CSV
sample. 0G Private Computer evaluates the sample and returns one independent
integer score from 1 to 100 for each question. The buyer never receives the raw
sample.

## Product contract

- Every buyer question receives exactly one score.
- Every score is an integer from 1 to 100.
- Questions are scored independently.
- There is no overall score.
- The scoring response contains no written recommendation.
- Results apply only to the seller-submitted sample.

## Hackathon MVP

The first version will support:

- CSV samples with explicit size limits
- Multiple buyer questions
- Private inference through a TeeML provider on 0G
- TEE verification for every evaluation
- A results screen showing each question and its score
- No permanent storage of raw dataset samples

The MVP will not include a marketplace, payments, custom smart contracts,
0G Storage, key release, or a custom TEE provider.

## Current status

The public repository, implementation plan, and reproducible web application
baseline are complete. The `build/mvp` branch includes:

- Next.js App Router with TypeScript and Node.js 22
- A minimal BlindSample landing route and health endpoint
- Executable product-contract tests
- Lint, typecheck, test, and production-build commands
- One GitHub Actions verification workflow

The reusable 0G client is implemented and a live private request has returned
a TEE-verified trace. The Supabase project and private metadata schema are
deployed, with RLS and browser grants locked down. Live role separation,
concurrent submission claiming, result persistence, and cleanup are verified.
The strict CSV and question-to-score pipeline and capability-scoped API routes
are implemented. The replacement testnet key authenticates successfully; its
final live proof is waiting for testnet Router balance. The buyer and seller
pages are the next implementation milestone.

## Local development

Requirements:

- Node.js 22
- npm 10.9.4
- A funded 0G testnet Router key created with Private trust mode
- A Supabase `sb_secret_...` key for the BlindSample project
- A random capability-token pepper containing at least 32 characters

Install and verify:

```bash
npm ci
cp .env.example .env.local
npm run check
```

Add the server-only values shown in `.env.example` to `.env.local`, then start
the app:

```bash
npm run dev
```

Never commit `.env.local` or a real dataset sample.

Testnet Router keys must use the testnet endpoint in `.env.example`. Testnet
and mainnet keys and balances are separate.

## 0G integration

The server-side client is implemented in
[`src/lib/zero-g/client.ts`](src/lib/zero-g/client.ts). Every request:

- Sends `X-0G-Provider-Trust-Mode: private`
- Sends `verify_tee: true`
- Rejects missing or false `tee_verified` results
- Retains only the model, provider, request ID, and verification result as safe
  trace metadata
- Retries one transient `429` or `503` response without weakening trust mode

Run the opt-in live verification with:

```bash
npm run test:0g
```

The returned `tee_verified` value is verification reported by 0G Router. It is
not an independently reproduced attestation inside BlindSample.

## Application API

- `POST /api/evaluations` validates the buyer's title and questions, stores
  only metadata and token hashes, and returns separate buyer and seller paths.
- `GET /api/evaluations/[id]` requires a capability in the
  `Authorization: Bearer ...` header and returns only that role's view.
- `POST /api/evaluations/[id]/submit` accepts one bounded CSV sample in memory,
  performs private scoring, and persists only scores plus safe trace metadata.

Capability tokens live in URL fragments so browsers do not send them in HTTP
requests until the page explicitly places them in an authorization header.

## Strict scoring pipeline

[`src/lib/csv/parse-sample.ts`](src/lib/csv/parse-sample.ts) validates UTF-8
CSV samples in memory and enforces the byte, row, and column limits.
[`src/lib/scoring/score-sample.ts`](src/lib/scoring/score-sample.ts) sends a
fixed privacy-aware prompt through the verified 0G client and retries malformed
model output once.

The response parser accepts only a JSON `scores` array containing each exact
question ID once and one integer from 1 to 100. It rejects prose, explanations,
missing or duplicate IDs, decimals, extra keys, and overall scores.

## Supabase persistence

The only application table is defined in
[`supabase/migrations/20260725234857_create_evaluations.sql`](supabase/migrations/20260725234857_create_evaluations.sql).
It stores evaluation metadata, HMAC capability hashes, question-level scores,
and safe 0G trace fields. It never stores CSV contents, raw capability tokens,
or model prompts.

The server repository is in
[`src/lib/supabase/evaluations.ts`](src/lib/supabase/evaluations.ts). Browser
roles have no direct table grants, and all runtime access uses an unprefixed
server-only secret.

## Documentation

- [Execution plan](docs/EXECUTION_PLAN.md)
- [Build log](docs/BUILD_LOG.md)

Integration and deployment instructions will be added as those milestones
become runnable.

## License

[MIT](LICENSE)
