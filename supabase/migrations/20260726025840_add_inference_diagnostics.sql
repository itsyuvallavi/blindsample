alter table public.evaluations
  add column inference_diagnostics jsonb not null
  default '{"requestCount":{"made":0,"maximum":6},"requests":[]}'::jsonb;

alter table public.evaluations
  add constraint evaluations_inference_diagnostics_check
  check (
    jsonb_typeof(inference_diagnostics) = 'object'
    and (inference_diagnostics - 'requestCount' - 'requests') = '{}'::jsonb
    and jsonb_typeof(inference_diagnostics -> 'requestCount') = 'object'
    and (
      (inference_diagnostics -> 'requestCount') - 'made' - 'maximum'
    ) = '{}'::jsonb
    and jsonb_typeof(inference_diagnostics -> 'requests') = 'array'
    and jsonb_array_length(
      inference_diagnostics -> 'requests'
    ) between 0 and 6
    and pg_column_size(inference_diagnostics) <= 16000
    and case
      when
        (inference_diagnostics #>> '{requestCount,made}') ~ '^\d+$'
        and char_length(
          inference_diagnostics #>> '{requestCount,made}'
        ) between 1 and 2
        and (
          inference_diagnostics #>> '{requestCount,maximum}'
        ) ~ '^\d+$'
        and char_length(
          inference_diagnostics #>> '{requestCount,maximum}'
        ) between 1 and 2
      then
        (
          inference_diagnostics #>> '{requestCount,made}'
        )::integer between 0 and 6
        and (
          inference_diagnostics #>> '{requestCount,maximum}'
        )::integer between 0 and 6
        and (
          inference_diagnostics #>> '{requestCount,made}'
        )::integer <= (
          inference_diagnostics #>> '{requestCount,maximum}'
        )::integer
      else false
    end
  );

comment on column public.evaluations.inference_diagnostics is
  'Bounded allowlisted 0G request metadata only. Prompts, submitted records, response content, reasoning content, credentials, and capability tokens are forbidden.';
