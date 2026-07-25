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
a TEE-verified trace. Persistence, strict scoring, and the buyer/seller product
flows are the next implementation milestones.

## Local development

Requirements:

- Node.js 22
- npm
- A funded 0G Private Computer inference key with Private trust mode

Install and verify:

```bash
npm ci
cp .env.example .env.local
npm run check
```

Add the private `sk-...` inference key to `.env.local`, then start the app:

```bash
npm run dev
```

Never commit `.env.local` or a real dataset sample.

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

## Documentation

- [Execution plan](docs/EXECUTION_PLAN.md)
- [Build log](docs/BUILD_LOG.md)

Integration and deployment instructions will be added as those milestones
become runnable.

## License

[MIT](LICENSE)
