alter table public.evaluations
  drop constraint evaluations_inference_diagnostics_check;

alter table public.evaluations
  alter column inference_diagnostics set default
  '{
    "outputValidation": {
      "failureCode": null,
      "status": "not_run"
    },
    "requestCount": {
      "made": 0,
      "maximum": 1
    },
    "requests": []
  }'::jsonb;

update public.evaluations
set inference_diagnostics =
  inference_diagnostics
  || '{
    "outputValidation": {
      "failureCode": null,
      "status": "not_run"
    }
  }'::jsonb
where not (inference_diagnostics ? 'outputValidation');

update public.evaluations
set inference_diagnostics = jsonb_set(
  inference_diagnostics,
  '{requestCount,maximum}',
  '1'::jsonb
)
where (
  inference_diagnostics
  #>> '{requestCount,made}'
)::integer <= 1;

alter table public.evaluations
  add constraint evaluations_inference_diagnostics_check
  check (
    jsonb_typeof(inference_diagnostics) = 'object'
    and (
      inference_diagnostics
      - 'outputValidation'
      - 'requestCount'
      - 'requests'
    ) = '{}'::jsonb
    and jsonb_typeof(
      inference_diagnostics -> 'outputValidation'
    ) = 'object'
    and (
      (inference_diagnostics -> 'outputValidation')
      - 'failureCode'
      - 'status'
    ) = '{}'::jsonb
    and (
      inference_diagnostics
      #>> '{outputValidation,status}'
    ) in ('failed', 'not_run', 'passed')
    and (
      (
        inference_diagnostics
        #> '{outputValidation,failureCode}'
      ) = 'null'::jsonb
      or (
        jsonb_typeof(
          inference_diagnostics
          #> '{outputValidation,failureCode}'
        ) = 'string'
        and (
          inference_diagnostics
          #>> '{outputValidation,failureCode}'
        ) ~ '^[a-z0-9_]{1,64}$'
      )
    )
    and (
      (
        inference_diagnostics
        #>> '{outputValidation,status}'
      ) = 'failed'
      or (
        inference_diagnostics
        #> '{outputValidation,failureCode}'
      ) = 'null'::jsonb
    )
    and jsonb_typeof(
      inference_diagnostics -> 'requestCount'
    ) = 'object'
    and (
      (inference_diagnostics -> 'requestCount')
      - 'made'
      - 'maximum'
    ) = '{}'::jsonb
    and jsonb_typeof(inference_diagnostics -> 'requests') = 'array'
    and pg_column_size(inference_diagnostics) <= 16000
    and case
      when
        (inference_diagnostics #>> '{requestCount,made}') ~ '^\d$'
        and (
          inference_diagnostics
          #>> '{requestCount,maximum}'
        ) ~ '^\d$'
      then
        case
          when
            created_at < timestamptz '2026-07-26 17:57:58+00'
            and (
              inference_diagnostics
              #>> '{requestCount,made}'
            )::integer > 1
          then
            (
              inference_diagnostics
              #>> '{requestCount,made}'
            )::integer between 0 and 6
            and (
              inference_diagnostics
              #>> '{requestCount,maximum}'
            )::integer between 0 and 6
            and (
              inference_diagnostics
              #>> '{requestCount,made}'
            )::integer <= (
              inference_diagnostics
              #>> '{requestCount,maximum}'
            )::integer
            and jsonb_array_length(
              inference_diagnostics -> 'requests'
            ) between 0 and 6
          else
            (
              inference_diagnostics
              #>> '{requestCount,made}'
            )::integer between 0 and 1
            and (
              inference_diagnostics
              #>> '{requestCount,maximum}'
            )::integer = 1
            and jsonb_array_length(
              inference_diagnostics -> 'requests'
            ) between 0 and 1
        end
      else false
    end
  );

comment on column public.evaluations.inference_diagnostics is
  'Bounded allowlisted 0G request metadata only. New evaluations permit one request. Prompts, submitted records, response content, reasoning content, credentials, and capability tokens are forbidden.';
