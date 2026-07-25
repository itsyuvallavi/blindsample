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

Repository foundation and implementation plan created. Product code has not
yet been implemented.

## Documentation

- [Execution plan](docs/EXECUTION_PLAN.md)
- [Build log](docs/BUILD_LOG.md)

Setup and deployment instructions will be added as the corresponding
implementation becomes runnable.

## License

[MIT](LICENSE)
