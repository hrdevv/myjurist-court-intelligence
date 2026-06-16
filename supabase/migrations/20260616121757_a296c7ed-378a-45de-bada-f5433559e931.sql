-- Trigger functions should never be directly callable through the Data API.
-- Triggers execute with the table owner's privileges regardless of caller grants,
-- so revoking EXECUTE here is safe and closes the SECURITY DEFINER exposure.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies that apply to authenticated users, so it
-- must stay executable for that role only. Remove the broader/anon access.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;