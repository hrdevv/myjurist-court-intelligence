REVOKE UPDATE (is_demo) ON public.cases FROM authenticated;
REVOKE UPDATE (is_demo) ON public.sessions FROM authenticated;

DROP POLICY IF EXISTS "claims updatable by session members" ON public.claims;
CREATE POLICY "claims updatable by session members"
ON public.claims FOR UPDATE TO authenticated
USING (
  public.can_access_session(session_id)
  AND public.has_review_role(auth.uid())
)
WITH CHECK (
  public.can_access_session(session_id)
  AND public.has_review_role(auth.uid())
);

DROP POLICY IF EXISTS "claims insertable by session members" ON public.claims;
CREATE POLICY "claims insertable by session members"
ON public.claims FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_session(session_id)
  AND created_by = auth.uid()
  AND public.has_review_role(auth.uid())
);