-- Helper: can the current user access a given session (via its parent case)?
create or replace function public.can_access_session(_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions s
    join public.cases c on c.id = s.case_id
    where s.id = _session_id
      and (c.is_demo or c.created_by = auth.uid() or public.is_case_member(c.id))
  )
$$;

revoke execute on function public.can_access_session(uuid) from public, anon;
grant execute on function public.can_access_session(uuid) to authenticated;

-- ============ evidence ============
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  name text not null,
  type text not null default 'document',
  storage_path text,
  size_bytes bigint,
  checksum text,
  description text,
  status text not null default 'uploaded',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.evidence to authenticated;
grant all on public.evidence to service_role;

alter table public.evidence enable row level security;

create policy "evidence selectable by session members"
on public.evidence for select to authenticated
using (public.can_access_session(session_id));

create policy "evidence insertable by session members"
on public.evidence for insert to authenticated
with check (public.can_access_session(session_id) and created_by = auth.uid());

create policy "evidence updatable by session members"
on public.evidence for update to authenticated
using (public.can_access_session(session_id))
with check (public.can_access_session(session_id));

create policy "evidence deletable by session members"
on public.evidence for delete to authenticated
using (public.can_access_session(session_id));

create trigger update_evidence_updated_at
before update on public.evidence
for each row execute function public.update_updated_at_column();

-- ============ transcript_segments ============
create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  start_ms integer,
  end_ms integer,
  timestamp_label text,
  speaker text not null default 'Speaker',
  text text not null default '',
  confidence text not null default 'high',
  version integer not null default 1,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.transcript_segments to authenticated;
grant all on public.transcript_segments to service_role;

alter table public.transcript_segments enable row level security;

create policy "segments selectable by session members"
on public.transcript_segments for select to authenticated
using (public.can_access_session(session_id));

create policy "segments insertable by session members"
on public.transcript_segments for insert to authenticated
with check (public.can_access_session(session_id));

create policy "segments updatable by session members"
on public.transcript_segments for update to authenticated
using (public.can_access_session(session_id))
with check (public.can_access_session(session_id));

create policy "segments deletable by session members"
on public.transcript_segments for delete to authenticated
using (public.can_access_session(session_id));

create trigger update_transcript_segments_updated_at
before update on public.transcript_segments
for each row execute function public.update_updated_at_column();

-- ============ transcript_versions ============
create table public.transcript_versions (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.transcript_segments(id) on delete cascade,
  version integer not null,
  text text not null,
  edited_by uuid,
  created_at timestamptz not null default now()
);

grant select, insert on public.transcript_versions to authenticated;
grant all on public.transcript_versions to service_role;

alter table public.transcript_versions enable row level security;

create policy "versions selectable by segment session members"
on public.transcript_versions for select to authenticated
using (exists (
  select 1 from public.transcript_segments ts
  where ts.id = segment_id and public.can_access_session(ts.session_id)
));

create policy "versions insertable by segment session members"
on public.transcript_versions for insert to authenticated
with check (exists (
  select 1 from public.transcript_segments ts
  where ts.id = segment_id and public.can_access_session(ts.session_id)
));

-- indexes
create index idx_evidence_session on public.evidence(session_id);
create index idx_segments_session on public.transcript_segments(session_id);
create index idx_versions_segment on public.transcript_versions(segment_id);

-- ============ storage policies for the private evidence bucket ============
create policy "evidence objects readable by session members"
on storage.objects for select to authenticated
using (bucket_id = 'evidence' and public.can_access_session(((storage.foldername(name))[1])::uuid));

create policy "evidence objects insertable by session members"
on storage.objects for insert to authenticated
with check (bucket_id = 'evidence' and public.can_access_session(((storage.foldername(name))[1])::uuid));

create policy "evidence objects deletable by session members"
on storage.objects for delete to authenticated
using (bucket_id = 'evidence' and public.can_access_session(((storage.foldername(name))[1])::uuid));

-- ============ seed demo transcript + evidence ============
insert into public.transcript_segments (session_id, start_ms, end_ms, timestamp_label, speaker, text, confidence, version)
select s.id, v.start_ms, v.end_ms, v.label, v.speaker, v.seg_text, v.confidence, v.version
from public.sessions s
join public.cases c on c.id = s.case_id and c.is_demo
cross join (values
  (6131000, 6134000, '01:42:11', 'Witness', 'I never entered the building.', 'high', 2),
  (7083000, 7086000, '01:58:03', 'Counsel', 'Did you speak to the caretaker that day?', 'high', 1),
  (7089000, 7092000, '01:58:09', 'Witness', 'No, I did not speak to anyone there.', 'high', 1),
  (7518000, 7522000, '02:05:18', 'Witness', 'I entered briefly to speak with the caretaker.', 'medium', 1),
  (8144000, 8147000, '02:15:44', 'Judge', 'The answer will remain on record.', 'high', 1)
) as v(start_ms, end_ms, label, speaker, seg_text, confidence, version)
where s.is_demo
  and not exists (select 1 from public.transcript_segments ts where ts.session_id = s.id);

insert into public.transcript_versions (segment_id, version, text)
select ts.id, ts.version, ts.text
from public.transcript_segments ts
join public.sessions s on s.id = ts.session_id
where s.is_demo
  and not exists (select 1 from public.transcript_versions tv where tv.segment_id = ts.id);

insert into public.evidence (session_id, name, type, size_bytes, checksum, description, status)
select s.id, v.name, v.ev_type, v.size_bytes, v.checksum, v.description, 'demo'
from public.sessions s
join public.cases c on c.id = s.case_id and c.is_demo
cross join (values
  ('hearing-recording-2026-05-22.mp3', 'audio', 50541363::bigint, 'sha256:9f2a…b71c', 'Hearing recording'),
  ('site-photo-front-gate.jpg', 'image', 2202009::bigint, 'sha256:11de…ac08', 'Site photo — front gate'),
  ('caretaker-statement.pdf', 'document', 319488::bigint, 'sha256:7c3b…f9aa', 'Caretaker statement')
) as v(name, ev_type, size_bytes, checksum, description)
where s.is_demo
  and not exists (select 1 from public.evidence e where e.session_id = s.id);