import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import type { ActivityResult, Lead } from "@/data/types";
import { ChevronRight, PhoneOff } from "lucide-react";

const RESULTS: ActivityResult[] = [
  "COMPLETED", "NO_ANSWER", "FOLLOW_UP_NEEDED", "MEETING_SCHEDULED", "DEAL_ADVANCED", "CANCELLED", "FAILED"
];
const POSITIVE_RESULTS: ActivityResult[] = ["COMPLETED", "MEETING_SCHEDULED", "DEAL_ADVANCED"];
const PROSPECT_VALUE_RESULTS: ActivityResult[] = ["COMPLETED", "DEAL_ADVANCED"];
const FOLLOW_UP_RESULTS: ActivityResult[] = ["NO_ANSWER", "FOLLOW_UP_NEEDED"];

interface CallOutcomeFormProps {
  lead: Lead | undefined;
}

export function CallOutcomeForm({ lead }: CallOutcomeFormProps) {
  const [result, setResult] = useState<ActivityResult>("COMPLETED");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [prospectValue, setProspectValue] = useState("");

  const { submitOutcome, nextLead, campaign, liveNotes, callDurationSeconds } = useCallSessionStore();
  const { createActivity, updateLead } = useCrmStore();
  const { currentUser } = useAuthStore();

  const isPositive = POSITIVE_RESULTS.includes(result);
  const showProspectValue = PROSPECT_VALUE_RESULTS.includes(result);
  const showFollowUpDate = FOLLOW_UP_RESULTS.includes(result);
  const showMeetingDate = result === "MEETING_SCHEDULED";
  const notesRequired = result === "FAILED" || result === "CANCELLED";
  const followUpDateRequired = result === "FOLLOW_UP_NEEDED";
  const finalNotes = (notes || liveNotes).trim();
  const prospectValueNumber = Number(prospectValue);
  const hasValidProspectValue =
    prospectValue.trim() !== "" &&
    Number.isFinite(prospectValueNumber) &&
    prospectValueNumber > 0;
  const submitDisabled =
    (notesRequired && !finalNotes) ||
    (showProspectValue && !hasValidProspectValue) ||
    (followUpDateRequired && !followUpDate) ||
    (showMeetingDate && !meetingDate);

  const handleSubmit = () => {
    if (!lead || !currentUser || !campaign) return;
    if (submitDisabled) return;

    const pickup = result !== "NO_ANSWER";
    const parsedProspectValue = hasValidProspectValue ? prospectValueNumber : undefined;
    const metadata: Record<string, unknown> = { duration_seconds: callDurationSeconds };

    if (showMeetingDate && meetingDate) {
      metadata.meeting_scheduled_at = new Date(meetingDate).toISOString();
    }
    if (showFollowUpDate && followUpDate) {
      metadata.follow_up_scheduled_at = new Date(followUpDate).toISOString();
    }
    if (showProspectValue && parsedProspectValue) {
      metadata.prospect_value = parsedProspectValue;
    }

    createActivity(
      {
        type: "CALL",
        subject: `Call - ${lead.first_name} ${lead.last_name}`,
        description: finalNotes || undefined,
        result,
        scheduled_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        metadata,
        lead_id: lead.id,
        campaign_id: campaign.id,
        assigned_to_id: currentUser.id,
        created_by: currentUser.id,
      },
      currentUser.id
    );

    if (lead.status === "NEW") {
      updateLead(lead.id, { status: "CONTACTED" }, currentUser.id);
    }

    if (showMeetingDate && meetingDate) {
      createActivity(
        {
          type: "MEETING",
          subject: `Meeting - ${lead.first_name} ${lead.last_name}`,
          description: finalNotes || undefined,
          result: "MEETING_SCHEDULED",
          scheduled_at: new Date(meetingDate).toISOString(),
          lead_id: lead.id,
          campaign_id: campaign.id,
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
          subject: `Follow-up - ${lead.first_name} ${lead.last_name}`,
          description: finalNotes || undefined,
          scheduled_at: new Date(followUpDate).toISOString(),
          lead_id: lead.id,
          campaign_id: campaign.id,
          assigned_to_id: currentUser.id,
          created_by: currentUser.id,
        },
        currentUser.id
      );
    }

    submitOutcome(pickup);
    nextLead();
    setResult("COMPLETED");
    setNotes("");
    setFollowUpDate("");
    setMeetingDate("");
    setProspectValue("");
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <PhoneOff className="h-5 w-5 text-red-500" />
          End Call - Log Outcome
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {lead?.first_name} {lead?.last_name}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Call Result *</Label>
        <Select value={result} onValueChange={(v) => setResult(v as ActivityResult)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESULTS.map((r) => (
              <SelectItem key={r} value={r}>
                {r.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showProspectValue && (
        <div className="space-y-2">
          <Label>Prospect Value *</Label>
          <Input
            type="number"
            min="0"
            value={prospectValue}
            onChange={(e) => setProspectValue(e.target.value)}
            placeholder="250000000"
            className="text-sm"
          />
          {!hasValidProspectValue && (
            <p className="text-xs text-destructive">Prospect value is required for completed and deal advanced calls.</p>
          )}
        </div>
      )}

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
            <p className="text-xs text-destructive">Meeting date is required for meeting scheduled calls.</p>
          )}
        </div>
      )}

      {isPositive && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 text-sm">
          <p className="font-medium text-green-800 dark:text-green-300">Positive outcome!</p>
          <p className="text-green-700 dark:text-green-400 text-xs mt-0.5">
            Prospect details will be saved with this call. You can create a deal from the lead detail page after this session.
          </p>
        </div>
      )}

      {showFollowUpDate && (
        <div className="space-y-2">
          <Label>Schedule Follow-up{followUpDateRequired ? " *" : ""}</Label>
          <Input
            type="datetime-local"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="text-sm"
          />
          {followUpDateRequired && !followUpDate && (
            <p className="text-xs text-destructive">Follow-up date is required for follow up needed calls.</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Notes{notesRequired ? " *" : ""}</Label>
        <Textarea
          value={notes || liveNotes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={notesRequired ? "Required: add context for this outcome." : "What happened during the call?"}
          rows={3}
          className="text-sm"
        />
        {notesRequired && !finalNotes && (
          <p className="text-xs text-destructive">Notes are required for failed and cancelled calls.</p>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={submitDisabled} className="w-full gap-2">
        Submit & Next Lead
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
