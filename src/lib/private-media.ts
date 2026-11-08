import { supabase } from "@/integrations/supabase/client";

export type PrivateMediaKind = "recording" | "evidence";

/** Fetches a private file through the authenticated, membership-checked route. */
export async function fetchPrivateMedia(
  kind: PrivateMediaKind,
  id: string,
): Promise<Blob> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Sign in again to access this file.");

  const response = await fetch(`/api/media/${kind}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error("You no longer have access to this file.");
    }
    throw new Error("Could not load this file. Please try again.");
  }
  return response.blob();
}