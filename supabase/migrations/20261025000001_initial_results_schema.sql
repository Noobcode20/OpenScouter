create table if not exists public.saved_prompts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  title text not null default '',
  prompt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  saved_prompt_id uuid references public.saved_prompts(id) on delete set null,
  task text not null,
  prompt text not null,
  label text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.model_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.test_sessions(id) on delete cascade,
  model_id text not null,
  model_name text not null,
  provider text not null default '',
  status text not null default 'success' check (status in ('success', 'error', 'cancelled')),
  response_text text not null default '',
  error_message text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  cost_usd numeric(14, 8) check (cost_usd is null or cost_usd >= 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.model_ratings (
  owner_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  model_id text not null,
  rating smallint not null check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (owner_id, task, model_id)
);

create index if not exists test_sessions_owner_created_idx
  on public.test_sessions (owner_id, created_at desc);
create index if not exists model_results_session_created_idx
  on public.model_results (session_id, created_at);
create index if not exists model_results_owner_created_idx
  on public.model_results (owner_id, created_at desc);

alter table public.saved_prompts enable row level security;
alter table public.test_sessions enable row level security;
alter table public.model_results enable row level security;
alter table public.model_ratings enable row level security;

revoke all on table public.saved_prompts, public.test_sessions, public.model_results, public.model_ratings from anon, authenticated;
grant select, insert, update, delete on table public.saved_prompts, public.test_sessions, public.model_results, public.model_ratings to authenticated;

create policy "Users manage their saved prompts"
  on public.saved_prompts for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Users manage their test sessions"
  on public.test_sessions for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and (
      saved_prompt_id is null
      or exists (
        select 1 from public.saved_prompts p
        where p.id = saved_prompt_id and p.owner_id = (select auth.uid())
      )
    )
  );

create policy "Users manage their own model results"
  on public.model_results for all to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.test_sessions s
      where s.id = session_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.test_sessions s
      where s.id = session_id and s.owner_id = (select auth.uid())
    )
  );

create policy "Users manage their own model ratings"
  on public.model_ratings for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
