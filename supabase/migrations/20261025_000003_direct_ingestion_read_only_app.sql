-- The React app is a read-only dashboard. Inserts and publication happen only
-- through the Supabase SQL Editor or another trusted database-admin connection.
drop policy if exists "Allowlisted owner can read test sessions" on public.test_sessions;
drop policy if exists "Allowlisted owner can create test sessions" on public.test_sessions;
drop policy if exists "Allowlisted owner can update test sessions" on public.test_sessions;
drop policy if exists "Allowlisted owner can delete test sessions" on public.test_sessions;
drop policy if exists "Allowlisted owner can read model results" on public.model_results;
drop policy if exists "Allowlisted owner can create model results" on public.model_results;
drop policy if exists "Allowlisted owner can update model results" on public.model_results;
drop policy if exists "Allowlisted owner can delete model results" on public.model_results;

drop policy if exists "Owners can read their test sessions" on public.test_sessions;
drop policy if exists "Owners can create unpublished test sessions" on public.test_sessions;
drop policy if exists "Owners can update unpublished test sessions" on public.test_sessions;
drop policy if exists "Owners can delete unpublished test sessions" on public.test_sessions;
drop policy if exists "Owners can read their model results" on public.model_results;
drop policy if exists "Owners can create results for unpublished sessions" on public.model_results;
drop policy if exists "Owners can update results in unpublished sessions" on public.model_results;
drop policy if exists "Owners can delete results in unpublished sessions" on public.model_results;

drop schema if exists private cascade;

alter table public.test_sessions alter column owner_id drop not null;
alter table public.model_results alter column owner_id drop not null;

revoke all on table public.saved_prompts, public.test_sessions, public.model_results, public.model_ratings from anon, authenticated;
grant select on table public.test_sessions, public.model_results to anon;

-- Preserve the published-only anon SELECT policies created by migration 000002.
