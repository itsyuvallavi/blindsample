create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  environment text not null
    check (environment in ('development', 'preview', 'production')),
  title text not null
    check (char_length(btrim(title)) between 1 and 80),
  status text not null default 'waiting_for_seller'
    check (status in ('waiting_for_seller', 'processing', 'complete', 'failed')),
  questions jsonb not null
    check (
      case
        when jsonb_typeof(questions) = 'array'
          then jsonb_array_length(questions) between 1 and 20
        else false
      end
    ),
  scores jsonb
    check (
      scores is null
      or case
        when jsonb_typeof(scores) = 'array'
          then jsonb_array_length(scores) between 1 and 20
        else false
      end
    ),
  buyer_token_hash text not null unique
    check (buyer_token_hash ~ '^[0-9a-f]{64}$'),
  seller_token_hash text not null unique
    check (seller_token_hash ~ '^[0-9a-f]{64}$'),
  sample_row_count integer
    check (sample_row_count between 1 and 200),
  sample_column_count integer
    check (sample_column_count between 1 and 20),
  zero_g_model text,
  zero_g_provider text,
  zero_g_request_id text,
  tee_verified boolean not null default false,
  error_code text
    check (
      error_code is null
      or (
        char_length(error_code) between 1 and 64
        and error_code ~ '^[a-z0-9_]+$'
      )
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null,
  constraint evaluations_distinct_capabilities
    check (buyer_token_hash <> seller_token_hash),
  constraint evaluations_valid_expiry
    check (expires_at > created_at),
  constraint evaluations_complete_result
    check (
      status <> 'complete'
      or (
        scores is not null
        and tee_verified
        and completed_at is not null
        and sample_row_count is not null
        and sample_column_count is not null
        and zero_g_model is not null
        and zero_g_provider is not null
        and zero_g_request_id is not null
        and error_code is null
      )
    ),
  constraint evaluations_unpublished_result
    check (
      status = 'complete'
      or (
        scores is null
        and not tee_verified
        and completed_at is null
      )
    ),
  constraint evaluations_failure_state
    check (
      (status = 'failed' and error_code is not null)
      or (status <> 'failed' and error_code is null)
    )
);

create index evaluations_environment_status_expires_idx
  on public.evaluations (environment, status, expires_at);

alter table public.evaluations enable row level security;

revoke all on table public.evaluations from anon, authenticated;
grant select, insert, update, delete on table public.evaluations to service_role;

comment on table public.evaluations is
  'BlindSample coordination metadata. Raw dataset samples and prompts are forbidden.';

comment on column public.evaluations.questions is
  'Validated buyer questions only; never model prompts or dataset rows.';

comment on column public.evaluations.scores is
  'One validated integer score per buyer question; no overall score or prose.';
