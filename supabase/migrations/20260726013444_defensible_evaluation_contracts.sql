alter table public.evaluations
  drop constraint evaluations_complete_result,
  drop constraint evaluations_unpublished_result,
  drop constraint evaluations_questions_check,
  drop constraint evaluations_scores_check,
  drop constraint evaluations_sample_row_count_check;

alter table public.evaluations
  rename column questions to contracts;

alter table public.evaluations
  rename column scores to results;

alter table public.evaluations
  add column approved_at timestamptz not null,
  add column contract_set_hash text not null
    check (contract_set_hash ~ '^[0-9a-f]{64}$');

alter table public.evaluations
  drop column zero_g_model,
  drop column zero_g_provider,
  drop column zero_g_request_id,
  drop column tee_verified;

alter table public.evaluations
  add constraint evaluations_contracts_check
    check (
      case
        when jsonb_typeof(contracts) = 'array'
          then jsonb_array_length(contracts) between 1 and 20
        else false
      end
    ),
  add constraint evaluations_results_check
    check (
      results is null
      or case
        when jsonb_typeof(results) = 'array'
          then jsonb_array_length(results) between 1 and 20
        else false
      end
    ),
  add constraint evaluations_sample_row_count_check
    check (sample_row_count between 1 and 50),
  add constraint evaluations_complete_result
    check (
      status <> 'complete'
      or (
        results is not null
        and jsonb_array_length(results) = jsonb_array_length(contracts)
        and completed_at is not null
        and sample_row_count is not null
        and sample_column_count is not null
        and error_code is null
      )
    ),
  add constraint evaluations_unpublished_result
    check (
      status = 'complete'
      or (
        results is null
        and completed_at is null
      )
    );

comment on table public.evaluations is
  'BlindSample approved contracts, safe aggregate results, and coordination metadata. Raw dataset records, prompts, and capability tokens are forbidden.';

comment on column public.evaluations.contracts is
  'Exact versioned evaluation contracts reviewed and approved by the buyer before seller-link activation.';

comment on column public.evaluations.contract_set_hash is
  'SHA-256 digest binding buyer approval to the exact stored contract set.';

comment on column public.evaluations.results is
  'One structured scored or unable_to_score result per approved contract. Never contains raw records or an overall score.';

comment on column public.evaluations.sample_row_count is
  'Count of parsed submitted CSV data records. The header is excluded; no claim is made about the seller full dataset.';
