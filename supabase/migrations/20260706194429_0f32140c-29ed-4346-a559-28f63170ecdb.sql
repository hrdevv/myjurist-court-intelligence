-- ============================================================
-- Phase 1: Foundation schema for Courtroom Intelligence
-- cases, case_members, sessions, audit_logs + RLS + GRANTs
-- ============================================================

-- ---------------- Tables (created before the helper fn) ----------------
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  reference text not null,
  court text,
  status text not null default 'active',
  is_demo boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.case_members (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (case_id, user_id)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  date date,
  status text not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  case_id uuid,
  session_id uuid,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------------- Helper: case membership (avoids RLS recursion) ----------------
create or replace function public.is_case_member(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.case_members
    where case_id = _case_id and user_id = auth.uid()
  )
$$;

-- ---------------- GRANTs ----------------
grant select, insert, update, delete on public.cases to authenticated;
grant all on public.cases to service_role;
grant select, insert, update, delete on public.case_members to authenticated;
grant all on public.case_members to service_role;
grant select, insert, update, delete on public.sessions to authenticated;
grant all on public.sessions to service_role;
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

-- ---------------- RLS ----------------
alter table public.cases enable row level security;
alter table public.case_members enable row level security;
alter table public.sessions enable row level security;
alter table public.audit_logs enable row level security;

-- cases policies
create policy "Members and creators can view cases, plus demo"
  on public.cases for select to authenticated
  using (is_demo or created_by = auth.uid() or public.is_case_member(id));

create policy "Authenticated users can create cases"
  on public.cases for insert to authenticated
  with check (created_by = auth.uid());

create policy "Members and creators can update cases"
  on public.cases for update to authenticated
  using (created_by = auth.uid() or public.is_case_member(id))
  with check (created_by = auth.uid() or public.is_case_member(id));

create policy "Creators can delete their cases"
  on public.cases for delete to authenticated
  using (created_by = auth.uid());

-- case_members policies
create policy "Users can view their own memberships and co-members"
  on public.case_members for select to authenticated
  using (user_id = auth.uid() or public.is_case_member(case_id));

create policy "Case creators and members can add members"
  on public.case_members for insert to authenticated
  with check (
    exists (select 1 from public.cases c where c.id = case_id and c.created_by = auth.uid())
    or public.is_case_member(case_id)
  );

create policy "Case creators and members can remove members"
  on public.case_members for delete to authenticated
  using (
    exists (select 1 from public.cases c where c.id = case_id and c.created_by = auth.uid())
    or public.is_case_member(case_id)
  );

-- sessions policies
create policy "Case viewers can view sessions"
  on public.sessions for select to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and (c.is_demo or c.created_by = auth.uid() or public.is_case_member(c.id))
    )
  );

create policy "Case members can create sessions"
  on public.sessions for insert to authenticated
  with check (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and (c.created_by = auth.uid() or public.is_case_member(c.id))
    )
  );

create policy "Case members can update sessions"
  on public.sessions for update to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and (c.created_by = auth.uid() or public.is_case_member(c.id))
    )
  )
  with check (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and (c.created_by = auth.uid() or public.is_case_member(c.id))
    )
  );

create policy "Case members can delete sessions"
  on public.sessions for delete to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and (c.created_by = auth.uid() or public.is_case_member(c.id))
    )
  );

-- audit_logs policies
create policy "Users can view audit logs for their cases"
  on public.audit_logs for select to authenticated
  using (
    actor_id = auth.uid()
    or (case_id is not null and public.is_case_member(case_id))
  );

create policy "Users can write their own audit entries"
  on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid());

-- ---------------- updated_at triggers ----------------
create trigger update_cases_updated_at
  before update on public.cases
  for each row execute function public.update_updated_at_column();

create trigger update_sessions_updated_at
  before update on public.sessions
  for each row execute function public.update_updated_at_column();

-- ---------------- Demo seed (visible to every authenticated user) ----------------
insert into public.cases (id, title, reference, court, status, is_demo)
values (
  '11111111-1111-1111-1111-111111111111',
  'Land Dispute Hearing Demo',
  'LDH-2026-001',
  'Federal High Court',
  'active',
  true
);

insert into public.sessions (id, case_id, title, date, status, is_demo)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Preliminary Hearing — Demo Session',
  '2026-05-22',
  'review_pending',
  true
);