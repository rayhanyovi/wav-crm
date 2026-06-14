import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useCreateActivity } from "@/hooks/useActivities";
import { useCreateContact } from "@/hooks/useContacts";
import { useCreateDeal, useDeals } from "@/hooks/useDeals";
import { useUpdateLead } from "@/hooks/useLeads";
import { useUpdateUser, useUsers } from "@/hooks/useUsers";
import { isColdCaller } from "@/lib/permissions";
import {
  nextCreditBalanceAfterAppointmentClaim,
  resolveAppointmentDealAdviser,
} from "@/lib/dealAssignment";
import { pickFactFind } from "@/lib/factFind";
import { STATUS_REASONS, AUTO_RESULT, STATUS_LABELS, TM_STATUS_OPTIONS, type TmCallStatus } from "@/lib/leadStatusReasons";
import type { ActivityResult, Lead } from "@/data/types";
import { ChevronRight, PhoneOff } from "lucide-react";

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
  // Cold-callers (TMs + advisers with leads access) use the NA/KIV/AVOID/Appointment
  // status flow; advisers without leads access get the post-handoff result picker.
  const isTM = isColdCaller(currentUser);

  // Adviser-only result picker
  const [result, setResult] = useState<ActivityResult>(isTM ? "NO_ANSWER" : "COMPLETED");
  // TM-only status + reason picker
  const [tmStatus, setTmStatus] = useState<TmCallStatus>("NA");
  const [reason, setReason]     = useState("");

  const [notes, setNotes]             = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const followUpDateTime = followUpDate && followUpTime ? `${followUpDate}T${followUpTime}` : "";
  const [meetingDate, setMeetingDate]   = useState("");
  const [meetingTime, setMeetingTime]   = useState("");
  const meetingDateTime = meetingDate && meetingTime ? `${meetingDate}T${meetingTime}` : "";
  // Adviser-only
  const [prospectValue, setProspectValue] = useState("");

  const { submitOutcome, nextLead, liveNotes, callDurationSeconds } = useCallSessionStore();
  const createActivityMutation = useCreateActivity();
  const updateLeadMutation = useUpdateLead();
  const createContactMutation = useCreateContact();
  const createDealMutation = useCreateDeal();
  const updateUserMutation = useUpdateUser();
  const { data: deals = [] } = useDeals();
  const { data: users = [], isLoading: usersLoading } = useUsers();

  // ── Derived flags ──────────────────────────────────────────────────────────
  const effectiveResult: ActivityResult = isTM ? AUTO_RESULT[tmStatus] : result;
  const showMeetingDate  = isTM ? tmStatus === "APPOINTMENT" : result === "MEETING_SCHEDULED";
  const showFollowUpDate = isTM ? tmStatus === "KIV" : result === "FOLLOW_UP_NEEDED";
  const reasonOptions = isTM ? STATUS_REASONS[tmStatus] : [];
  const reasonRequired = isTM && reasonOptions.length > 0;
  const notesRequired    = isTM
    ? tmStatus === "AVOID"                          // Not Interested At All — must describe
    : result === "FAILED" || result === "CANCELLED";
  const followUpDateRequired = showFollowUpDate;

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
    (reasonRequired && !reason) ||
    (showProspectValue && !hasValidProspectValue) ||
    (followUpDateRequired && !followUpDateTime) ||
    (showMeetingDate && !meetingDateTime) ||
    usersLoading;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!lead || !currentUser) return;
    if (submitDisabled) return;

    const pickup = isTM ? tmStatus !== "NA" : effectiveResult !== "NO_ANSWER";
    const metadata: Record<string, unknown> = { duration_seconds: callDurationSeconds };
    if (showMeetingDate && meetingDateTime)
      metadata.meeting_scheduled_at = new Date(meetingDateTime).toISOString();
    if (showFollowUpDate && followUpDateTime)
      metadata.follow_up_scheduled_at = new Date(followUpDateTime).toISOString();
    if (showProspectValue && hasValidProspectValue)
      metadata.prospect_value = prospectValueNumber;
    if (isTM) {
      metadata.previous_status = lead.status;
      metadata.new_status = tmStatus;
      if (reason) metadata.reason = reason;
    }

    const subject = isTM
      ? `Status changed to ${STATUS_LABELS[tmStatus]}${reason ? ` — ${reason}` : ""} — ${lead.first_name} ${lead.last_name}`
      : `Call — ${lead.first_name} ${lead.last_name}`;

    try {
      await createActivityMutation.mutateAsync({
        type: "CALL",
        subject,
        description: finalNotes || undefined,
        result: effectiveResult,
        scheduled_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        metadata,
        lead_id: lead.id,
        assigned_to_id: currentUser.id,
        created_by: currentUser.id,
      });

      if (showMeetingDate && meetingDateTime) {
        await createActivityMutation.mutateAsync(
        {
          type: "MEETING",
          subject: `Meeting — ${lead.first_name} ${lead.last_name}`,
          description: finalNotes || undefined,
          result: "MEETING_SCHEDULED",
          scheduled_at: new Date(meetingDateTime).toISOString(),
          lead_id: lead.id,
            assigned_to_id: currentUser.id,
          created_by: currentUser.id,
        });
      }

      if (showFollowUpDate && followUpDateTime) {
        await createActivityMutation.mutateAsync(
        {
          type: "FOLLOW_UP",
          subject: `Follow-up — ${lead.first_name} ${lead.last_name}`,
          description: finalNotes || undefined,
          scheduled_at: new Date(followUpDateTime).toISOString(),
          lead_id: lead.id,
            assigned_to_id: currentUser.id,
          created_by: currentUser.id,
        });
      }

      // TM: update the lead's status to match the call outcome (NA/KIV/AVOID/OTHERS).
      // APPOINTMENT is handled below alongside the appointment fields.
      if (isTM && tmStatus !== "APPOINTMENT") {
        await updateLeadMutation.mutateAsync({
          id: lead.id,
          payload: { status: tmStatus },
          userId: currentUser.id,
        });
      }

      // Auto-advance lead to APPOINTMENT + create contact & deal when a meeting is scheduled
      if (showMeetingDate && meetingDateTime) {
        const assignedAdviser = resolveAppointmentDealAdviser({
          actor: currentUser,
          lead,
          users,
        });

        await updateLeadMutation.mutateAsync({
          id: lead.id,
          payload: {
            status: "APPOINTMENT",
            appointment_date: meetingDate,
            appointment_time: meetingTime,
          },
          userId: currentUser.id,
        });

        const existingDeal = deals.find((d) => d.lead_id === lead.id && !d.deleted_at);
        if (!existingDeal) {
          let contactId = lead.converted_contact_id;
          if (!contactId) {
            const newContact = await createContactMutation.mutateAsync({
            first_name: lead.first_name,
            last_name: lead.last_name,
            email: lead.email,
            phone: lead.phone,
            source: lead.source,
            created_by: currentUser.id,
            ...pickFactFind(lead),
            });
            contactId = newContact.id;
            await updateLeadMutation.mutateAsync({
              id: lead.id,
              payload: { converted_contact_id: contactId },
              userId: currentUser.id,
            });
          }
          await createDealMutation.mutateAsync({
            title: `${lead.first_name} ${lead.last_name}`,
            value: 0,
            stage: "APPOINTMENT",
            lead_id: lead.id,
            contact_id: contactId,
            assigned_to_id: assignedAdviser?.id,
            telemarketer_id: currentUser.id,
            created_by: currentUser.id,
            ...pickFactFind(lead),
          });
          if (assignedAdviser) {
            await updateUserMutation.mutateAsync({
              id: assignedAdviser.id,
              payload: {
                credit_balance: nextCreditBalanceAfterAppointmentClaim(assignedAdviser),
              },
            });
          }
        }
      }

      submitOutcome(pickup);
      nextLead();
      setResult(isTM ? "NO_ANSWER" : "COMPLETED");
      setTmStatus("NA");
      setReason("");
      setNotes("");
      setFollowUpDate("");
      setFollowUpTime("");
      setMeetingDate("");
      setMeetingTime("");
      setProspectValue("");
    } catch (error) {
      console.error("Failed to save call outcome", error);
    }
  };

  // ── Helpers for label/placeholder ─────────────────────────────────────────
  const notesPlaceholder = isTM
    ? tmStatus === "AVOID"
      ? "Required — describe why (e.g. requested removal, wrong number…)"
      : tmStatus === "KIV"
      ? "Optional — what did they say? When to call back?"
      : tmStatus === "OTHERS"
      ? "Optional — describe what happened"
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
            {TM_STATUS_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setTmStatus(value); setReason(""); }}
                className={[
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  tmStatus === value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center",
                    tmStatus === value ? "border-primary" : "border-muted-foreground/40",
                  ].join(" ")}
                >
                  {tmStatus === value && (
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

      {/* Reason — TM only, depends on the selected outcome */}
      {isTM && reasonOptions.length > 0 && (
        <div className="space-y-2">
          <Label>Reason *</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className={!reason ? "text-muted-foreground" : ""}>
              <SelectValue placeholder="Select a reason…" />
            </SelectTrigger>
            <SelectContent>
              {reasonOptions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Meeting date (both roles) */}
      {showMeetingDate && (
        <div className="space-y-2">
          <Label>Meeting Scheduled At *</Label>
          <div className="flex gap-2">
            <Input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="text-sm flex-1"
            />
            <Input
              type="time"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="text-sm flex-1"
            />
          </div>
          {!meetingDateTime && (
            <p className="text-xs text-destructive">Meeting date and time are required.</p>
          )}
          {meetingDateTime && (
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
          <div className="flex gap-2">
            <Input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="text-sm flex-1"
            />
            <Input
              type="time"
              value={followUpTime}
              onChange={(e) => setFollowUpTime(e.target.value)}
              className="text-sm flex-1"
            />
          </div>
          {followUpDateRequired && !followUpDateTime && (
            <p className="text-xs text-destructive">Follow-up date and time are required.</p>
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
