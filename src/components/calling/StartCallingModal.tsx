import { useMemo } from "react";
import { Phone, Users, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useLeads } from "@/hooks/useLeads";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { isTelemarketer, isAdviser } from "@/lib/permissions";
import type { Lead } from "@/data/types";

interface StartCallingModalProps {
  open: boolean;
  onClose: () => void;
}

/** Statuses that mean the lead is done / unworkable — exclude from call queues */
const DEAD_STATUSES = new Set(["AVOID", "NOT_INTERESTED", "OTHERS"]);

export function StartCallingModal({ open, onClose }: StartCallingModalProps) {
  const { deals } = useCrmStore();
  const { data: leads = [] } = useLeads({ includeAbandoned: false });
  const { currentUser } = useAuthStore();
  const { startSession } = useCallSessionStore();

  /** TM queue: their owned leads that are still workable, bounced leads float to the top */
  const tmQueue = useMemo<Lead[]>(() => {
    if (!currentUser || !isTelemarketer(currentUser)) return [];
    return leads
      .filter(
        (l) =>
          !l.deleted_at &&
          !DEAD_STATUSES.has(l.status) &&
          (l.telemarketer_owner_id === currentUser.id ||
            l.assigned_to_id === currentUser.id)
      )
      .sort((a, b) => {
        // Recently bounced leads (no-show returned) float to the top
        const aBounced = a.last_bounced_at && a.status === "NA" ? new Date(a.last_bounced_at).getTime() : 0;
        const bBounced = b.last_bounced_at && b.status === "NA" ? new Date(b.last_bounced_at).getTime() : 0;
        if (aBounced !== bBounced) return bBounced - aBounced;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [leads, currentUser]);

  /**
   * Adviser queue: leads past the TM cold-call phase — i.e. leads that have
   * been handed off (status = APPOINTMENT) and belong to this adviser, plus
   * leads tied to deals the adviser owns that are in APPOINTMENT or later stages.
   */
  const adviserQueue = useMemo<Lead[]>(() => {
    if (!currentUser || !isAdviser(currentUser)) return [];

    // Collect lead IDs from adviser's active deals (APPOINTMENT+)
    const dealLeadIds = new Set<string>(
      deals
        .filter(
          (d) =>
            !d.deleted_at &&
            d.assigned_to_id === currentUser.id &&
            d.stage !== "WON" &&
            d.stage !== "LOST" &&
            d.lead_id
        )
        .map((d) => d.lead_id as string)
    );

    return leads
      .filter(
        (l) =>
          !l.deleted_at &&
          !DEAD_STATUSES.has(l.status) &&
          (l.assigned_to_id === currentUser.id || dealLeadIds.has(l.id)) &&
          // Past cold-call phase: APPOINTMENT status or linked to a deal
          (l.status === "APPOINTMENT" || dealLeadIds.has(l.id))
      )
      .sort((a, b) => {
        // Prioritise upcoming appointments first
        const aAppt = a.appointment_date ? new Date(a.appointment_date).getTime() : Infinity;
        const bAppt = b.appointment_date ? new Date(b.appointment_date).getTime() : Infinity;
        if (aAppt !== bAppt) return aAppt - bAppt;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [leads, deals, currentUser]);

  const isTM = isTelemarketer(currentUser);
  const isAdv = isAdviser(currentUser);
  const queue = isTM ? tmQueue : adviserQueue;

  const handleStart = () => {
    if (queue.length === 0) return;
    startSession(queue);
    onClose();
  };

  const queueDescription = isTM
    ? "All your workable leads, with recently bounced prospects at the top."
    : "Leads past the TM cold-call phase — appointments to confirm and follow ups to close.";

  const emptyMessage = isTM
    ? "You have no workable leads in your queue right now."
    : "No leads ready for your follow-up calls yet. Leads appear here once a TM sets an appointment.";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Start Calling Session
          </DialogTitle>
          <DialogDescription>{queueDescription}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {queue.length > 0 ? (
            <div className="rounded-lg bg-muted p-4 space-y-3">
              {/* Queue stat chips */}
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  {isTM ? (
                    <Users className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Calendar className="h-4 w-4 text-green-500" />
                  )}
                  {queue.length} {queue.length === 1 ? "lead" : "leads"} ready
                </span>
              </div>

              {/* Preview — first 3 leads */}
              <ul className="space-y-1.5">
                {queue.slice(0, 3).map((l) => (
                  <li key={l.id} className="text-sm flex items-center justify-between">
                    <span className="font-medium">
                      {l.first_name} {l.last_name}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {l.last_bounced_at && l.status === "NA"
                        ? "↑ bounced back"
                        : l.status === "APPOINTMENT"
                        ? "📅 appointment"
                        : l.status.toLowerCase()}
                    </span>
                  </li>
                ))}
                {queue.length > 3 && (
                  <li className="text-xs text-muted-foreground">
                    + {queue.length - 3} more…
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleStart}
            disabled={queue.length === 0}
            className="gap-2"
          >
            <Phone className="h-4 w-4" />
            Start Session ({queue.length} leads)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
