-- ============ recordings ============
create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  storage_path text,
  duration_seconds numeric,
  mime text,
  size_bytes bigint,
  checksum text,
  status text not null default 'uploaded',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.recordings to authenticated;
grant all on public.recordings to service_role;

alter table public.recordings enable row level security;

create policy "recordings selectable by session members"
on public.recordings for select to authenticated
using (public.can_access_session(session_id));

create policy "recordings insertable by session members"
on public.recordings for insert to authenticated
with check (public.can_access_session(session_id) and created_by = auth.uid());

create policy "recordings updatable by session members"
on public.recordings for update to authenticated
using (public.can_access_session(session_id))
with check (public.can_access_session(session_id));

create policy "recordings deletable by session members"
on public.recordings for delete to authenticated
using (public.can_access_session(session_id));

create trigger update_recordings_updated_at
before update on public.recordings
for each row execute function public.update_updated_at_column();

create index idx_recordings_session on public.recordings(session_id);

-- ============ storage policies for the private recordings bucket ============
create policy "recordings objects readable by session members"
on storage.objects for select to authenticated
using (bucket_id = 'recordings' and public.can_access_session(((storage.foldername(name))[1])::uuid));

create policy "recordings objects insertable by session members"
on storage.objects for insert to authenticated
with check (bucket_id = 'recordings' and public.can_access_session(((storage.foldername(name))[1])::uuid));

create policy "recordings objects deletable by session members"
on storage.objects for delete to authenticated
using (bucket_id = 'recordings' and public.can_access_session(((storage.foldername(name))[1])::uuid));