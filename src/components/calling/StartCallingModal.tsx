import { useMemo } from "react";
import { Phone, Users, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useLeads, useClaimLeadsForCall } from "@/hooks/useLeads";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { isAdviser, isColdCaller } from "@/lib/permissions";
import { CALL_SESSION_SIZE } from "@/lib/callQueue";
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
  const claimLeadsForCall = useClaimLeadsForCall();

  // Advisers with "leads access" cold-call the shared NA pool exactly like a TM —
  // they take on the calling job too. (Appointments are offline meetings, not calls.)
  const usesColdPool = isColdCaller(currentUser);

  /**
   * TM queue: a shared pool of cold-call-ready leads — status NA, plus
   * COOLDOWN leads whose cooldown period has elapsed. Not restricted to
   * leads already assigned to this TM, so they don't have to wait for an
   * assignment first. Capped to CALL_SESSION_SIZE; bounced-back and
   * cooldown-expired leads float to the top.
   */
  const tmQueue = useMemo<Lead[]>(() => {
    if (!currentUser || !usesColdPool) return [];
    const now = Date.now();
    return leads
      .filter((l) => {
        if (l.deleted_at || DEAD_STATUSES.has(l.status)) return false;
        if (l.status === "NA") return true;
        if (l.status === "COOLDOWN") {
          return !l.cooldown_until || new Date(l.cooldown_until).getTime() <= now;
        }
        return false;
      })
      .sort((a, b) => {
        // Recently bounced leads (no-show returned) float to the top
        const aBounced = a.last_bounced_at && a.status === "NA" ? new Date(a.last_bounced_at).getTime() : 0;
        const bBounced = b.last_bounced_at && b.status === "NA" ? new Date(b.last_bounced_at).getTime() : 0;
        if (aBounced !== bBounced) return bBounced - aBounced;

        // Cooldown-expired leads come next
        const aCooldown = a.status === "COOLDOWN" ? 1 : 0;
        const bCooldown = b.status === "COOLDOWN" ? 1 : 0;
        if (aCooldown !== bCooldown) return bCooldown - aCooldown;

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, CALL_SESSION_SIZE);
  }, [leads, currentUser, usesColdPool]);

  /**
   * Adviser queue: leads past the TM cold-call phase — i.e. leads that have
   * been handed off (status = APPOINTMENT) and belong to this adviser, plus
   * leads tied to deals the adviser owns that are in APPOINTMENT or later stages.
   */
  const adviserQueue = useMemo<Lead[]>(() => {
    // Advisers who cold-call (leads access on) use the shared pool instead.
    if (!currentUser || !isAdviser(currentUser) || usesColdPool) return [];

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
  }, [leads, deals, currentUser, usesColdPool]);

  const queue = usesColdPool ? tmQueue : adviserQueue;

  const handleStart = () => {
    if (queue.length === 0 || !currentUser) return;
    if (usesColdPool) {
      claimLeadsForCall.mutate({
        leadIds: queue.map((l) => l.id),
        userId: currentUser.id,
      });
    }
    startSession(queue);
    onClose();
  };

  const queueDescription = usesColdPool
    ? `Up to ${CALL_SESSION_SIZE} leads from the shared NA pool, with bounced and cooldown-expired prospects first.`
    : "Leads past the TM cold-call phase — appointments to confirm and follow ups to close.";

  const emptyMessage = usesColdPool
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
                  {usesColdPool ? (
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
                        : l.status === "COOLDOWN"
                        ? "↻ cooldown expired"
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
