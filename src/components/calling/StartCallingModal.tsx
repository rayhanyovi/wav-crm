import { useMemo, useState } from "react";
import { Phone, Users, Calendar, SlidersHorizontal, X, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useLeads, useClaimLeadsForCall } from "@/hooks/useLeads";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { isAdviser, isColdCaller, isMaster } from "@/lib/permissions";
import { CALL_SESSION_SIZE } from "@/lib/callQueue";
import type { Lead, LeadSource } from "@/data/types";

interface StartCallingModalProps {
  open: boolean;
  onClose: () => void;
}

/** Statuses that mean the lead is done / unworkable — exclude from call queues */
const DEAD_STATUSES = new Set(["AVOID", "NOT_INTERESTED", "OTHERS"]);

const SOURCE_LABELS: Record<LeadSource, string> = {
  AP_MARKETING: "AP Marketing",
  LP_MARKETING: "LP Marketing",
  OWN_SOURCE: "Own Source",
  OTHERS: "Others",
};

// ─── Session targeting filters ────────────────────────────────────────────────
interface CallFilters {
  scope: "ALL" | "MY_UPLOADS";
  gender: string;       // "ALL" or an exact value present in the pool
  income: string;       // "ALL" or an exact income_range value
  residential: string;  // "ALL" or an exact residential_status value
  source: string;       // "ALL" or a LeadSource
  ageMin: string;       // numeric text
  ageMax: string;       // numeric text
  zipcode: string;      // prefix match
}

const EMPTY_FILTERS: CallFilters = {
  scope: "ALL",
  gender: "ALL",
  income: "ALL",
  residential: "ALL",
  source: "ALL",
  ageMin: "",
  ageMax: "",
  zipcode: "",
};

/** Distinct, sorted, non-empty values for a lead field — used to build dropdowns
 *  from whatever is actually in the pool (robust to messy / freeform data). */
