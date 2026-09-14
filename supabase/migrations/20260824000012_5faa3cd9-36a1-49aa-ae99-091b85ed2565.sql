create or replace function public.has_review_role(_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.has_role(_user_id, 'lawyer')
      or public.has_role(_user_id, 'paralegal')
      or public.has_role(_user_id, 'reviewer')
$$;

revoke execute on function public.has_review_role(uuid) from public, anon;
grant execute on function public.has_review_role(uuid) to authenticated, service_role;