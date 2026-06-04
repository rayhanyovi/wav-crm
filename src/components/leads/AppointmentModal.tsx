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
import { Checkbox } from "@/components/ui/checkbox";
import { useConvertLead } from "@/hooks/useLeads";
import { useCreateActivity } from "@/hooks/useActivities";
import { useAuthStore } from "@/store/useAuthStore";
import type { Lead } from "@/data/types";

interface AppointmentModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
}

export function AppointmentModal({ lead, open, onClose }: AppointmentModalProps) {
  const { currentUser } = useAuthStore();
  const convertLead    = useConvertLead();
  const createActivity = useCreateActivity();

  // Contact fields — pre-filled from lead
  const [firstName, setFirstName] = useState(lead.first_name);
  const [lastName,  setLastName]  = useState(lead.last_name);
  const [email,     setEmail]     = useState(lead.email ?? "");
  const [phone,     setPhone]     = useState(lead.phone ?? "");

  // Deal creation (optional but recommended)
  const [createDeal, setCreateDeal] = useState(true);
  const [dealTitle,  setDealTitle]  = useState(
    `${lead.first_name} ${lead.last_name} – Appointment`,
  );
  const [dealValue, setDealValue] = useState("");

  // Appointment details
  const [appointmentDate, setAppointmentDate] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const reset = () => {
    setFirstName(lead.first_name);
    setLastName(lead.last_name);
    setEmail(lead.email ?? "");
    setPhone(lead.phone ?? "");
    setCreateDeal(true);
    setDealTitle(`${lead.first_name} ${lead.last_name} – Appointment`);
    setDealValue("");
    setAppointmentDate("");
    setNotes("");
    setError(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) { reset(); onClose(); }
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (createDeal && !dealTitle.trim()) {
      setError("Deal title is required when creating a deal.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { contact_id, deal_id } = await convertLead.mutateAsync({
        leadId: lead.id,
        userId: currentUser.id,
        payload: {
          contact: {
            first_name: firstName.trim(),
            last_name:  lastName.trim(),
            email:      email.trim() || undefined,
            phone:      phone.trim() || undefined,
            source:     lead.source,
            created_by: currentUser.id,
          },
          deal: createDeal
            ? {
                title:          dealTitle.trim(),
                value:          dealValue ? parseFloat(dealValue) : 0,
                stage:          "APPOINTMENT",
                assigned_to_id: lead.assigned_to_id ?? currentUser.id,
                created_by:     currentUser.id,
                contact_id,     // filled in by RPC; placeholder here
              }
            : null,
        },
      });

      // Schedule an appointment activity if a date was given
      if (appointmentDate) {
        await createActivity.mutateAsync({
          type:        "MEETING",
          subject:     `Appointment — ${firstName.trim()} ${lastName.trim()}`,
          description: notes.trim() || undefined,
          result:      "MEETING_SCHEDULED",
          lead_id:     lead.id,
          contact_id:  contact_id ?? undefined,
          deal_id:     deal_id ?? undefined,
          created_by:  currentUser.id,
          scheduled_at: new Date(appointmentDate).toISOString(),
          metadata: { converted_from_lead: lead.id },
        });
      } else if (notes.trim()) {
        // No date but user left notes — log as a note activity anyway
        await createActivity.mutateAsync({
          type:        "NOTE",
          subject:     `Appointment booked — ${firstName.trim()} ${lastName.trim()}`,
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
            This converts the lead into a contact and moves them to your deals pipeline.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* ── Contact details ── */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contact details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ap-fname" className="text-xs">First name <span className="text-destructive">*</span></Label>
                <Input
                  id="ap-fname"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-lname" className="text-xs">Last name <span className="text-destructive">*</span></Label>
                <Input
                  id="ap-lname"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-email" className="text-xs">Email</Label>
                <Input
                  id="ap-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-phone" className="text-xs">Phone</Label>
                <Input
                  id="ap-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>
          </div>

          {/* ── Deal creation ── */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="ap-create-deal"
                checked={createDeal}
                onCheckedChange={(v) => setCreateDeal(!!v)}
              />
              <Label htmlFor="ap-create-deal" className="text-sm font-medium cursor-pointer">
                Create a deal in the pipeline
              </Label>
            </div>

            {createDeal && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ap-deal-title" className="text-xs">
                    Deal title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ap-deal-title"
                    value={dealTitle}
                    onChange={(e) => setDealTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-deal-value" className="text-xs">
                    Estimated value (SGD)
                  </Label>
                  <Input
                    id="ap-deal-value"
                    type="number"
                    min="0"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Appointment scheduling ── */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Appointment details
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="ap-date" className="text-xs">
                Appointment date &amp; time
              </Label>
              <Input
                id="ap-date"
                type="datetime-local"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
              />
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
            disabled={submitting || !firstName.trim() || !lastName.trim()}
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
