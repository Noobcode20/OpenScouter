-- Structured results for the OpenCode free-model benchmark.
alter table public.test_sessions
  add column if not exists benchmark_id text,
  add column if not exists benchmark_version text,
  add column if not exists benchmark_provider text,
  add column if not exists run_status text not null default 'completed';

alter table public.model_results
  add column if not exists scorecard_json jsonb not null default '{}'::jsonb,
  add column if not exists summary text not null default '',
  add column if not exists strengths text[] not null default '{}',
  add column if not exists limitations text[] not null default '{}',
  add column if not exists best_for text[] not null default '{}',
  add column if not exists availability_note text not null default '';

create index if not exists test_sessions_benchmark_idx
  on public.test_sessions (benchmark_version, created_at desc);

create unique index if not exists test_sessions_benchmark_id_uidx
  on public.test_sessions (benchmark_id)
  where benchmark_id is not null;

alter table public.model_results
  drop constraint if exists model_results_status_check;
alter table public.model_results
  add constraint model_results_status_check
  check (status in ('success', 'error', 'cancelled', 'incomplete'));

create unique index if not exists model_results_session_model_uidx
  on public.model_results (session_id, model_id);
