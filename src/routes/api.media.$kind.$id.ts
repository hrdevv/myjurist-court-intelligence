import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function unavailable(status: number) {
  return new Response(null, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

export const Route = createFileRoute("/api/media/$kind/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const kind = params.kind;
        if (kind !== "recording" && kind !== "evidence") return unavailable(404);
        if (!UUID.test(params.id)) return unavailable(404);

        const authorization = request.headers.get("authorization");
        if (!authorization?.startsWith("Bearer ")) return unavailable(401);
        const token = authorization.slice("Bearer ".length).trim();
        if (!token) return unavailable(401);

        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return unavailable(503);

        const supabase = createClient<Database>(url, key, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: authError } = await supabase.auth.getClaims(token);
        if (authError || !claims?.claims?.sub) return unavailable(401);

        const table = kind === "recording" ? "recordings" : "evidence";
        const { data: file, error: fileError } = await supabase
          .from(table)
          .select("storage_path, session_id")
          .eq("id", params.id)
          .maybeSingle();
        if (fileError || !file?.storage_path) return unavailable(404);
        if (!file.storage_path.startsWith(`${file.session_id}/`)) return unavailable(404);

        const bucket = kind === "recording" ? "recordings" : "evidence";
        const objectPath = file.storage_path.split("/").map(encodeURIComponent).join("/");
        const storageUrl = `${url.replace(/\/$/, "")}/storage/v1/object/authenticated/${bucket}/${objectPath}`;
        const storageHeaders = new Headers({ apikey: key, Authorization: `Bearer ${token}` });
        for (const name of ["range", "if-range"]) {
          const value = request.headers.get(name);
          if (value) storageHeaders.set(name, value);
        }

        const stored = await fetch(storageUrl, { headers: storageHeaders });
        if (!stored.ok && stored.status !== 206) {
          return unavailable(stored.status === 401 || stored.status === 403 ? 404 : 502);
        }

        const headers = new Headers(PRIVATE_RESPONSE_HEADERS);
        for (const name of [
          "accept-ranges",
          "content-length",
          "content-range",
          "content-type",
          "etag",
          "last-modified",
        ]) {
          const value = stored.headers.get(name);
          if (value) headers.set(name, value);
        }
        headers.set("Content-Disposition", kind === "recording" ? "inline" : "attachment");

        return new Response(stored.body, { status: stored.status, headers });
      },
    },
  },
});