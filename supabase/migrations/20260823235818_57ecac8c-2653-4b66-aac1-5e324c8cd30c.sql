-- 1) Audit trail: require case/session membership for inserted entries
drop policy "Users can write their own audit entries" on public.audit_logs;
create policy "Users can write their own audit entries"
on public.audit_logs for insert to authenticated
with check (
  actor_id = auth.uid()
  and (
    case_id is null
    or public.is_case_member(case_id)
    or exists (select 1 from public.cases c where c.id = case_id and c.created_by = auth.uid())
  )
  and (
    session_id is null
    or public.can_access_session(session_id)
  )
);

-- 2) Member removal: creators may remove anyone; members may only remove themselves
drop policy "Case creators and members can remove members" on public.case_members;
create policy "Case creators and members can remove members"
on public.case_members for delete to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.cases c
    where c.id = case_id and c.created_by = auth.uid()
  )
);

-- 3) Review-role gate for claims and claim anchors
create or replace function public.has_review_role(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'lawyer')
      or public.has_role(_user_id, 'paralegal')
      or public.has_role(_user_id, 'reviewer')
$$;

revoke execute on function public.has_review_role(uuid) from public, anon;
grant execute on function public.has_review_role(uuid) to authenticated, service_role;

drop policy "claims insertable by session members" on public.claims;
create policy "claims insertable by session members"
on public.claims for insert to authenticated
with check (
  public.can_access_session(session_id)
  and created_by = auth.uid()
  and public.has_review_role(auth.uid())
);

drop policy "claims updatable by session members" on public.claims;
create policy "claims updatable by session members"
on public.claims for update to authenticated
using (
  public.can_access_session(session_id)
  and public.has_review_role(auth.uid())
)
with check (
  public.can_access_session(session_id)
  and public.has_review_role(auth.uid())
);

drop policy "claims deletable by session members" on public.claims;
create policy "claims deletable by session members"
on public.claims for delete to authenticated
using (
  public.can_access_session(session_id)
  and public.has_review_role(auth.uid())
);

drop policy "claim anchors insertable by session members" on public.claim_anchors;
create policy "claim anchors insertable by session members"
on public.claim_anchors for insert to authenticated
with check (
  exists (
    select 1 from public.claims c
    where c.id = claim_anchors.claim_id
      and public.can_access_session(c.session_id)
  )
  and public.has_review_role(auth.uid())
);

drop policy "claim anchors updatable by session members" on public.claim_anchors;
create policy "claim anchors updatable by session members"
on public.claim_anchors for update to authenticated
using (
  exists (
    select 1 from public.claims c
    where c.id = claim_anchors.claim_id
      and public.can_access_session(c.session_id)
  )
  and public.has_review_role(auth.uid())
)
with check (
  exists (
    select 1 from public.claims c
    where c.id = claim_anchors.claim_id
      and public.can_access_session(c.session_id)
  )
  and public.has_review_role(auth.uid())
);

drop policy "claim anchors deletable by session members" on public.claim_anchors;
create policy "claim anchors deletable by session members"
on public.claim_anchors for delete to authenticated
using (
  exists (
    select 1 from public.claims c
    where c.id = claim_anchors.claim_id
      and public.can_access_session(c.session_id)
  )
  and public.has_review_role(auth.uid())
);

-- 4) Demo flag: only backend (service role) or direct SQL may set it
create or replace function public.guard_is_demo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  -- Direct SQL (migrations, admin) and service role may set is_demo
  if jwt_role = '' or jwt_role = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_demo := false;
  else
    new.is_demo := old.is_demo;
  end if;
  return new;
end;
$$;

drop trigger if exists cases_guard_is_demo on public.cases;
create trigger cases_guard_is_demo
before insert or update of is_demo on public.cases
for each row execute function public.guard_is_demo();

drop trigger if exists sessions_guard_is_demo on public.sessions;
create trigger sessions_guard_is_demo
before insert or update of is_demo on public.sessions
for each row execute function public.guard_is_demo();