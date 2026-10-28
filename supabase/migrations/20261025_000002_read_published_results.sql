alter table public.test_sessions
  add column if not exists is_published boolean not null default false;

grant select on table public.test_sessions, public.model_results to anon;
revoke insert, update, delete on table public.test_sessions, public.model_results from anon;

drop policy if exists "Users manage their test sessions" on public.test_sessions;
drop policy if exists "Users manage their own model results" on public.model_results;

create policy "Visitors can read published test sessions"
  on public.test_sessions for select to anon
  using (is_published);

create policy "Owners can read their test sessions"
  on public.test_sessions for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can create unpublished test sessions"
  on public.test_sessions for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and not is_published
    and (
      saved_prompt_id is null
      or exists (
        select 1 from public.saved_prompts p
        where p.id = saved_prompt_id and p.owner_id = (select auth.uid())
      )
    )
  );

create policy "Owners can update unpublished test sessions"
  on public.test_sessions for update to authenticated
  using ((select auth.uid()) = owner_id and not is_published)
  with check (
    (select auth.uid()) = owner_id
    and not is_published
    and (
      saved_prompt_id is null
      or exists (
        select 1 from public.saved_prompts p
        where p.id = saved_prompt_id and p.owner_id = (select auth.uid())
      )
    )
  );

create policy "Owners can delete unpublished test sessions"
  on public.test_sessions for delete to authenticated
  using ((select auth.uid()) = owner_id and not is_published);

create policy "Visitors can read results from published sessions"
  on public.model_results for select to anon
  using (
    exists (
      select 1 from public.test_sessions s
      where s.id = session_id and s.is_published
    )
  );

create policy "Owners can read their model results"
  on public.model_results for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can create results for unpublished sessions"
  on public.model_results for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.test_sessions s
      where s.id = session_id
        and s.owner_id = (select auth.uid())
        and not s.is_published
    )
  );

create policy "Owners can update results in unpublished sessions"
  on public.model_results for update to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.test_sessions s
      where s.id = session_id
        and s.owner_id = (select auth.uid())
        and not s.is_published
    )
  )
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.test_sessions s
      where s.id = session_id
        and s.owner_id = (select auth.uid())
        and not s.is_published
    )
  );

create policy "Owners can delete results in unpublished sessions"
  on public.model_results for delete to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.test_sessions s
      where s.id = session_id
        and s.owner_id = (select auth.uid())
        and not s.is_published
    )
  );
