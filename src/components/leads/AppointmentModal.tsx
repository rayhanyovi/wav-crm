import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConvertLead } from "@/hooks/useLeads";
import { useCreateActivity } from "@/hooks/useActivities";
import { useUsers } from "@/hooks/useUsers";
import { useAuthStore } from "@/store/useAuthStore";
import { assignableAdvisersFor } from "@/lib/dealAssignment";
import type { Lead } from "@/data/types";

interface AppointmentModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  /** Fired after a successful conversion (lead → contact + deal). */
  onConverted?: (leadId: string) => void;
}

export function AppointmentModal({ lead, open, onClose, onConverted }: AppointmentModalProps) {
  const { currentUser } = useAuthStore();
  const convertLead    = useConvertLead();
  const createActivity = useCreateActivity();
  const { data: users = [] } = useUsers();

  // Advisers this actor can assign the appointment to (spending the adviser's
  // credit). A delegated TM with several granting advisers must pick one (2d).
  const assignableAdvisers = assignableAdvisersFor(currentUser, users);

  // Appointment details
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const appointmentDateTime = appointmentDate && appointmentTime ? `${appointmentDate}T${appointmentTime}` : "";
  const [notes, setNotes] = useState("");
  // "" = leave unassigned (claim pool). Default to the only granting adviser.
  const [assignAdviserId, setAssignAdviserId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const reset = () => {
    setAppointmentDate("");
    setAppointmentTime("");
    setNotes("");
    setAssignAdviserId("");
    setError(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) { reset(); onClose(); }
  };

  const handleSubmit = async () => {
    if (!currentUser) return;

    setSubmitting(true);
    setError(null);

    try {
      // If an adviser is chosen the backend assigns the deal to them and spends
      // one of their credits; otherwise the deal stays unassigned (claim pool).
      const { contact_id, deal_id } = await convertLead.mutateAsync({
        leadId: lead.id,
        userId: currentUser.id,
        payload: {
          contact: {
            first_name: lead.first_name,
            last_name:  lead.last_name,
            email:      lead.email ?? undefined,
            phone:      lead.phone ?? undefined,
            source:     lead.source,
            created_by: currentUser.id,
          },
          deal: {
            title:          `${lead.first_name} ${lead.last_name} – Appointment`,
            value:          0,
            stage:          "APPOINTMENT",
            assigned_to_id: assignAdviserId || null,
            created_by:     currentUser.id,
          },
        },
      });

      // Fact-find carry-over is handled server-side by convertLead (it copies the
      // lead's fact-find onto both the new contact and deal at creation), so no
      // extra writes are needed here — and a TM can't PATCH the unassigned deal.

      // Schedule an appointment activity if a date was given
      if (appointmentDateTime) {
        await createActivity.mutateAsync({
          type:        "MEETING",
          subject:     `Appointment — ${lead.first_name} ${lead.last_name}`,
          description: notes.trim() || undefined,
          result:      "MEETING_SCHEDULED",
          lead_id:     lead.id,
          contact_id:  contact_id ?? undefined,
          deal_id:     deal_id ?? undefined,
          created_by:  currentUser.id,
          scheduled_at: new Date(appointmentDateTime).toISOString(),
          metadata: { converted_from_lead: lead.id },
        });
      } else if (notes.trim()) {
        // No date but user left notes — log as a note activity anyway
        await createActivity.mutateAsync({
          type:        "NOTE",
          subject:     `Appointment booked — ${lead.first_name} ${lead.last_name}`,
          description: notes.trim(),
          result:      "MEETING_SCHEDULED",
          lead_id:     lead.id,
          contact_id:  contact_id ?? undefined,
          deal_id:     deal_id ?? undefined,
          created_by:  currentUser.id,
          completed_at: new Date().toISOString(),
          metadata: { converted_from_lead: lead.id },
        });
      }

      reset();
      onConverted?.(lead.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Move to Appointment
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {lead.first_name} {lead.last_name} will be converted to a contact and a deal
            will be created in the pipeline automatically.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* ── Appointment scheduling ── */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Appointment details
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="ap-date" className="text-xs">
                Appointment date &amp; time
              </Label>
              <div className="flex gap-2">
                <Input
                  id="ap-date"
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="flex-1"
                />
                <Input
                  id="ap-time"
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className="flex-1"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Leave blank if not yet scheduled — you can add it from the deal later.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-notes" className="text-xs">Notes</Label>
              <Textarea
                id="ap-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What was discussed? Any prep notes for the meeting…"
              />
            </div>

            {assignableAdvisers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Assign to adviser</Label>
                <Select value={assignAdviserId || "none"} onValueChange={(v) => setAssignAdviserId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Leave unassigned (claim pool)</SelectItem>
                    {assignableAdvisers.map((adviser) => (
                      <SelectItem key={adviser.id} value={adviser.id}>
                        {adviser.name} · {adviser.credit_balance ?? 0} credit{(adviser.credit_balance ?? 0) === 1 ? "" : "s"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Choosing an adviser assigns the deal to them now and spends 1 of their credits.
                  Otherwise it goes to the pool for any adviser to claim.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-2"
          >
            <CalendarCheck className="h-4 w-4" />
            {submitting ? "Converting…" : "Book Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
