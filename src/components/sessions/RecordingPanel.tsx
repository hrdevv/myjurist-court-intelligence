import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listRecordings,
  recordRecording,
  getRecordingSignedUrl,
  deleteRecording,
  RECORDINGS_BUCKET,
  type RecordingRow,
} from "@/lib/recordings.functions";
import { AudioRecorder, sha256Blob } from "@/lib/audio-recorder";
import { transcribeRecording } from "@/lib/transcript.functions";
import { AudioPlayer } from "@/components/sessions/AudioPlayer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Square, Trash2, Loader2, ShieldAlert, AudioLines, FileText } from "lucide-react";

function formatBytes(bytes: number | null): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RecordingItem({
  recording,
  onDelete,
  deleting,
  onTranscribe,
  transcribing,
}: {
  recording: RecordingRow;
  onDelete: (id: string) => void;
  deleting: boolean;
  onTranscribe: (id: string) => void;
  transcribing: boolean;
}) {
  const getUrl = useServerFn(getRecordingSignedUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadPlayer() {
    if (url) return;
    setLoading(true);
    try {
      const res = await getUrl({ data: { recordingId: recording.id } });
      setUrl(res.url);
    } catch {
      toast.error("Could not load this recording.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AudioLines className="size-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">
            {new Date(recording.created_at).toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono truncate">
            {recording.checksum ?? "—"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {formatDuration(recording.duration_seconds)}
            {recording.size_bytes != null ? ` · ${formatBytes(recording.size_bytes)}` : ""}
            {recording.status ? ` · ${recording.status}` : ""}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Delete recording"
          disabled={deleting}
          onClick={() => onDelete(recording.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {url ? (
        <AudioPlayer src={url} />
      ) : (
        <Button variant="outline" size="sm" className="w-full" disabled={loading} onClick={loadPlayer}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <AudioLines className="size-3.5" />}
          {loading ? "Loading…" : "Load player"}
        </Button>
      )}

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={transcribing || recording.status === "transcribing"}
        onClick={() => onTranscribe(recording.id)}
      >
        {transcribing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileText className="size-3.5" />
        )}
        {transcribing ? "Transcribing…" : "Transcribe with AI"}
      </Button>
    </li>
  );
}

export function RecordingPanel({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();
  const list = useServerFn(listRecordings);
  const record = useServerFn(recordRecording);
  const remove = useServerFn(deleteRecording);
  const transcribe = useServerFn(transcribeRecording);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ["recordings", sessionId],
    queryFn: () => list({ data: { sessionId } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["recordings", sessionId] });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.cancel();
    };
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (recordingId: string) => remove({ data: { recordingId } }),
    onSuccess: () => {
      toast.success("Recording removed");
      invalidate();
    },
    onError: () => toast.error("Could not remove recording."),
  });

  async function startRecording() {
    try {
      const rec = new AudioRecorder();
      await rec.start();
      recorderRef.current = rec;
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      console.error(err);
      toast.error("Microphone access was denied or unavailable.");
    }
  }

  async function stopRecording() {
    const rec = recorderRef.current;
    if (!rec) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setSaving(true);
    try {
      const { blob, durationSeconds } = await rec.stop();
      if (blob.size <= 44 || durationSeconds < 0.5) {
        toast.error("Recording was empty. Please try again.");
        return;
      }
      const checksum = await sha256Blob(blob);
      const path = `${sessionId}/${crypto.randomUUID()}.wav`;

      const { error: upErr } = await supabase.storage
        .from(RECORDINGS_BUCKET)
        .upload(path, blob, { contentType: "audio/wav", upsert: false });
      if (upErr) throw upErr;

      await record({
        data: {
          sessionId,
          storagePath: path,
          durationSeconds,
          mime: "audio/wav",
          sizeBytes: blob.size,
          checksum,
        },
      });
      toast.success("Recording saved");
      invalidate();
    } catch (err) {
      console.error(err);
      toast.error("Could not save the recording.");
    } finally {
      recorderRef.current = null;
      setSaving(false);
      setElapsed(0);
    }
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">Recordings</h3>
        {recording ? (
          <span className="text-xs font-mono text-destructive flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive animate-pulse" />
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
        ) : null}
      </div>

      <div className="border-2 border-dashed border-border rounded-md p-4 mb-4 space-y-3">
        {recording ? (
          <Button variant="destructive" size="sm" className="w-full" onClick={stopRecording}>
            <Square className="size-4" /> Stop &amp; save
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={saving}
            onClick={startRecording}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
            {saving ? "Saving…" : "Record audio"}
          </Button>
        )}
        <div className="text-[11px] text-muted-foreground italic flex items-start gap-1.5">
          <ShieldAlert className="size-3 mt-0.5 shrink-0 text-warning-foreground" />
          Recording captures your microphone. Ensure all parties consent before recording.
          Audio is stored privately with a SHA-256 checksum for integrity.
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading recordings…</p>
      ) : recordings.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No recordings yet.</p>
      ) : (
        <ul className="space-y-2">
          {recordings.map((r) => (
            <RecordingItem
              key={r.id}
              recording={r}
              deleting={deleteMutation.isPending}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
