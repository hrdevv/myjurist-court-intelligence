CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_case_member(_case_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (
    select 1 from public.case_members
    where case_id = _case_id and user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_session(_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (
    select 1
    from public.sessions s
    join public.cases c on c.id = s.case_id
    where s.id = _session_id
      and (c.is_demo or c.created_by = auth.uid() or private.is_case_member(c.id))
  )
$$;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_case_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_session(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_review_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  select private.has_role(_user_id, 'lawyer')
      or private.has_role(_user_id, 'paralegal')
      or private.has_role(_user_id, 'reviewer')
$$;

DO $do$
DECLARE
  r RECORD;
  v_qual text;
  v_check text;
  v_roles text;
BEGIN
  FOR r IN
    SELECT p.schemaname, p.tablename, p.policyname, p.permissive, p.roles AS proles, p.cmd, p.qual, p.with_check
    FROM pg_policies p
    WHERE coalesce(p.qual,'') ~ '(can_access_session|is_case_member)\s*\('
       OR coalesce(p.with_check,'') ~ '(can_access_session|is_case_member)\s*\('
  LOOP
    v_qual := r.qual;
    v_check := r.with_check;
    IF v_qual IS NOT NULL THEN
      v_qual := replace(v_qual, 'public.can_access_session(', 'private.can_access_session(');
      v_qual := replace(v_qual, 'public.is_case_member(', 'private.is_case_member(');
      v_qual := regexp_replace(v_qual, '(^|[^a-zA-Z0-9_.])can_access_session\(', '\1private.can_access_session(', 'g');
      v_qual := regexp_replace(v_qual, '(^|[^a-zA-Z0-9_.])is_case_member\(', '\1private.is_case_member(', 'g');
    END IF;
    IF v_check IS NOT NULL THEN
      v_check := replace(v_check, 'public.can_access_session(', 'private.can_access_session(');
      v_check := replace(v_check, 'public.is_case_member(', 'private.is_case_member(');
      v_check := regexp_replace(v_check, '(^|[^a-zA-Z0-9_.])can_access_session\(', '\1private.can_access_session(', 'g');
      v_check := regexp_replace(v_check, '(^|[^a-zA-Z0-9_.])is_case_member\(', '\1private.is_case_member(', 'g');
    END IF;
    SELECT string_agg(quote_ident(x), ', ') INTO v_roles FROM unnest(r.proles) AS x;
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s %s %s',
      r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd, v_roles,
      CASE WHEN v_qual IS NOT NULL THEN 'USING (' || v_qual || ')' ELSE '' END,
      CASE WHEN v_check IS NOT NULL THEN 'WITH CHECK (' || v_check || ')' ELSE '' END
    );
  END LOOP;
END $do$;

DROP FUNCTION public.can_access_session(uuid);
DROP FUNCTION public.is_case_member(uuid);
DROP FUNCTION public.has_role(uuid, public.app_role);