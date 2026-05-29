import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { isTelemarketer } from "@/lib/permissions";
import type { ActivityResult, Lead } from "@/data/types";
import { ChevronRight, PhoneOff } from "lucide-react";

// ─── TM results (cold-calling context) ──────────────────────────────────────
type TmResult = "MEETING_SCHEDULED" | "NO_ANSWER" | "FAILED" | "FOLLOW_UP_NEEDED" | "CANCELLED";

const TM_RESULTS: { value: TmResult; label: string; description: string }[] = [
  { value: "MEETING_SCHEDULED", label: "Meeting Scheduled",  description: "Client agreed and set an appointment" },
  { value: "NO_ANSWER",         label: "Not Answered",       description: "No pickup, voicemail, or line busy" },
  { value: "FAILED",            label: "Bad Data",           description: "Wrong number, not the right person, deceased, etc." },
  { value: "FOLLOW_UP_NEEDED",  label: "Follow Up Needed",   description: "Picked up but asked to call back later" },
  { value: "CANCELLED",         label: "Rejected",           description: "Not interested at all from the start" },
];

// ─── Adviser results (post-handoff context) ──────────────────────────────────
const ADVISER_RESULTS: ActivityResult[] = [
  "COMPLETED", "NO_ANSWER", "FOLLOW_UP_NEEDED", "MEETING_SCHEDULED", "CANCELLED", "FAILED",
];
const ADVISER_RESULT_LABELS: Record<ActivityResult, string> = {
  COMPLETED:        "Completed",
  NO_ANSWER:        "No Answer",
  FOLLOW_UP_NEEDED: "Follow Up Needed",
  MEETING_SCHEDULED:"Meeting Scheduled",
  CANCELLED:        "Cancelled",
  FAILED:           "Failed",
};

interface CallOutcomeFormProps {
  lead: Lead | undefined;
}

