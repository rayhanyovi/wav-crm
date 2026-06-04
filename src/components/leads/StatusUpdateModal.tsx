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
import type { Lead, LeadStatus, ActivityType, ActivityResult } from "@/data/types";

// ─── Config maps ─────────────────────────────────────────────────────────────

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "CALL",      label: "Phone Call" },
  { value: "EMAIL",     label: "Email" },
  { value: "MEETING",   label: "Meeting" },
  { value: "NOTE",      label: "Note / Manual entry" },
  { value: "FOLLOW_UP", label: "Follow-up" },
];

const RESULT_LABELS: Record<ActivityResult, string> = {
  COMPLETED:        "Completed",
  NO_ANSWER:        "No Answer",
  FOLLOW_UP_NEEDED: "Follow-up Needed",
  MEETING_SCHEDULED:"Meeting Scheduled",
  CANCELLED:        "Cancelled",
  FAILED:           "Failed / Unreachable",
};

/** Suggested defaults per target status */
const SUGGESTED_RESULT: Record<LeadStatus, ActivityResult> = {
  NA:             "NO_ANSWER",
  KIV:            "FOLLOW_UP_NEEDED",
  NOT_INTERESTED: "COMPLETED",
  AVOID:          "FAILED",
  OTHERS:         "COMPLETED",
  APPOINTMENT:    "MEETING_SCHEDULED",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NA:             "NA",
  KIV:            "KIV",
  NOT_INTERESTED: "Not Interested",
  AVOID:          "Avoid",
  OTHERS:         "Others",
  APPOINTMENT:    "Appointment",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface StatusUpdateModalProps {
  lead: Lead;
  newStatus: LeadStatus;
  open: boolean;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StatusUpdateModal({
  lead,
  newStatus,
  open,
  onClose,
}: StatusUpdateModalProps) {
  const { currentUser } = useAuthStore();
  const updateLead     = useUpdateLead();
  const createActivity = useCreateActivity();

  const [activityType, setActivityType] = useState<ActivityType>("CALL");
  const [subject, setSubject] = useState(
    `Status changed to ${STATUS_LABELS[newStatus]}`,
  );
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ActivityResult>(
    SUGGESTED_RESULT[newStatus] ?? "COMPLETED",
  );
  const [followUpDate, setFollowUpDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isKiv    = newStatus === "KIV";
  const isAvoid  = newStatus === "AVOID";

  // Reset form when the modal opens for a new status
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      return;
    }
    setActivityType("CALL");
    setSubject(`Status changed to ${STATUS_LABELS[newStatus]}`);
    setNotes("");
    setResult(SUGGESTED_RESULT[newStatus] ?? "COMPLETED");
    setFollowUpDate("");
  };

  const handleSubmit = async () => {
    if (!currentUser || !subject.trim()) return;
    setSubmitting(true);

    try {
      // 1. Update lead status
      await updateLead.mutateAsync({
        id:      lead.id,
        payload: { status: newStatus },
        userId:  currentUser.id,
      });

      // 2. Create an activity log so there's a paper trail
      const now = new Date().toISOString();
      await createActivity.mutateAsync({
        type:         activityType,
        subject:      subject.trim(),
        description:  notes.trim() || undefined,
        result,
        lead_id:      lead.id,
        created_by:   currentUser.id,
        completed_at: now,
        scheduled_at: isKiv && followUpDate ? followUpDate : undefined,
        metadata: {
          previous_status: lead.status,
          new_status:      newStatus,
        },
      });

      onClose();
    } catch {
      // errors surface via TanStack Query toasts; don't block UI
    } finally {
      setSubmitting(false);
    }
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

          {/* Contact method */}
          <div className="space-y-1.5">
            <Label className="text-xs">How did you reach out?</Label>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActivityType(value)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    activityType === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="su-subject" className="text-xs">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="su-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of the interaction"
            />
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
                  ? "Reason for avoiding this lead…"
                  : isKiv
                  ? "What did they say? Any context for the follow-up…"
                  : "What happened during the interaction…"
              }
              rows={3}
            />
          </div>

          {/* Result */}
          <div className="space-y-1.5">
            <Label className="text-xs">Outcome</Label>
            <Select
              value={result}
              onValueChange={(v) => setResult(v as ActivityResult)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RESULT_LABELS) as ActivityResult[]).map((r) => (
                  <SelectItem key={r} value={r} className="text-xs">
                    {RESULT_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!subject.trim() || submitting}
            variant={isAvoid ? "destructive" : "default"}
          >
            {submitting
              ? "Saving…"
              : isAvoid
              ? "Mark as Avoid"
              : "Save & Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
