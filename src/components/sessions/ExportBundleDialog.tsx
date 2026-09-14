import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { downloadZip } from "client-zip";
import { toast } from "sonner";
import { getSessionExportManifest } from "@/lib/export.functions";
import {
  bundleFileName,
  bundleManifestJson,
  recordingBaseName,
  transcriptToJson,
  transcriptToText,
  wavToMp3,
} from "@/lib/session-export";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Loader2, Package } from "lucide-react";

interface Options {
  transcriptJson: boolean;
  transcriptTxt: boolean;
  audioWav: boolean;
  audioMp3: boolean;
}

export function ExportBundleDialog({ sessionId }: { sessionId: string }) {
  const fetchManifest = useServerFn(getSessionExportManifest);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [options, setOptions] = useState<Options>({
    transcriptJson: true,
    transcriptTxt: true,
    audioWav: true,
    audioMp3: false,
  });

  const anySelected = Object.values(options).some(Boolean);

  function toggle(key: keyof Options) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function runExport() {
    setBusy(true);
    setProgress("Collecting session data…");
    try {
      const manifest = await fetchManifest({ data: { sessionId } });
      const files: { name: string; lastModified: Date; input: BlobPart }[] = [];
      const audioIndex: { recordingId: string; wav?: string; mp3?: string }[] = [];
      const now = new Date();

      if (options.transcriptJson) {
        files.push({ name: "transcript.json", lastModified: now, input: transcriptToJson(manifest) });
      }
      if (options.transcriptTxt) {
        files.push({ name: "transcript.txt", lastModified: now, input: transcriptToText(manifest) });
      }

      const wantAudio = options.audioWav || options.audioMp3;
      const playable = manifest.recordings.filter((r) => r.url);
      let mp3Failures = 0;

      if (wantAudio) {
        for (let i = 0; i < playable.length; i += 1) {
          const rec = playable[i];
          setProgress(`Fetching audio ${i + 1} of ${playable.length}…`);
          const res = await fetch(rec.url as string);
          if (!res.ok) continue;
          const bytes = await res.arrayBuffer();
          const base = recordingBaseName(rec.createdAt, rec.id);
          const entry: { recordingId: string; wav?: string; mp3?: string } = { recordingId: rec.id };

          if (options.audioWav) {
            entry.wav = `${base}.wav`;
            files.push({
              name: entry.wav,
              lastModified: new Date(rec.createdAt),
              input: new Blob([bytes], { type: "audio/wav" }),
            });
          }

          if (options.audioMp3) {
            setProgress(`Encoding MP3 ${i + 1} of ${playable.length}…`);
            try {
              const mp3 = await wavToMp3(bytes);
              entry.mp3 = `${base}.mp3`;
              files.push({
                name: entry.mp3,
                lastModified: new Date(rec.createdAt),
                input: new Blob([mp3], { type: "audio/mpeg" }),
              });
            } catch (err) {
              console.error(err);
              mp3Failures += 1;
            }
          }

          audioIndex.push(entry);
        }
      }

      files.push({
        name: "manifest.json",
        lastModified: now,
        input: bundleManifestJson(manifest, audioIndex),
      });

      setProgress("Building ZIP…");
      const blob = await downloadZip(files).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = bundleFileName(manifest);
      a.click();
      URL.revokeObjectURL(url);

      if (mp3Failures > 0) {
        toast.warning(
          `Bundle downloaded. ${mp3Failures} recording${mp3Failures === 1 ? "" : "s"} could not be converted to MP3 — the WAV originals are included.`,
        );
      } else {
        toast.success("Export bundle downloaded");
      }
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not build the export bundle.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? null : setOpen(next))}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Package className="size-4" /> Export bundle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Export session bundle</DialogTitle>
          <DialogDescription>
            Downloads a ZIP with the transcript and every recording for this session, plus a
            manifest listing durations and SHA-256 checksums.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {(
            [
              ["transcriptJson", "Transcript (JSON)"],
              ["transcriptTxt", "Transcript (plain text)"],
              ["audioWav", "Audio — original WAV"],
              ["audioMp3", "Audio — MP3 copy (slower, smaller)"],
            ] as [keyof Options, string][]
          ).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`export-${key}`}
                checked={options[key]}
                disabled={busy}
                onCheckedChange={() => toggle(key)}
              />
              <Label htmlFor={`export-${key}`} className="text-sm font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>

        {options.audioMp3 ? (
          <p className="text-[11px] text-muted-foreground italic">
            MP3 conversion runs in your browser and can take a while for long hearings. Keep this
            tab open until the download starts.
          </p>
        ) : null}

        {progress ? <p className="text-xs text-muted-foreground font-mono">{progress}</p> : null}

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !anySelected} onClick={runExport}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {busy ? "Preparing…" : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
