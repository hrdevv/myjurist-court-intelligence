import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createCase } from "@/lib/cases.functions";
import { Plus } from "lucide-react";

export function CreateCaseDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [court, setCourt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const create = useServerFn(createCase);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !reference.trim()) return;
    setSubmitting(true);
    try {
      const row = await create({
        data: { title: title.trim(), reference: reference.trim(), court: court.trim() || undefined },
      });
      toast.success("Case created");
      setOpen(false);
      setTitle("");
      setReference("");
      setCourt("");
      navigate({ to: "/cases/$caseId", params: { caseId: row.id } });
    } catch (err) {
      toast.error("Could not create case. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" /> Create case
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create case</DialogTitle>
            <DialogDescription>
              Cases are private to you and the members you add.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="case-title">Case title</Label>
              <Input
                id="case-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Land Dispute Hearing"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-reference">Reference</Label>
              <Input
                id="case-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. LDH-2026-002"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-court">Court (optional)</Label>
              <Input
                id="case-court"
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                placeholder="e.g. Federal High Court"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
