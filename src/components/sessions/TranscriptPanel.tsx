import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listTranscript,
  saveTranscript,
  updateSegment,
  type TranscriptSegmentRow,
} from "@/lib/transcript.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfidenceBadge } from "@/components/legal/Badges";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { History, Pencil, ClipboardPaste, Check, X, Loader2 } from "lucide-react";

type Confidence = "high" | "medium" | "low";

function badgeLevel(c: string): Confidence {
  return c === "high" || c === "low" ? c : "medium";
}

export function TranscriptPanel({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();
  const list = useServerFn(listTranscript);
  const save = useServerFn(saveTranscript);
  const update = useServerFn(updateSegment);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSpeaker, setEditSpeaker] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const { data: segments = [], isLoading } = useQuery({
    queryKey: ["transcript", sessionId],
    queryFn: () => list({ data: { sessionId } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["transcript", sessionId] });

  const saveMutation = useMutation({
    mutationFn: (text: string) => save({ data: { sessionId, text } }),
    onSuccess: () => {
      toast.success("Transcript saved");
      setPasteOpen(false);
      setPasteText("");
      invalidate();
    },
    onError: () => toast.error("Could not save transcript."),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { segmentId: string; text: string; speaker: string }) =>
      update({ data: vars }),
    onSuccess: () => {
      toast.success("Segment updated");
      setEditingId(null);
      invalidate();
    },
    onError: () => toast.error("Could not update segment."),
  });

  function startEdit(seg: TranscriptSegmentRow) {
    setEditingId(seg.id);
    setEditText(seg.text);
    setEditSpeaker(seg.speaker);
  }

  return (
    <Card className="lg:col-span-2 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl">Transcript</h2>
        <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <ClipboardPaste className="size-4" /> Paste transcript
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Paste transcript</DialogTitle>
              <DialogDescription>
                One line per segment. Optionally prefix with <code>[hh:mm:ss]</code> and{" "}
                <code>Speaker:</code>. This replaces the current transcript.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={10}
              placeholder={"[01:42:11] Witness: I never entered the building.\n[01:58:03] Counsel: Did you speak to the caretaker that day?"}
            />
            <DialogFooter>
              <Button
                onClick={() => saveMutation.mutate(pasteText)}
                disabled={saveMutation.isPending || !pasteText.trim()}
              >
                {saveMutation.isPending ? "Saving…" : "Save transcript"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading transcript…</p>
      ) : segments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No transcript yet. Paste a transcript above, or generate one from a recording in a later
          step.
        </p>
      ) : (
        <ol className="space-y-4">
          {segments.map((seg) => (
            <li
              key={seg.id}
              className="grid grid-cols-[80px_1fr_auto] gap-4 items-start text-sm border-l-2 border-border pl-4 hover:border-primary/50"
            >
              <span className="font-mono text-xs text-muted-foreground pt-1">
                {seg.timestamp_label ?? "—"}
              </span>
              {editingId === seg.id ? (
                <div className="space-y-2">
                  <Input
                    value={editSpeaker}
                    onChange={(e) => setEditSpeaker(e.target.value)}
                    className="h-8 text-xs"
                    aria-label="Speaker"
                  />
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    aria-label="Segment text"
                  />
                </div>
              ) : (
                <div>
                  <div className="font-medium text-foreground">{seg.speaker}</div>
                  <p className="text-foreground/90 mt-0.5">{seg.text}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <ConfidenceBadge level={badgeLevel(seg.confidence)} />
                    <span className="inline-flex items-center gap-1">
                      <History className="size-3" /> v{seg.version}
                    </span>
                  </div>
                </div>
              )}

              {editingId === seg.id ? (
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Save segment"
                    disabled={updateMutation.isPending || !editText.trim()}
                    onClick={() =>
                      updateMutation.mutate({
                        segmentId: seg.id,
                        text: editText.trim(),
                        speaker: editSpeaker.trim() || "Speaker",
                      })
                    }
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Cancel edit"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit transcript segment from ${seg.speaker}`}
                  onClick={() => startEdit(seg)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
