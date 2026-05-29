import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Phone, Calendar, User, Plus, ChevronRight,
  Trash2, Pencil, Check, X, BookOpen, TrendingUp, FileText,
} from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DealStageBadge, ActivityTypeBadge, ActivityResultBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { DealStage, DealProposal, DealProposalStatus, DealProposalLine } from "@/data/types";
import { SGA_FUNDS, getRiskCategory, RISK_CATEGORY_COLOR } from "@/data/sgaFunds";
import { nanoid } from "nanoid";

const DEAL_STAGES: DealStage[] = ["CALLING", "APPOINTMENT", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];
const STAGE_LABELS: Record<DealStage, string> = {
  CALLING: "Calling", APPOINTMENT: "Appointment", PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost",
};
const PROPOSAL_STATUS_LABELS: Record<DealProposalStatus, string> = {
  DRAFT: "Draft", PRESENTED: "Presented", ACCEPTED: "Accepted", REJECTED: "Rejected",
};
const PROPOSAL_STATUS_COLORS: Record<DealProposalStatus, string> = {
  DRAFT:     "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  PRESENTED: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  ACCEPTED:  "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  REJECTED:  "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

// ── Inline fund-allocation editor (mini portfolio builder) ───────────────────
function ProposalEditor({
  proposal,
  onSave,
  onCancel,
}: {
  proposal: Partial<DealProposal> & { deal_id: string };
  onSave: (p: Omit<DealProposal, "id" | "created_at" | "updated_at">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(proposal.name ?? "");
  const [status, setStatus] = useState<DealProposalStatus>(proposal.status ?? "DRAFT");
  const [totalValue, setTotalValue] = useState(String(proposal.total_value ?? ""));
  const [notes, setNotes] = useState(proposal.notes ?? "");
  const [lines, setLines] = useState<DealProposalLine[]>(proposal.lines ?? []);
  const [fundQuery, setFundQuery] = useState("");

  const totalAlloc = lines.reduce((s, l) => s + l.allocation_pct, 0);
  const allocOk = Math.abs(totalAlloc - 100) <= 0.01 || lines.length === 0;

  const fundResults = useMemo(() => {
    const q = fundQuery.trim().toLowerCase();
    if (!q) return SGA_FUNDS.slice(0, 8);
    return SGA_FUNDS.filter(
      (f) => f.name.toLowerCase().includes(q) || f.isin.toLowerCase().includes(q) || f.manager.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [fundQuery]);

  const addFund = (fund: (typeof SGA_FUNDS)[0]) => {
    if (lines.some((l) => l.fund_isin === fund.isin)) return;
    setLines((prev) => [
      ...prev,
      { id: `pl-${nanoid(4)}`, fund_isin: fund.isin, fund_name: fund.name, risk_rating: fund.riskRating, allocation_pct: 0 },
    ]);
    setFundQuery("");
  };

  const updateAlloc = (id: string, pct: number) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, allocation_pct: pct } : l)));

  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const distributeEvenly = () => {
    if (lines.length === 0) return;
    const each = parseFloat((100 / lines.length).toFixed(2));
    const rem = parseFloat((100 - each * lines.length).toFixed(2));
    setLines((prev) => prev.map((l, i) => ({ ...l, allocation_pct: i === 0 ? each + rem : each })));
  };

  const weightedRisk = useMemo(() => {
    const totalW = lines.reduce((s, l) => s + l.allocation_pct, 0);
    if (totalW === 0 || lines.length === 0) return null;
    return lines.reduce((s, l) => s + l.risk_rating * l.allocation_pct, 0) / totalW;
  }, [lines]);

  const handleSave = () => {
    if (!name) return;
    onSave({
      deal_id: proposal.deal_id,
      name,
      status,
      total_value: parseFloat(totalValue) || 0,
      notes: notes || undefined,
      lines,
      created_by: proposal.created_by ?? "",
    });
  };

  return (
    <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <Label>Plan Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Conservative Income Plan" />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as DealProposalStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PROPOSAL_STATUS_LABELS) as DealProposalStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{PROPOSAL_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Total Investment (SGD)</Label>
          <Input type="number" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} placeholder="e.g. 50000" />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Strategy notes, client preferences…" />
        </div>
      </div>

      {/* Fund search + allocation */}
      <div className="space-y-2">
        <Label>Fund Allocations</Label>
        <div className="relative">
          <Input
            value={fundQuery}
            onChange={(e) => setFundQuery(e.target.value)}
            placeholder="Search fund to add…"
            className="text-xs"
          />
          {fundQuery && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border rounded-md shadow-lg max-h-44 overflow-y-auto">
              {fundResults.map((f) => (
                <button
                  key={f.isin}
                  className="w-full text-left px-3 py-2 hover:bg-muted text-xs flex items-center justify-between gap-2"
                  onMouseDown={(e) => { e.preventDefault(); addFund(f); }}
                >
                  <span className="truncate">{f.name}</span>
                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${RISK_CATEGORY_COLOR[f.riskCategory]}`}>
                    {f.riskRating}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Fund</th>
                  <th className="text-center px-2 py-1.5 font-medium text-muted-foreground w-14">Risk</th>
                  <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-24">Alloc %</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l) => {
                  const fund = SGA_FUNDS.find((f) => f.isin === l.fund_isin);
                  const cat = fund ? fund.riskCategory : getRiskCategory(l.risk_rating);
                  return (
                    <tr key={l.id} className="hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-medium leading-snug">{l.fund_name}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`text-[10px] font-bold px-1 py-0.5 rounded border ${RISK_CATEGORY_COLOR[cat]}`}>{l.risk_rating}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number" min={0} max={100}
                            value={l.allocation_pct || ""}
                            onChange={(e) => updateAlloc(l.id, parseFloat(e.target.value) || 0)}
                            className="h-6 w-16 text-right text-xs px-1.5"
                          />
                          <span className="text-[10px] text-muted-foreground">%</span>
                        </div>
                      </td>
                      <td className="px-1">
                        <button onClick={() => removeLine(l.id)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-t text-xs">
              <div className="flex items-center gap-3">
                <button onClick={distributeEvenly} className="text-primary hover:underline">Distribute evenly</button>
                {weightedRisk !== null && (
                  <span className="text-muted-foreground">
                    Avg risk: <strong>{weightedRisk.toFixed(1)}</strong>
                  </span>
                )}
              </div>
              <span className={`font-medium tabular-nums ${allocOk ? "text-green-600" : "text-destructive"}`}>
                Total: {totalAlloc.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={!name}>
          <Check className="h-3.5 w-3.5 mr-1" /> Save Plan
        </Button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    deals, leads, contacts, users, activities,
    deal_proposals, moveDealStage, updateDeal,
    createDealProposal, updateDealProposal, deleteDealProposal,
  } = useCrmStore();
  const { currentUser } = useAuthStore();

  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [newStage, setNewStage] = useState<DealStage | "">("");
  const [stageNote, setStageNote] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [editingProposalId, setEditingProposalId] = useState<string | "new" | null>(null);

  const deal = deals.find((d) => d.id === id);
  if (!deal) return (
    <div className="p-6 text-muted-foreground">Deal not found. <Link to="/deals" className="text-primary underline">Back to Deals</Link></div>
  );

  const lead = leads.find((l) => l.id === deal.lead_id);
  const contact = contacts.find((c) => c.id === deal.contact_id);
  const adviser = users.find((u) => u.id === deal.assigned_to_id);
  const telemarketer = users.find((u) => u.id === deal.telemarketer_id);

  const dealActivities = useMemo(
    () =>
      activities
        .filter((a) => !a.deleted_at && (a.deal_id === id || a.lead_id === deal.lead_id))
        .sort((a, b) => (b.scheduled_at ?? b.created_at).localeCompare(a.scheduled_at ?? a.created_at)),
    [activities, id, deal.lead_id]
  );

  const callCount = dealActivities.filter((a) => a.type === "CALL").length;
  const meetings = dealActivities.filter((a) => a.type === "MEETING");
  const proposals = deal_proposals.filter((p) => p.deal_id === id);

  const stageIdx = DEAL_STAGES.indexOf(deal.stage);
  const personName = lead
    ? `${lead.salutation ? lead.salutation + " " : ""}${lead.first_name} ${lead.last_name}`
    : contact
    ? `${contact.first_name} ${contact.last_name}`
    : deal.title;

  const canEdit = can(currentUser, "ADVISER") || currentUser?.role === "MASTER";

  const handleMoveStage = () => {
    if (!newStage || !currentUser) return;
    moveDealStage(id!, newStage as DealStage, stageNote || undefined, currentUser.id, lostReason || undefined);
    setStageModalOpen(false);
    setNewStage(""); setStageNote(""); setLostReason("");
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5 shrink-0" onClick={() => navigate("/deals")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{personName}</h1>
            <DealStageBadge stage={deal.stage} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{deal.title}</p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setStageModalOpen(true)}>
            Move Stage <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>

      {/* Stage stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {DEAL_STAGES.map((s, i) => {
          const done = i < stageIdx;
          const active = i === stageIdx;
          const lost = s === "LOST";
          return (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <div className={`rounded-full px-3 py-1 text-[11px] font-medium border ${
                active
                  ? lost ? "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" : "border-primary bg-primary/10 text-primary"
                  : done
                  ? "border-green-400 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                  : "border-border text-muted-foreground"
              }`}>
                {STAGE_LABELS[s]}
              </div>
              {i < DEAL_STAGES.length - 1 && (
                <div className={`h-px w-4 ${i < stageIdx ? "bg-green-400" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Lead info + Activity timeline ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Deal / Lead info card */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deal Info</p>

            <div className="space-y-2 text-sm">
              {deal.value > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Value</span>
                  <span className="font-semibold">{formatCurrency(deal.value)}</span>
                </div>
              )}
              {lead && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{lead.phone ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source</span>
                    <span>{lead.source}</span>
                  </div>
                  {lead.income_range && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Income Range</span>
                      <span>{lead.income_range}</span>
                    </div>
                  )}
                  {lead.age && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Age</span>
                      <span>{lead.age}</span>
                    </div>
                  )}
                </>
              )}
              {adviser && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Adviser</span>
                  <span>{adviser.name}</span>
                </div>
              )}
              {telemarketer && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telemarketer</span>
                  <span>{telemarketer.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(deal.created_at)}</span>
              </div>
            </div>

            {lead && (
              <Link to={`/leads/${lead.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                <User className="h-3 w-3" />View Lead Profile
              </Link>
            )}
          </div>

          {/* Contact stats */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact History</p>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums">{callCount}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-center mt-0.5">
                  <Phone className="h-3 w-3" />Calls
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums">{meetings.length}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-center mt-0.5">
                  <Calendar className="h-3 w-3" />Meetings
                </p>
              </div>
            </div>
            {meetings.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium">Meeting dates</p>
                {meetings.map((m) => (
                  <p key={m.id} className="text-xs flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                    {formatDateTime(m.scheduled_at ?? m.created_at)}
                    {m.result && <ActivityResultBadge result={m.result} />}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Activity timeline */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2.5 bg-muted/50 border-b flex items-center justify-between">
              <span className="text-xs font-medium">Activity Log</span>
              <span className="text-[11px] text-muted-foreground">{dealActivities.length} entries</span>
            </div>
            {dealActivities.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No activities yet</p>
            ) : (
              <div className="divide-y max-h-64 overflow-y-auto">
                {dealActivities.map((a) => {
                  const by = users.find((u) => u.id === a.assigned_to_id || u.id === a.created_by);
                  return (
                    <div key={a.id} className="px-3 py-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <ActivityTypeBadge type={a.type} />
                        <span className="font-medium flex-1 truncate">{a.subject}</span>
                        {a.result && <ActivityResultBadge result={a.result} />}
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        {formatDateTime(a.scheduled_at ?? a.created_at)}
                        {by && ` · ${by.name.split(" ")[0]}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Proposals ── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Investment Proposals</h2>
              <p className="text-xs text-muted-foreground">Fund allocation plans for this deal</p>
            </div>
            {canEdit && editingProposalId === null && (
              <Button size="sm" className="gap-1.5" onClick={() => setEditingProposalId("new")}>
                <Plus className="h-3.5 w-3.5" />Add Plan
              </Button>
            )}
          </div>

          {/* New proposal form */}
          {editingProposalId === "new" && currentUser && (
            <ProposalEditor
              proposal={{ deal_id: id!, created_by: currentUser.id }}
              onSave={(data) => {
                createDealProposal({ ...data, created_by: currentUser.id }, currentUser.id);
                setEditingProposalId(null);
              }}
              onCancel={() => setEditingProposalId(null)}
            />
          )}

          {proposals.length === 0 && editingProposalId !== "new" && (
            <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground space-y-2">
              <FileText className="h-8 w-8 mx-auto opacity-30" />
              <p className="text-sm">No proposals yet</p>
              {canEdit && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditingProposalId("new")}>
                  <Plus className="h-3.5 w-3.5" />Create First Proposal
                </Button>
              )}
            </div>
          )}

          {/* Proposal cards */}
          {proposals.map((p) => {
            const totalAlloc = p.lines.reduce((s, l) => s + l.allocation_pct, 0);
            const weightedRisk = p.lines.length > 0 && totalAlloc > 0
              ? p.lines.reduce((s, l) => s + l.risk_rating * l.allocation_pct, 0) / totalAlloc
              : null;

            if (editingProposalId === p.id && currentUser) {
              return (
                <ProposalEditor
                  key={p.id}
                  proposal={p}
                  onSave={(data) => {
                    updateDealProposal(p.id, data, currentUser.id);
                    setEditingProposalId(null);
                  }}
                  onCancel={() => setEditingProposalId(null)}
                />
              );
            }

            return (
              <div key={p.id} className="rounded-lg border overflow-hidden">
                {/* Proposal header */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm truncate">{p.name}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${PROPOSAL_STATUS_COLORS[p.status]}`}>
                      {PROPOSAL_STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingProposalId(p.id)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => currentUser && deleteDealProposal(p.id, currentUser.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-b text-xs text-muted-foreground">
                  {p.total_value > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />{formatCurrency(p.total_value)}
                    </span>
                  )}
                  {weightedRisk !== null && (
                    <span>
                      Avg risk: <strong className="text-foreground">{weightedRisk.toFixed(1)}</strong>
                      {" "}({p.lines.length > 0 ? getRiskCategory(weightedRisk) : ""})
                    </span>
                  )}
                  {p.notes && <span className="italic truncate max-w-xs">{p.notes}</span>}
                </div>

                {/* Fund lines */}
                {p.lines.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/20">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Fund</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground w-14">Risk</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground w-20">Alloc</th>
                        {p.total_value > 0 && (
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground w-28">Amount</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {p.lines.map((l) => {
                        const fund = SGA_FUNDS.find((f) => f.isin === l.fund_isin);
                        const cat = fund ? fund.riskCategory : getRiskCategory(l.risk_rating);
                        return (
                          <tr key={l.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2.5">
                              <p className="font-medium leading-snug">{l.fund_name}</p>
                              {fund?.dividendYield != null && (
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  Dividend {fund.dividendYield.toFixed(2)}% {fund.dividendFrequency}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RISK_CATEGORY_COLOR[cat]}`}>
                                {l.risk_rating}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                              {l.allocation_pct.toFixed(1)}%
                            </td>
                            {p.total_value > 0 && (
                              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                                {formatCurrency(p.total_value * l.allocation_pct / 100)}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    {p.total_value > 0 && (
                      <tfoot className="bg-muted/30">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-xs font-medium text-right text-muted-foreground">Total</td>
                          <td className="px-4 py-2 text-right text-xs font-bold">{formatCurrency(p.total_value)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No funds added yet</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Move stage dialog */}
      <Dialog open={stageModalOpen} onOpenChange={setStageModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>New Stage</Label>
              <Select value={newStage} onValueChange={(v) => setNewStage(v as DealStage)}>
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.filter((s) => s !== deal.stage).map((s) => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newStage === "LOST" && (
              <div className="space-y-1.5">
                <Label>Lost Reason</Label>
                <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Why was this deal lost?" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea value={stageNote} onChange={(e) => setStageNote(e.target.value)} rows={2} placeholder="Add a note about this stage change…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageModalOpen(false)}>Cancel</Button>
            <Button onClick={handleMoveStage} disabled={!newStage}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