function distinctValues(leads: Lead[], pick: (l: Lead) => string | undefined | null): string[] {
  const set = new Set<string>();
  for (const l of leads) {
    const v = pick(l);
    if (v && v.trim()) set.add(v.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function isMyUploadedLead(l: Lead, userId: string): boolean {
  return l.created_by === userId;
}

function matchesFilters(l: Lead, f: CallFilters, userId: string | undefined): boolean {
  if (f.scope === "MY_UPLOADS" && (!userId || !isMyUploadedLead(l, userId))) return false;
  if (f.gender !== "ALL" && (l.gender ?? "").trim() !== f.gender) return false;
  if (f.income !== "ALL" && (l.income_range ?? "").trim() !== f.income) return false;
  if (f.residential !== "ALL" && (l.residential_status ?? "").trim() !== f.residential) return false;
  if (f.source !== "ALL" && l.source !== f.source) return false;
  if (f.zipcode.trim() && !(l.zipcode ?? "").trim().startsWith(f.zipcode.trim())) return false;

  const min = f.ageMin ? parseInt(f.ageMin, 10) : null;
  const max = f.ageMax ? parseInt(f.ageMax, 10) : null;
  if (min !== null && !Number.isNaN(min) && (l.age == null || l.age < min)) return false;
  if (max !== null && !Number.isNaN(max) && (l.age == null || l.age > max)) return false;

  return true;
}

function countActive(f: CallFilters): number {
  let n = 0;
  if (f.scope !== "ALL") n++;
  if (f.gender !== "ALL") n++;
  if (f.income !== "ALL") n++;
  if (f.residential !== "ALL") n++;
  if (f.source !== "ALL") n++;
  if (f.zipcode.trim()) n++;
  if (f.ageMin || f.ageMax) n++;
  return n;
}

function lastContactedTime(lead: Lead): number {
  return lead.last_contacted_at ? new Date(lead.last_contacted_at).getTime() : 0;
}

export function StartCallingModal({ open, onClose }: StartCallingModalProps) {
  const { deals } = useCrmStore();
  const { data: leads = [] } = useLeads({ includeAbandoned: false });
  const { currentUser } = useAuthStore();
  const { startSession } = useCallSessionStore();
  const claimLeadsForCall = useClaimLeadsForCall();

  const [filters, setFilters] = useState<CallFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  // Advisers with "leads access" cold-call the shared NA pool exactly like a TM —
  // they take on the calling job too. (Appointments are offline meetings, not calls.)
  const usesColdPool = isColdCaller(currentUser);

  /**
   * TM eligible pool: the FULL shared pool of cold-call-ready leads — status NA,
   * plus COOLDOWN leads whose cooldown period has elapsed. Sorted with bounced-back
   * and cooldown-expired leads on top. Not yet capped — filters are applied first,
   * then the result is sliced to CALL_SESSION_SIZE.
   */
  const eligiblePool = useMemo<Lead[]>(() => {
    if (!currentUser || !usesColdPool) return [];
    const now = Date.now();
    const isAssignedCallback = (l: Lead) =>
      !l.callback_assigned_to || isMaster(currentUser) || l.callback_assigned_to === currentUser.id;
    const dueCallbackAt = (l: Lead) =>
      l.callback_at && isAssignedCallback(l) && new Date(l.callback_at).getTime() <= now
        ? new Date(l.callback_at).getTime()
        : null;
    return leads
      .filter((l) => {
        if (l.deleted_at || DEAD_STATUSES.has(l.status)) return false;
        if (l.callback_at && !isAssignedCallback(l)) return false;
        if (dueCallbackAt(l) !== null) return true; // a due callback is always workable
        if (l.status === "NA") return true;
        if (l.status === "COOLDOWN") {
          return !l.cooldown_until || new Date(l.cooldown_until).getTime() <= now;
        }
        return false;
      })
      .sort((a, b) => {
        // Due callbacks jump to the very top (earliest requested time first)
        const aCb = dueCallbackAt(a);
        const bCb = dueCallbackAt(b);
        if (aCb !== null || bCb !== null) {
          if (aCb === null) return 1;
          if (bCb === null) return -1;
          return aCb - bCb;
        }

        // Recently bounced leads (no-show returned) float to the top
        const aBounced = a.last_bounced_at && a.status === "NA" ? new Date(a.last_bounced_at).getTime() : 0;
        const bBounced = b.last_bounced_at && b.status === "NA" ? new Date(b.last_bounced_at).getTime() : 0;
        if (aBounced !== bBounced) return bBounced - aBounced;

        // Cooldown-expired leads come next
        const aCooldown = a.status === "COOLDOWN" ? 1 : 0;
        const bCooldown = b.status === "COOLDOWN" ? 1 : 0;
        if (aCooldown !== bCooldown) return bCooldown - aCooldown;

        // Leads just attempted stay in the pool if still workable, but move
        // behind untouched or older-attempted leads for the next session.
        const aLastContacted = lastContactedTime(a);
        const bLastContacted = lastContactedTime(b);
        if (aLastContacted !== bLastContacted) return aLastContacted - bLastContacted;

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
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

  // Filter options come from whatever is actually in the eligible pool.
  const genderOptions = useMemo(() => distinctValues(eligiblePool, (l) => l.gender), [eligiblePool]);
  const incomeOptions = useMemo(() => distinctValues(eligiblePool, (l) => l.income_range), [eligiblePool]);
  const residentialOptions = useMemo(() => distinctValues(eligiblePool, (l) => l.residential_status), [eligiblePool]);
  const myUploadedCount = useMemo(
    () => currentUser ? eligiblePool.filter((l) => isMyUploadedLead(l, currentUser.id)).length : 0,
    [eligiblePool, currentUser],
  );

  // Apply targeting filters (cold pool only), then cap to the session size.
  const filteredPool = usesColdPool
    ? eligiblePool.filter((l) => matchesFilters(l, filters, currentUser?.id))
    : adviserQueue;
  const queue = usesColdPool ? filteredPool.slice(0, CALL_SESSION_SIZE) : adviserQueue;

  const activeFilterCount = countActive(filters);

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

  const handleClose = () => {
    setFilters(EMPTY_FILTERS);
    setShowFilters(false);
    onClose();
  };

  const queueDescription = usesColdPool
    ? filters.scope === "MY_UPLOADS"
      ? `Up to ${CALL_SESSION_SIZE} leads you uploaded, with bounced and cooldown-expired prospects first.`
      : `Up to ${CALL_SESSION_SIZE} leads from the shared NA pool, with bounced and cooldown-expired prospects first.`
    : "Leads past the TM cold-call phase — appointments to confirm and follow ups to close.";

  const emptyMessage = usesColdPool
    ? activeFilterCount > 0
      ? "No leads match these filters. Try widening them."
      : "You have no workable leads in your queue right now."
    : "No leads ready for your follow-up calls yet. Leads appear here once a TM sets an appointment.";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Start Calling Session
          </DialogTitle>
          <DialogDescription>{queueDescription}</DialogDescription>
        </DialogHeader>

        {/* Targeting filters — cold pool only */}
        {usesColdPool && (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground">Lead set</span>
              <Select
                value={filters.scope}
                onValueChange={(v) => setFilters((f) => ({ ...f, scope: v as CallFilters["scope"] }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">
                    All workable leads ({eligiblePool.length})
                  </SelectItem>
                  <SelectItem value="MY_UPLOADS" className="text-xs">
                    Uploaded by me ({myUploadedCount})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 px-2 text-xs"
                onClick={() => setShowFilters((s) => !s)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 px-2 text-xs text-muted-foreground"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3">
                {/* Gender */}
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Gender</span>
                  <Select value={filters.gender} onValueChange={(v) => setFilters((f) => ({ ...f, gender: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs">Any</SelectItem>
                      {genderOptions.map((g) => (
                        <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Source */}
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Source</span>
                  <Select value={filters.source} onValueChange={(v) => setFilters((f) => ({ ...f, source: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs">Any</SelectItem>
                      {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{SOURCE_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Age range */}
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Age range</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Min"
                      value={filters.ageMin}
                      onChange={(e) => setFilters((f) => ({ ...f, ageMin: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Max"
                      value={filters.ageMax}
                      onChange={(e) => setFilters((f) => ({ ...f, ageMax: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Zipcode prefix */}
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Postal code starts with</span>
                  <Input
                    placeholder="e.g. 65"
                    value={filters.zipcode}
                    onChange={(e) => setFilters((f) => ({ ...f, zipcode: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Income range — only when present in data */}
                {incomeOptions.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Income</span>
                    <Select value={filters.income} onValueChange={(v) => setFilters((f) => ({ ...f, income: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="text-xs">Any</SelectItem>
                        {incomeOptions.map((v) => (
                          <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Residential status — only when present in data */}
                {residentialOptions.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Residential</span>
                    <Select value={filters.residential} onValueChange={(v) => setFilters((f) => ({ ...f, residential: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="text-xs">Any</SelectItem>
                        {residentialOptions.map((v) => (
                          <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {activeFilterCount > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {filteredPool.length} of {eligiblePool.length} leads match.
              </p>
            )}
          </div>
        )}

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
                      {l.callback_at && new Date(l.callback_at).getTime() <= Date.now()
                        ? "📞 callback due"
                        : currentUser && isMyUploadedLead(l, currentUser.id)
                        ? (
                            <span className="inline-flex items-center gap-1">
                              <Upload className="h-3 w-3" />
                              uploaded by me
                            </span>
                          )
                        : l.last_bounced_at && l.status === "NA"
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
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
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
