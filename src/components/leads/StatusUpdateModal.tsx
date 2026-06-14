import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadStatusBadge } from "@/components/common/StatusBadge";
import { useUpdateLead } from "@/hooks/useLeads";
import { useCreateActivity } from "@/hooks/useActivities";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/store/useToastStore";
import { STATUS_REASONS, AUTO_RESULT, STATUS_LABELS } from "@/lib/leadStatusReasons";
import type { Lead, LeadStatus } from "@/data/types";

// ─── Props ───────────────────────────────────────────────────────────────────

interface StatusUpdateModalProps {
  lead: Lead;
  newStatus: LeadStatus;
  open: boolean;
  onClose: () => void;
  /** Fires after the status update + activity have been saved successfully. */
  onUpdated?: (leadId: string, newStatus: LeadStatus) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StatusUpdateModal({
  lead,
  newStatus,
  open,
  onClose,
  onUpdated,
}: StatusUpdateModalProps) {
  const { currentUser } = useAuthStore();
  const updateLead     = useUpdateLead();
  const createActivity = useCreateActivity();

  const [notes, setNotes]               = useState("");
  const [reason, setReason]             = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const isKiv   = newStatus === "KIV";
  const isAvoid = newStatus === "AVOID";

  const reasonOptions = STATUS_REASONS[newStatus] ?? [];

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      return;
    }
    setNotes("");
    setReason("");
    setFollowUpDate("");
  };

  // Fire-and-close: the status flips instantly in the table via the optimistic
  // cache update in useUpdateLead. On failure the hook rolls the row back and we
  // surface a toast. Activity logging is best-effort and never blocks the UX.
  const handleSubmit = () => {
    if (!currentUser || !reason) return;

    const userId = currentUser.id;
    const trimmedNotes = notes.trim() || undefined;

    updateLead.mutate(
      { id: lead.id, payload: { status: newStatus }, userId },
      {
        onError: (err) =>
          toast.error(
            `Couldn't update status: ${err instanceof Error ? err.message : "unknown error"}`,
          ),
        onSuccess: () => {
          const now = new Date().toISOString();
          createActivity.mutate({
            type:         "CALL",
            subject:      `Status changed to ${STATUS_LABELS[newStatus]} — ${reason}`,
            description:  trimmedNotes,
            result:       AUTO_RESULT[newStatus],
            lead_id:      lead.id,
            created_by:   userId,
            completed_at: now,
            metadata: {
              previous_status: lead.status,
              new_status:      newStatus,
              reason,
            },
          });

          if (isKiv && followUpDate) {
            createActivity.mutate({
              type:           "FOLLOW_UP",
              subject:        `Follow-up — ${lead.first_name} ${lead.last_name}`,
              description:    trimmedNotes,
              scheduled_at:   new Date(followUpDate).toISOString(),
              lead_id:        lead.id,
              assigned_to_id: userId,
              created_by:     userId,
            });
          }
        },
      },
    );

    onUpdated?.(lead.id, newStatus);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="text-muted-foreground">
              {lead.first_name} {lead.last_name}
            </span>
            <span className="text-muted-foreground">→</span>
            <LeadStatusBadge status={newStatus} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* AVOID warning */}
          {isAvoid && (
            <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                This will permanently mark the lead as <strong>abandoned</strong>.
                The lead will be hidden from your active queue.
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className={`text-xs ${!reason ? "text-muted-foreground" : ""}`}>
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {reasonOptions.map((r) => (
                  <SelectItem key={r} value={r} className="text-xs">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="su-notes" className="text-xs">
              Notes
            </Label>
            <Textarea
              id="su-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isAvoid
                  ? "Any additional context…"
                  : isKiv
                  ? "What did they say? Context for the follow-up…"
                  : "What happened during the call…"
              }
              rows={3}
            />
          </div>

          {/* KIV: follow-up date */}
          {isKiv && (
            <div className="space-y-1.5">
              <Label htmlFor="su-followup" className="text-xs">
                Follow-up date
              </Label>
              <Input
                id="su-followup"
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              <p className="text-[11px] text-muted-foreground">
                This will schedule a follow-up activity on your calendar.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason}
            variant={isAvoid ? "destructive" : "default"}
          >
            {isAvoid ? "Mark as Avoid" : "Save & Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
