# BlindSample Execution Plan

## 1. Track and qualification target

BlindSample will enter **Best AI Product on 0G**.

The submission must contain:

- A working live application or runnable build
- Proof that 0G Compute / Private Computer performs inference
- A public GitHub repository with setup instructions
- A demo video shorter than three minutes
- A live demo link
- A description of every 0G feature or SDK used
- Contract deployment addresses, or an explicit statement that no custom
  contracts were deployed
- Team member names and contact details required by the sponsor

The repository must have meaningful Git history produced during the
hackathon. Any reused project-specific work must be disclosed.

## 2. Fixed product scope

### User flow

1. The buyer adds one or more questions.
2. The seller reviews the questions and selects a CSV sample.
3. BlindSample sends the questions and sample for private 0G inference.
4. 0G returns one score from 1 to 100 for every question.
5. BlindSample validates the response.
6. The buyer sees question-level scores and the TEE verification status.

### Scoring contract

- `100`: the sample fully satisfies the question.
- `50`: the sample partially satisfies the question or provides weak evidence.
- `1`: the sample does not satisfy the question or the answer cannot be
  established from the sample.
- Scores must be whole numbers.
- There is no overall score, weighting, average, or written recommendation.

### MVP limits

- CSV only
- Maximum 200 rows
- Maximum 20 columns
- Maximum 20 questions
- One evaluation per request
- No raw-data persistence

### Explicit non-goals

- Dataset marketplace or purchasing
- Payment or key-release contracts
- 0G Storage
- Custom inference-provider infrastructure
- Arbitrary dataset formats
- Proof that the sample represents the seller's complete dataset

## 3. Technical architecture

### Initial implementation

```text
Buyer questions + seller CSV sample
                  |
                  v
          BlindSample API route
                  |
                  v
       0G Router in private mode
                  |
                  v
        TeeML inference provider
                  |
                  v
    Scores + x_0g_trace.tee_verified
                  |
                  v
        Validation and results UI
```

The 0G API key remains server-side. Raw CSV contents must not be logged or
written to application storage. The privacy statement must acknowledge that
the application server handles the request transiently. A browser-to-provider
Direct integration is a post-MVP enhancement.

### Planned stack

- Next.js and TypeScript
- Server-side 0G Router call
- Private provider trust mode
- `verify_tee: true` on every evaluation
- Runtime schema validation for model output
- A single deployed web application

## 4. Implementation phases

### Phase A — Repository foundation

- Create the public repository.
- Add the product contract, plan, and chronological build log.
- Make a small initial commit before application code.

Acceptance criteria:

- Public repository exists.
- Default branch has a clear initial commit.
- No secrets, generated files, or speculative code are committed.

### Phase B — 0G proof

- Configure a privately funded 0G Router API key.
- Select a currently available TeeML model.
- Send a minimal private inference request.
- Request synchronous TEE verification.
- Capture the model, provider, request ID, and `tee_verified` result without
  recording prompts, CSV contents, keys, or wallet secrets.

Acceptance criteria:

- A real request returns a valid score.
- `x_0g_trace.tee_verified` is `true`.
- The API key is stored only in ignored local/deployment environment files.

### Phase C — Scoring engine

- Define question and score schemas.
- Construct a fixed evaluation prompt.
- Require one result for every question ID.
- Reject missing, duplicate, non-integer, or out-of-range scores.
- Retry one time after malformed model output.

Acceptance criteria:

- N questions produce exactly N independently validated scores.
- Every score is an integer from 1 to 100.
- No overall score is produced or calculated.

### Phase D — User interface

- Build the buyer-question step.
- Build the seller CSV-selection step.
- Validate CSV limits before submission.
- Build the results table and TEE-verification panel.
- Include the sample-only limitation next to every result set.

Acceptance criteria:

- A user can complete the entire flow without editing code.
- Raw rows do not appear on the buyer results screen.
- Loading, validation, empty, and error states are usable.

### Phase E — Reliability and privacy checks

- Test strong, weak, mixed, malformed, and oversized samples.
- Run repeat evaluations to inspect score stability.
- Confirm request bodies are never logged.
- Confirm no raw sample is written to disk or a database.
- Confirm every production evaluation requests private routing and TEE
  verification.

Acceptance criteria:

- Automated checks cover response validation and CSV limits.
- The complete production build passes.
- Known limitations are documented without overstating privacy.

### Phase F — Deployment and submission

- Deploy the application.
- Verify the deployed end-to-end flow.
- Complete README setup, architecture, privacy, and 0G integration sections.
- Record a demonstration shorter than three minutes.
- Add the live link, video, team details, and contract-address statement to the
  ETHGlobal submission.

Acceptance criteria:

- The live application performs a real 0G evaluation.
- A fresh reviewer can run the repository from the README.
- The video visibly demonstrates question creation, CSV submission,
  question-level scores, and successful TEE verification.

## 5. Documentation discipline

To keep the repository clean:

- `README.md` describes the product and how to run it.
- This file owns scope, architecture, requirements, and acceptance criteria.
- `BUILD_LOG.md` records completed milestones and material decisions.
- Source code comments explain only non-obvious implementation constraints.
- Generated output, raw datasets, secrets, request payloads, and routine command
  transcripts are never committed.
- Documentation is updated in the same commit as the feature it describes.

## 6. Commit strategy

Planned commits:

1. `docs: establish BlindSample project scope`
2. `chore: scaffold the web application`
3. `feat: prove private verified inference on 0G`
4. `feat: validate question-level scores`
5. `feat: add buyer and seller evaluation flow`
6. `test: cover scoring and CSV validation`
7. `docs: complete deployment and submission guide`

Commits may be split further when implementation boundaries warrant it. They
must not be collapsed into one final hackathon commit.