export function CallOutcomeForm({ lead }: CallOutcomeFormProps) {
  const { currentUser } = useAuthStore();
  const isTM = isTelemarketer(currentUser);

  const [result, setResult] = useState<ActivityResult>(isTM ? "NO_ANSWER" : "COMPLETED");
  const [notes, setNotes]             = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [meetingDate,  setMeetingDate]  = useState("");
  // Adviser-only
  const [prospectValue, setProspectValue] = useState("");

  const { submitOutcome, nextLead, campaign, liveNotes, callDurationSeconds } = useCallSessionStore();
  const { createActivity, updateLead } = useCrmStore();

  // ── Derived flags ──────────────────────────────────────────────────────────
  const showMeetingDate  = result === "MEETING_SCHEDULED";
  const showFollowUpDate = result === "FOLLOW_UP_NEEDED";
  const notesRequired    = isTM
    ? result === "FAILED"                           // Bad Data — must describe
    : result === "FAILED" || result === "CANCELLED";
  const followUpDateRequired = result === "FOLLOW_UP_NEEDED";

  // Adviser-only prospect value
  const showProspectValue = !isTM && (result === "COMPLETED" || result === "MEETING_SCHEDULED");
  const prospectValueNumber = Number(prospectValue);
  const hasValidProspectValue =
    prospectValue.trim() !== "" &&
    Number.isFinite(prospectValueNumber) &&
    prospectValueNumber > 0;

  const finalNotes = (notes || liveNotes).trim();

  const submitDisabled =
    (notesRequired && !finalNotes) ||
    (showProspectValue && !hasValidProspectValue) ||
    (followUpDateRequired && !followUpDate) ||
    (showMeetingDate && !meetingDate);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!lead || !currentUser) return;
    if (submitDisabled) return;

    const pickup = result !== "NO_ANSWER";
    const metadata: Record<string, unknown> = { duration_seconds: callDurationSeconds };
    if (showMeetingDate && meetingDate)
      metadata.meeting_scheduled_at = new Date(meetingDate).toISOString();
    if (showFollowUpDate && followUpDate)
      metadata.follow_up_scheduled_at = new Date(followUpDate).toISOString();
    if (showProspectValue && hasValidProspectValue)
      metadata.prospect_value = prospectValueNumber;

    createActivity(
      {
        type: "CALL",
        subject: `Call — ${lead.first_name} ${lead.last_name}`,
        description: finalNotes || undefined,
        result,
        scheduled_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        metadata,
        lead_id: lead.id,
        ...(campaign ? { campaign_id: campaign.id } : {}),
        assigned_to_id: currentUser.id,
        created_by: currentUser.id,
      },
      currentUser.id
    );

    if (showMeetingDate && meetingDate) {
      createActivity(
        {
          type: "MEETING",
          subject: `Meeting — ${lead.first_name} ${lead.last_name}`,
          description: finalNotes || undefined,
          result: "MEETING_SCHEDULED",
          scheduled_at: new Date(meetingDate).toISOString(),
          lead_id: lead.id,
          ...(campaign ? { campaign_id: campaign.id } : {}),
          assigned_to_id: currentUser.id,
          created_by: currentUser.id,
        },
        currentUser.id
      );
    }

    if (showFollowUpDate && followUpDate) {
      createActivity(
        {
          type: "FOLLOW_UP",
          subject: `Follow-up — ${lead.first_name} ${lead.last_name}`,
          description: finalNotes || undefined,
          scheduled_at: new Date(followUpDate).toISOString(),
          lead_id: lead.id,
          ...(campaign ? { campaign_id: campaign.id } : {}),
          assigned_to_id: currentUser.id,
          created_by: currentUser.id,
        },
        currentUser.id
      );
    }

    // Auto-advance lead to APPOINTMENT when TM schedules a meeting
    if (result === "MEETING_SCHEDULED" && meetingDate) {
      const dateParts = meetingDate.split("T");
      updateLead(lead.id, {
        status: "APPOINTMENT",
        appointment_date: dateParts[0],
        appointment_time: dateParts[1]?.slice(0, 5) || undefined,
      }, currentUser.id);
    }

    submitOutcome(pickup);
    nextLead();
    setResult(isTM ? "NO_ANSWER" : "COMPLETED");
    setNotes("");
    setFollowUpDate("");
    setMeetingDate("");
    setProspectValue("");
  };

  // ── Helpers for label/placeholder ─────────────────────────────────────────
  const tmResultMeta = TM_RESULTS.find((r) => r.value === result);
  const notesPlaceholder = isTM
    ? result === "FAILED"
      ? "Required — describe the issue (e.g. wrong number, minor, language barrier…)"
      : result === "CANCELLED"
      ? "Optional — what objection did they give?"
      : result === "FOLLOW_UP_NEEDED"
      ? "Optional — what did they say? When to call back?"
      : "Optional — any notes from the call"
    : notesRequired
    ? "Required — add context for this outcome."
    : "What happened during the call?";

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <PhoneOff className="h-5 w-5 text-red-500" />
          End Call — Log Outcome
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {lead?.first_name} {lead?.last_name}
        </p>
      </div>

      {/* ── TM result picker ──────────────────────────────────────────────── */}
      {isTM ? (
        <div className="space-y-2">
          <Label>Call Result *</Label>
          <div className="grid grid-cols-1 gap-2">
            {TM_RESULTS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => setResult(value as ActivityResult)}
                className={[
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  result === value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center",
                    result === value ? "border-primary" : "border-muted-foreground/40",
                  ].join(" ")}
                >
                  {result === value && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-medium leading-tight">{label}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Adviser result picker (compact dropdown) ─────────────────────── */
        <div className="space-y-2">
          <Label>Call Result *</Label>
          <Select value={result} onValueChange={(v) => setResult(v as ActivityResult)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADVISER_RESULTS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ADVISER_RESULT_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Meeting date (both roles) */}
      {showMeetingDate && (
        <div className="space-y-2">
          <Label>Meeting Scheduled At *</Label>
          <Input
            type="datetime-local"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="text-sm"
          />
          {!meetingDate && (
            <p className="text-xs text-destructive">Meeting date and time are required.</p>
          )}
          {meetingDate && (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-2.5 text-xs text-green-800 dark:text-green-300 font-medium">
              ✓ Lead will be marked as Appointment Confirmed
            </div>
          )}
        </div>
      )}

      {/* Follow-up date (both roles) */}
      {showFollowUpDate && (
        <div className="space-y-2">
          <Label>Schedule Follow-up *</Label>
          <Input
            type="datetime-local"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="text-sm"
          />
          {followUpDateRequired && !followUpDate && (
            <p className="text-xs text-destructive">Follow-up date is required.</p>
          )}
        </div>
      )}

      {/* Prospect value — adviser only */}
      {showProspectValue && (
        <div className="space-y-2">
          <Label>Prospect Value (SGD) *</Label>
          <Input
            type="number"
            min="0"
            value={prospectValue}
            onChange={(e) => setProspectValue(e.target.value)}
            placeholder="e.g. 50000"
            className="text-sm"
          />
          {!hasValidProspectValue && (
            <p className="text-xs text-destructive">Prospect value is required.</p>
          )}
        </div>
      )}

      {/* Notes (always shown for TM; conditional for adviser) */}
      <div className="space-y-2">
        <Label>Notes{notesRequired ? " *" : ""}</Label>
        <Textarea
          value={notes || liveNotes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={notesPlaceholder}
          rows={3}
          className="text-sm"
        />
        {notesRequired && !finalNotes && (
          <p className="text-xs text-destructive">Notes are required for this outcome.</p>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={submitDisabled} className="w-full gap-2">
        Submit & Next Lead
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
