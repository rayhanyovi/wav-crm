import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Phone, Calendar, TrendingUp, UserPlus } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { isAdviser as isAdviserRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DealStageBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Deal, DealStage } from "@/data/types";

// Stages visible to each role
const ALL_STAGES: DealStage[] = ["CALLING", "APPOINTMENT", "PROPOSAL", "SUBMITTED", "WON", "LOST"];
const ADVISER_STAGES: DealStage[] = ["APPOINTMENT", "PROPOSAL", "SUBMITTED", "WON", "LOST"];

const STAGE_LABELS: Record<DealStage, string> = {
  CALLING:     "Calling",
  APPOINTMENT: "Appointment",
  PROPOSAL:    "Proposal",
  SUBMITTED:   "Submitted",
  WON:         "Won",
  LOST:        "Lost",
};

const STAGE_DESC: Record<DealStage, string> = {
  CALLING:     "Telemarketer is cold-calling",
  APPOINTMENT: "Appointment set — adviser steps in",
  PROPOSAL:    "Fund proposal(s) being presented",
  SUBMITTED:   "Application submitted to insurer",
  WON:         "Closed & invested",
  LOST:        "Did not proceed",
};

export function DealsPage() {
  const { deals, leads, contacts, users, activities, createDeal, updateDeal } = useCrmStore();
  const { currentUser } = useAuthStore();

  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState<DealStage | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    value: "",
    lead_id: "",
    assigned_to_id: "",
    stage: "CALLING" as DealStage,
  });

  const isAdviser = currentUser?.role === "ADVISER";
  const isTelemarketer = currentUser?.role === "TELEMARKETER";

  const visibleDeals = useMemo(() => {
    return deals.filter((d) => {
      if (d.deleted_at) return false;
      // MASTER: sees all deals including unassigned (released) ones
      if (!isAdviser && !isTelemarketer) return true;
      // ADVISER: sees APPOINTMENT+ deals assigned to them, plus unassigned released deals (to claim)
      if (isAdviser) {
        if (!ADVISER_STAGES.includes(d.stage)) return false;
        // Show own deals + unassigned deals in APPOINTMENT+ that they can pick up
        if (d.assigned_to_id && d.assigned_to_id !== currentUser?.id) return false;
      }
      // TELEMARKETER: only their deals (Deals page is ADVISER+ so TM can't reach this)
      if (isTelemarketer) {
        if (d.telemarketer_id && d.telemarketer_id !== currentUser?.id) return false;
        if (!d.telemarketer_id && d.created_by !== currentUser?.id) return false;
      }
      return true;
    });
  }, [deals, currentUser, isAdviser, isTelemarketer]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return visibleDeals.filter((d) => {
      if (filterStage !== "ALL" && d.stage !== filterStage) return false;
      if (!q) return true;
      const lead = leads.find((l) => l.id === d.lead_id);
      const contact = contacts.find((c) => c.id === d.contact_id);
      return (
        d.title.toLowerCase().includes(q) ||
        lead?.first_name?.toLowerCase().includes(q) ||
        lead?.last_name?.toLowerCase().includes(q) ||
        contact?.first_name?.toLowerCase().includes(q) ||
        contact?.last_name?.toLowerCase().includes(q)
      );
    });
  }, [visibleDeals, filterStage, search, leads, contacts]);

  // Stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    visibleDeals.forEach((d) => {
      counts[d.stage] = (counts[d.stage] || 0) + 1;
    });
    return counts;
  }, [visibleDeals]);

  // Activity stats per deal
  const dealStats = useMemo(() => {
    const stats: Record<string, { calls: number; meetings: number; lastActivity?: string }> = {};
    activities
      .filter((a) => !a.deleted_at && a.deal_id)
      .forEach((a) => {
        if (!stats[a.deal_id!]) stats[a.deal_id!] = { calls: 0, meetings: 0 };
        if (a.type === "CALL") stats[a.deal_id!].calls++;
        if (a.type === "MEETING") stats[a.deal_id!].meetings++;
        if (
          !stats[a.deal_id!].lastActivity ||
          a.created_at > stats[a.deal_id!].lastActivity!
        ) {
          stats[a.deal_id!].lastActivity = a.created_at;
        }
      });
    return stats;
  }, [activities]);

  const availableStages = currentUser?.role === "TELEMARKETER" ? ALL_STAGES : ADVISER_STAGES;

  const handleCreate = () => {
    if (!currentUser || !form.title) return;
    const lead = leads.find((l) => l.id === form.lead_id);
    createDeal(
      {
        title: form.title,
        value: parseFloat(form.value) || 0,
        stage: form.stage,
        lead_id: form.lead_id || undefined,
        contact_id: lead?.converted_contact_id || contacts[0]?.id || "",
        telemarketer_id: isTelemarketer ? currentUser.id : undefined,
        assigned_to_id: form.assigned_to_id || undefined,
        created_by: currentUser.id,
        lost_reason: undefined,
        closed_at: undefined,
      },
      currentUser.id
    );
    setCreateOpen(false);
    setForm({ title: "", value: "", lead_id: "", assigned_to_id: "", stage: "CALLING" });
  };

  const advisers = users.filter((u) => u.is_active && can(u, "ADVISER"));
  const unlinkedLeads = leads.filter(
    (l) => !l.deleted_at && !deals.some((d) => d.lead_id === l.id)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Deals</h1>
          <p className="text-sm text-muted-foreground">
            {isAdviser
              ? "Investment deals assigned to you — from appointment onwards."
              : "All deals in the pipeline from first cold call to close."}
          </p>
        </div>
        {can(currentUser, "TELEMARKETER") && (
          <Button size="sm" className="gap-2 shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Deal
          </Button>
        )}
      </div>

      {/* Stage strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {availableStages.map((stage) => (
          <button
            key={stage}
            onClick={() => setFilterStage(filterStage === stage ? "ALL" : stage)}
            className={`rounded-lg border p-2.5 text-left transition-colors ${
              filterStage === stage
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/60"
            }`}
          >
            <p className="text-lg font-bold tabular-nums">{stageCounts[stage] ?? 0}</p>
            <p className="text-[10px] font-medium text-muted-foreground mt-0.5">{STAGE_LABELS[stage]}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals or leads…"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={filterStage} onValueChange={(v) => setFilterStage(v as DealStage | "ALL")}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All stages</SelectItem>
            {availableStages.map((s) => (
              <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterStage !== "ALL" || search) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => { setFilterStage("ALL"); setSearch(""); }}>
            Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} deal{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Deal list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No deals yet"
          description={search ? "No deals match your search." : "Create a deal from a lead to get started."}
        />
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {filtered.map((deal) => {
            const lead = leads.find((l) => l.id === deal.lead_id);
            const contact = contacts.find((c) => c.id === deal.contact_id);
            const adviser = users.find((u) => u.id === deal.assigned_to_id);
            const telemarketer = users.find((u) => u.id === deal.telemarketer_id);
            const stats = dealStats[deal.id] || { calls: 0, meetings: 0 };
            const person = lead
              ? `${lead.salutation ? lead.salutation + " " : ""}${lead.first_name} ${lead.last_name}`
              : contact
              ? `${contact.first_name} ${contact.last_name}`
              : deal.title;
            const isReleased = !deal.assigned_to_id && ADVISER_STAGES.includes(deal.stage);

            return (
              <div key={deal.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isReleased ? "bg-amber-50/50 dark:bg-amber-950/10" : "hover:bg-muted/40"}`}>
                <Link
                  to={`/deals/${deal.id}`}
                  className="flex flex-1 items-center gap-4 min-w-0"
                >
                  {/* Name + stage */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{person}</p>
                      <DealStageBadge stage={deal.stage} />
                      {isReleased && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                          Released — available
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{deal.title}</p>
                  </div>

                  {/* Activity stats */}
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />{stats.calls} call{stats.calls !== 1 ? "s" : ""}
                    </span>
                    {stats.meetings > 0 && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />{stats.meetings} meeting{stats.meetings !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Value + people */}
                  <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0 text-xs">
                    {deal.value > 0 && (
                      <span className="font-semibold text-sm tabular-nums">
                        {formatCurrency(deal.value)}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {adviser
                        ? `Adviser: ${adviser.name.split(" ")[0]}`
                        : telemarketer
                        ? `TM: ${telemarketer.name.split(" ")[0]}`
                        : <span className="text-amber-600 dark:text-amber-400 font-medium">Unassigned</span>}
                    </span>
                  </div>
                </Link>

                {/* Claim released deal (adviser only) */}
                {isReleased && isAdviserRole(currentUser) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1 text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentUser) updateDeal(deal.id, { assigned_to_id: currentUser.id }, currentUser.id);
                    }}
                  >
                    <UserPlus className="h-3 w-3" /> Claim
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Deal dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. John Tan – Investment Portfolio"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Link to Lead (optional)</Label>
              <Select value={form.lead_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, lead_id: v === "none" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No linked lead —</SelectItem>
                  {unlinkedLeads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.first_name} {l.last_name} ({l.phone ?? "no phone"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v as DealStage }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Est. Value (SGD)</Label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            {can(currentUser, "MASTER") && (
              <div className="space-y-1.5">
                <Label>Assign Adviser</Label>
                <Select value={form.assigned_to_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, assigned_to_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select adviser" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Unassigned —</SelectItem>
                    {advisers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.title}>Create Deal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
