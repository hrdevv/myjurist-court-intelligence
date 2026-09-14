-- ============ AI claims & anchors (Phase 4) ============
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  type text not null default 'key_statement',
  text text not null,
  confidence text not null default 'medium',
  support text not null default 'unsupported',
  review_status text not null default 'pending',
  reviewer_note text,
  warning text,
  source_model text,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claims_type_check check (type in ('key_statement','inconsistency_candidate','unsupported_inference','follow_up')),
  constraint claims_confidence_check check (confidence in ('high','medium','low','unsupported')),
  constraint claims_support_check check (support in ('supported','partially_supported','unsupported')),
  constraint claims_review_check check (review_status in ('pending','approved','rejected','uncertain','needs_more_evidence'))
);

grant select, insert, update, delete on public.claims to authenticated;
grant all on public.claims to service_role;

alter table public.claims enable row level security;

create policy "claims selectable by session members"
on public.claims for select to authenticated
using (public.can_access_session(session_id));

create policy "claims insertable by session members"
on public.claims for insert to authenticated
with check (public.can_access_session(session_id) and created_by = auth.uid());

create policy "claims updatable by session members"
on public.claims for update to authenticated
using (public.can_access_session(session_id))
with check (public.can_access_session(session_id));

create policy "claims deletable by session members"
on public.claims for delete to authenticated
using (public.can_access_session(session_id));

create trigger update_claims_updated_at
before update on public.claims
for each row execute function public.update_updated_at_column();

create index idx_claims_session on public.claims(session_id);
create index idx_claims_review on public.claims(review_status);

-- ============ claim anchors ============
create table public.claim_anchors (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  segment_id uuid references public.transcript_segments(id) on delete set null,
  status text not null default 'failed',
  quote text,
  match_score numeric,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint claim_anchors_status_check check (status in ('verified','suggested','failed','none','manual'))
);

grant select, insert, update, delete on public.claim_anchors to authenticated;
grant all on public.claim_anchors to service_role;

alter table public.claim_anchors enable row level security;

create policy "claim anchors selectable by session members"
on public.claim_anchors for select to authenticated
using (exists (select 1 from public.claims c where c.id = claim_id and public.can_access_session(c.session_id)));

create policy "claim anchors insertable by session members"
on public.claim_anchors for insert to authenticated
with check (exists (select 1 from public.claims c where c.id = claim_id and public.can_access_session(c.session_id)));

create policy "claim anchors updatable by session members"
on public.claim_anchors for update to authenticated
using (exists (select 1 from public.claims c where c.id = claim_id and public.can_access_session(c.session_id)))
with check (exists (select 1 from public.claims c where c.id = claim_id and public.can_access_session(c.session_id)));

create policy "claim anchors deletable by session members"
on public.claim_anchors for delete to authenticated
using (exists (select 1 from public.claims c where c.id = claim_id and public.can_access_session(c.session_id)));

create index idx_claim_anchors_claim on public.claim_anchors(claim_id);
create index idx_claim_anchors_segment on public.claim_anchors(segment_id);