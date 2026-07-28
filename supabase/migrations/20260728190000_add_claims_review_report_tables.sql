-- Persist AI-assisted claims, evidence anchors, and human review decisions.
create table public.ai_claims (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  type text not null,
  text text not null,
  confidence text not null default 'medium',
  support text not null default 'partially_supported',
  review text not null default 'pending',
  reviewer_note text,
  warning text,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.claim_anchors (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.ai_claims(id) on delete cascade,
  segment_id uuid references public.transcript_segments(id) on delete set null,
  status text not null default 'suggested',
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.ai_claims to authenticated;
grant all on public.ai_claims to service_role;
grant select, insert, update, delete on public.claim_anchors to authenticated;
grant all on public.claim_anchors to service_role;

alter table public.ai_claims enable row level security;
alter table public.claim_anchors enable row level security;

create policy "claims selectable by session members"
on public.ai_claims for select to authenticated
using (public.can_access_session(session_id));

create policy "claims insertable by session members"
on public.ai_claims for insert to authenticated
with check (public.can_access_session(session_id));

create policy "claims updatable by session members"
on public.ai_claims for update to authenticated
using (public.can_access_session(session_id))
with check (public.can_access_session(session_id));

create policy "claims deletable by session members"
on public.ai_claims for delete to authenticated
using (public.can_access_session(session_id));

create policy "claim anchors selectable by session members"
on public.claim_anchors for select to authenticated
using (exists (
  select 1 from public.ai_claims c
  where c.id = claim_id and public.can_access_session(c.session_id)
));

create policy "claim anchors insertable by session members"
on public.claim_anchors for insert to authenticated
with check (exists (
  select 1 from public.ai_claims c
  where c.id = claim_id and public.can_access_session(c.session_id)
));

create policy "claim anchors updatable by session members"
on public.claim_anchors for update to authenticated
using (exists (
  select 1 from public.ai_claims c
  where c.id = claim_id and public.can_access_session(c.session_id)
))
with check (exists (
  select 1 from public.ai_claims c
  where c.id = claim_id and public.can_access_session(c.session_id)
));

create policy "claim anchors deletable by session members"
on public.claim_anchors for delete to authenticated
using (exists (
  select 1 from public.ai_claims c
  where c.id = claim_id and public.can_access_session(c.session_id)
));

create trigger update_ai_claims_updated_at
before update on public.ai_claims
for each row execute function public.update_updated_at_column();

create index idx_ai_claims_session on public.ai_claims(session_id);
create index idx_ai_claims_review on public.ai_claims(review);
create index idx_claim_anchors_claim on public.claim_anchors(claim_id);
create index idx_claim_anchors_segment on public.claim_anchors(segment_id);

-- Seed the existing demo session with persisted draft claims and anchors so
-- review/report screens no longer need mock claims when demo outputs are enabled.
with demo_session as (
  select s.id
  from public.sessions s
  join public.cases c on c.id = s.case_id
  where s.is_demo and c.is_demo
  limit 1
), inserted_claims as (
  insert into public.ai_claims (id, session_id, type, text, confidence, support, review, warning)
  select * from (
    values
      ('33333333-3333-3333-3333-333333333331'::uuid, (select id from demo_session), 'key_statement', 'The witness stated they never entered the building.', 'high', 'supported', 'approved', null),
      ('33333333-3333-3333-3333-333333333332'::uuid, (select id from demo_session), 'inconsistency_candidate', 'The witness later stated they entered briefly after earlier denying entry.', 'medium', 'partially_supported', 'pending', null),
      ('33333333-3333-3333-3333-333333333333'::uuid, (select id from demo_session), 'unsupported_inference', 'The witness intentionally misled the court.', 'unsupported', 'unsupported', 'rejected', 'This wording is unsafe and must be excluded from the report.'),
      ('33333333-3333-3333-3333-333333333334'::uuid, (select id from demo_session), 'follow_up', 'Ask the witness to clarify whether they spoke with the caretaker.', 'medium', 'supported', 'needs_more_evidence', null)
  ) as v(id, session_id, type, text, confidence, support, review, warning)
  where v.session_id is not null
  on conflict (id) do nothing
  returning id
)
insert into public.claim_anchors (claim_id, segment_id, status)
select v.claim_id, ts.id, v.status
from (
  values
    ('33333333-3333-3333-3333-333333333331'::uuid, 'I never entered the building.', 'verified'),
    ('33333333-3333-3333-3333-333333333332'::uuid, 'I never entered the building.', 'verified'),
    ('33333333-3333-3333-3333-333333333332'::uuid, 'I entered briefly to speak with the caretaker.', 'suggested'),
    ('33333333-3333-3333-3333-333333333334'::uuid, 'No, I did not speak to anyone there.', 'verified'),
    ('33333333-3333-3333-3333-333333333334'::uuid, 'I entered briefly to speak with the caretaker.', 'suggested')
) as v(claim_id, segment_text, status)
join public.transcript_segments ts on ts.text = v.segment_text
where not exists (
  select 1 from public.claim_anchors ca
  where ca.claim_id = v.claim_id and ca.segment_id = ts.id
);
