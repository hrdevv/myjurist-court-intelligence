import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listEvidence,
  recordEvidence,
  getEvidenceSignedUrl,
  deleteEvidence,
  EVIDENCE_BUCKET,
  type EvidenceRow,
} from "@/lib/evidence.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Upload, ShieldAlert, Download, Trash2, Loader2 } from "lucide-react";

function fileType(mime: string): "audio" | "image" | "video" | "document" {
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

function formatBytes(bytes: number | null): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export function EvidencePanel({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();
  const list = useServerFn(listEvidence);
  const record = useServerFn(recordEvidence);
  const getUrl = useServerFn(getEvidenceSignedUrl);
  const remove = useServerFn(deleteEvidence);

  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: evidence = [], isLoading } = useQuery({
    queryKey: ["evidence", sessionId],
    queryFn: () => list({ data: { sessionId } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["evidence", sessionId] });

  const deleteMutation = useMutation({
    mutationFn: (evidenceId: string) => remove({ data: { evidenceId } }),
    onSuccess: () => {
      toast.success("Evidence removed");
      invalidate();
    },
    onError: () => toast.error("Could not remove evidence."),
  });

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const checksum = await sha256(file);
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${sessionId}/${crypto.randomUUID()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;

      await record({
        data: {
          sessionId,
          name: file.name,
          type: fileType(file.type),
          storagePath: path,
          sizeBytes: file.size,
          checksum,
          description: description.trim() || undefined,
        },
      });
      toast.success("Evidence uploaded");
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      invalidate();
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(e: EvidenceRow) {
    try {
      const { url } = await getUrl({ data: { evidenceId: e.id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("This item has no downloadable file.");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">Evidence</h3>
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>

      <div className="border-2 border-dashed border-border rounded-md p-4 mb-4">
        <div className="text-xs space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Upload className="size-3.5" /> Add a description, then choose a file to upload.
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider">Description (optional)</Label>
            <Input
              className="mt-1 h-8 text-xs"
              placeholder="e.g. Hearing recording"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="text-[11px] text-muted-foreground italic flex items-start gap-1.5">
            <ShieldAlert className="size-3 mt-0.5 shrink-0 text-warning-foreground" /> Files are stored
            privately; a SHA-256 checksum is recorded for integrity.
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading evidence…</p>
      ) : evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No evidence uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {evidence.map((e) => (
            <li key={e.id} className="text-sm flex items-start gap-2">
              <FileText className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{e.name}</div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  {e.checksum ?? "—"}
                  {e.size_bytes != null ? ` · ${formatBytes(e.size_bytes)}` : ""}
                </div>
                {e.description && (
                  <div className="text-[11px] text-muted-foreground">{e.description}</div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {e.storage_path && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Download ${e.name}`}
                    onClick={() => void handleDownload(e)}
                  >
                    <Download className="size-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${e.name}`}
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(e.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
