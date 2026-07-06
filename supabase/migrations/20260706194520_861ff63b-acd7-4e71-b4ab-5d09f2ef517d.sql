-- Lock down the RLS helper: not callable by anonymous visitors.
revoke execute on function public.is_case_member(uuid) from public, anon;
grant execute on function public.is_case_member(uuid) to authenticated;