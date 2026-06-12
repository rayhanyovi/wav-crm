import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Phone, Calendar, User, Plus, ChevronRight,
  Trash2, Pencil, Check, X, BookOpen, TrendingUp, FileText, LogOut, ClipboardList,
} from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useUsers } from "@/hooks/useUsers";
import { useLeads } from "@/hooks/useLeads";
import { useContact } from "@/hooks/useContacts";
import { useActivities, useCreateActivity } from "@/hooks/useActivities";
import { toast } from "@/store/useToastStore";
import {
  useCreateDealProposal,
  useDeal,
  useDealProposals,
  useMoveDealStage,
  useReleaseDeal,
  useUpdateDeal,
  useUpdateDealProposal,
  useDeleteDealProposal,
} from "@/hooks/useDeals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { DealStage, DealProposal, DealProposalStatus, DealProposalLine, FinancialGoal, RiskTolerance, InvestmentHorizon } from "@/data/types";
import { SGA_FUNDS, getRiskCategory, RISK_CATEGORY_COLOR } from "@/data/sgaFunds";
import { nanoid } from "nanoid";

const DEAL_STAGES: DealStage[] = ["CALLING", "APPOINTMENT", "PROPOSAL", "SUBMITTED", "WON", "LOST"];
const STAGE_LABELS: Record<DealStage, string> = {
  CALLING: "Calling", APPOINTMENT: "Appointment", PROPOSAL: "Proposal",
  SUBMITTED: "Submitted", WON: "Won", LOST: "Lost",
};

const GOAL_LABELS: Record<FinancialGoal, string> = {
  RETIREMENT: "Retirement", EDUCATION: "Education Fund", WEALTH_GROWTH: "Wealth Growth",
  INCOME: "Passive Income", EMERGENCY_FUND: "Emergency Fund", OTHER: "Other",
};
const TOLERANCE_LABELS: Record<RiskTolerance, string> = {
  CONSERVATIVE: "Conservative", MODERATE: "Moderate", BALANCED: "Balanced",
  GROWTH: "Growth", AGGRESSIVE: "Aggressive",
};
const HORIZON_LABELS: Record<InvestmentHorizon, string> = {
  SHORT: "Short-term (< 3 yrs)", MEDIUM: "Medium-term (3–7 yrs)", LONG: "Long-term (7+ yrs)",
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
  const { data: leads = [] } = useLeads({ includeAbandoned: true });
  const { currentUser } = useAuthStore();
  const { data: activities = [] } = useActivities();
  const { data: users = [] } = useUsers();
  const { data: deal, isLoading: dealLoading, error: dealError } = useDeal(id);
  const { data: contact } = useContact(deal?.contact_id);
  const { data: proposals = [], isLoading: proposalsLoading, error: proposalsError } = useDealProposals(id);
  const moveDealStageMutation = useMoveDealStage();
  const updateDealMutation = useUpdateDeal();
  const releaseDealMutation = useReleaseDeal();
  const createDealProposalMutation = useCreateDealProposal();
  const updateDealProposalMutation = useUpdateDealProposal();
  const deleteDealProposalMutation = useDeleteDealProposal();
  const createActivityMutation = useCreateActivity();

  const [comment, setComment] = useState("");

  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [newStage, setNewStage] = useState<DealStage | "">("");
  const [stageNote, setStageNote] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [stageInsurer, setStageInsurer] = useState("");
  const [stageInsurerRef, setStageInsurerRef] = useState("");
  const [stagePolicyNumber, setStagePolicyNumber] = useState("");
  const [stageAssignAdviser, setStageAssignAdviser] = useState("");
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseMode, setReleaseMode] = useState<"pool" | "transfer">("pool");
  const [transferTarget, setTransferTarget] = useState("");
  const [editingProposalId, setEditingProposalId] = useState<string | "new" | null>(null);
  const [editingFactFind, setEditingFactFind] = useState(false);
  const [factFindForm, setFactFindForm] = useState({
    financial_goal: "" as FinancialGoal | "",
    risk_tolerance: "" as RiskTolerance | "",
    investment_horizon: "" as InvestmentHorizon | "",
    monthly_investable: "",
    investable_period: "monthly" as "monthly" | "annually",
    existing_investments: "",
    fact_find_notes: "",
  });

  if (dealLoading || proposalsLoading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-56" />
            <Skeleton className="h-40" />
            <Skeleton className="h-72" />
          </div>
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!deal || dealError || proposalsError) {
    return (
      <div className="p-6 text-sm text-destructive">
        {dealError?.message || proposalsError?.message || "Deal not found."}{" "}
        <Link to="/deals" className="text-primary underline">Back to Deals</Link>
      </div>
    );
  }

  const lead = leads.find((l) => l.id === deal.lead_id);
  const adviser = users.find((u) => u.id === deal.assigned_to_id);
  const telemarketer = users.find((u) => u.id === deal.telemarketer_id);

  const dealActivities = useMemo(
    () =>
      activities
        .filter((a) => a.deal_id === id || a.lead_id === deal.lead_id)
        .sort((a, b) => (b.scheduled_at ?? b.created_at).localeCompare(a.scheduled_at ?? a.created_at)),
    [activities, id, deal.lead_id]
  );

  const callCount = dealActivities.filter((a) => a.type === "CALL").length;
  const meetings = dealActivities.filter((a) => a.type === "MEETING");
  const stageIdx = DEAL_STAGES.indexOf(deal.stage);
  const personName = lead
    ? `${lead.salutation ? lead.salutation + " " : ""}${lead.first_name} ${lead.last_name}`
    : contact
    ? `${contact.first_name} ${contact.last_name}`
    : deal.title;

  const canEdit = can(currentUser, "ADVISER") || currentUser?.role === "MASTER";
  const advisers = users.filter((u) => u.is_active && can(u, "ADVISER") && !can(u, "MASTER"));

  const handleMoveStage = async () => {
    if (!newStage || !currentUser) return;
    const extras: Record<string, unknown> = {};
    if (newStage === "SUBMITTED") {
      if (stageInsurer) extras.insurer = stageInsurer;
      if (stageInsurerRef) extras.insurer_ref = stageInsurerRef;
    }
    if (newStage === "WON" && stagePolicyNumber) extras.policy_number = stagePolicyNumber;
    if (newStage === "APPOINTMENT" && stageAssignAdviser && !deal.assigned_to_id) {
      extras.assigned_to_id = stageAssignAdviser;
    }
    if (Object.keys(extras).length > 0) {
      await updateDealMutation.mutateAsync({
        id: id!,
        payload: extras,
      });
    }
    await moveDealStageMutation.mutateAsync({
      dealId: id!,
      toStage: newStage as DealStage,
      note: stageNote || undefined,
      userId: currentUser.id,
      lostReason: lostReason || undefined,
    });
    setStageModalOpen(false);
    setNewStage(""); setStageNote(""); setLostReason("");
    setStageInsurer(""); setStageInsurerRef(""); setStagePolicyNumber(""); setStageAssignAdviser("");
  };

  const openFactFind = () => {
    setFactFindForm({
      financial_goal: deal.financial_goal ?? "",
      risk_tolerance: deal.risk_tolerance ?? "",
      investment_horizon: deal.investment_horizon ?? "",
      monthly_investable: deal.monthly_investable != null ? String(deal.monthly_investable) : "",
      investable_period: "monthly",
      existing_investments: deal.existing_investments ?? "",
      fact_find_notes: deal.fact_find_notes ?? "",
    });
    setEditingFactFind(true);
  };

  const handleRelease = async () => {
    if (!currentUser) return;
    await releaseDealMutation.mutateAsync({
      dealId: id!,
      releaserId: currentUser.id,
      transferToId: releaseMode === "transfer" ? transferTarget || undefined : undefined,
    });
    setReleaseOpen(false);
    setTransferTarget("");
    navigate("/deals");
  };

  const handleSaveFactFind = async () => {
    if (!currentUser) return;
    await updateDealMutation.mutateAsync({
      id: id!,
      payload: {
        financial_goal: factFindForm.financial_goal || undefined,
        risk_tolerance: factFindForm.risk_tolerance || undefined,
        investment_horizon: factFindForm.investment_horizon || undefined,
        monthly_investable: factFindForm.monthly_investable
          ? factFindForm.investable_period === "annually"
            ? parseFloat(factFindForm.monthly_investable) / 12
            : parseFloat(factFindForm.monthly_investable)
          : undefined,
        existing_investments: factFindForm.existing_investments || undefined,
        fact_find_notes: factFindForm.fact_find_notes || undefined,
        fact_find_done: !!(factFindForm.financial_goal && factFindForm.risk_tolerance && factFindForm.investment_horizon),
      },
    });
    setEditingFactFind(false);
  };

  const handlePostComment = () => {
    const text = comment.trim();
    if (!text || !currentUser) return;
    setComment("");
    createActivityMutation.mutate(
      {
        type:         "NOTE",
        subject:      text,
        result:       "COMPLETED",
        deal_id:      id!,
        lead_id:      deal.lead_id ?? undefined,
        created_by:   currentUser.id,
        completed_at: new Date().toISOString(),
        metadata:     { comment: true },
      },
      {
        onError: (err) =>
          toast.error(`Couldn't post comment: ${err instanceof Error ? err.message : "unknown error"}`),
      },
    );
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
        <div className="flex gap-2 shrink-0">
          {/* Release / Transfer — only the assigned adviser (or master) can do this */}
          {canEdit && deal.assigned_to_id && (
            deal.assigned_to_id === currentUser?.id || currentUser?.role === "MASTER"
          ) && deal.stage !== "WON" && deal.stage !== "LOST" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground gap-1 hover:text-destructive"
              onClick={() => setReleaseOpen(true)}
            >
              <LogOut className="h-3.5 w-3.5" />
              Release
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setStageModalOpen(true)}>
              Move Stage <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>
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
              {deal.insurer && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Insurer</span>
                  <span>{deal.insurer}</span>
                </div>
              )}
              {deal.insurer_ref && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submission Ref</span>
                  <span className="font-mono text-xs">{deal.insurer_ref}</span>
                </div>
              )}
              {deal.policy_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Policy No.</span>
                  <span className="font-mono text-xs font-semibold">{deal.policy_number}</span>
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

          {/* ── Fact Find ── */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2.5 bg-muted/50 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Client Fact Find</span>
                {deal.fact_find_done && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 font-medium">Complete</span>
                )}
              </div>
              {canEdit && !editingFactFind && (
                deal.fact_find_done ? (
                  <button onClick={openFactFind} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <Pencil className="h-3 w-3" />Edit
                  </button>
                ) : (
                  <Button size="sm" onClick={openFactFind} className="h-7 text-xs gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" />Fill In Fact Find
                  </Button>
                )
              )}
            </div>

            {editingFactFind ? (
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-[11px] text-muted-foreground font-medium">Financial Goal</label>
                    <Select value={factFindForm.financial_goal} onValueChange={(v) => setFactFindForm((f) => ({ ...f, financial_goal: v as FinancialGoal }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select goal" /></SelectTrigger>
                      <SelectContent>{(Object.keys(GOAL_LABELS) as FinancialGoal[]).map((g) => <SelectItem key={g} value={g}>{GOAL_LABELS[g]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground font-medium">Risk Tolerance</label>
                    <Select value={factFindForm.risk_tolerance} onValueChange={(v) => setFactFindForm((f) => ({ ...f, risk_tolerance: v as RiskTolerance }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select risk" /></SelectTrigger>
                      <SelectContent>{(Object.keys(TOLERANCE_LABELS) as RiskTolerance[]).map((r) => <SelectItem key={r} value={r}>{TOLERANCE_LABELS[r]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground font-medium">Investment Horizon</label>
                    <Select value={factFindForm.investment_horizon} onValueChange={(v) => setFactFindForm((f) => ({ ...f, investment_horizon: v as InvestmentHorizon }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select horizon" /></SelectTrigger>
                      <SelectContent>{(Object.keys(HORIZON_LABELS) as InvestmentHorizon[]).map((h) => <SelectItem key={h} value={h}>{HORIZON_LABELS[h]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground font-medium">Investable Amount (SGD)</label>
                    <div className="flex gap-1.5">
                      <Input type="number" className="h-7 text-xs flex-1" value={factFindForm.monthly_investable} onChange={(e) => setFactFindForm((f) => ({ ...f, monthly_investable: e.target.value }))} placeholder="e.g. 1000" />
                      <div className="flex rounded-md border overflow-hidden text-[11px] shrink-0">
                        {(["monthly", "annually"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setFactFindForm((f) => ({ ...f, investable_period: p }))}
                            className={[
                              "px-2 h-7 capitalize transition-colors",
                              factFindForm.investable_period === p
                                ? "bg-primary text-primary-foreground font-medium"
                                : "bg-background text-muted-foreground hover:bg-muted",
                            ].join(" ")}
                          >
                            {p === "monthly" ? "/ mo" : "/ yr"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {factFindForm.monthly_investable && factFindForm.investable_period === "annually" && (
                      <p className="text-[10px] text-muted-foreground">
                        = SGD {(parseFloat(factFindForm.monthly_investable) / 12).toFixed(0)} / month (stored as monthly)
                      </p>
                    )}
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[11px] text-muted-foreground font-medium">Existing Investments</label>
                    <Input className="h-7 text-xs" value={factFindForm.existing_investments} onChange={(e) => setFactFindForm((f) => ({ ...f, existing_investments: e.target.value }))} placeholder="e.g. CPF, some unit trusts, endowment plan" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[11px] text-muted-foreground font-medium">Notes from Fact Find</label>
                    <Textarea rows={2} className="text-xs" value={factFindForm.fact_find_notes} onChange={(e) => setFactFindForm((f) => ({ ...f, fact_find_notes: e.target.value }))} placeholder="Client concerns, preferences, anything notable from the meeting…" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingFactFind(false)}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={() => void handleSaveFactFind()}><Check className="h-3 w-3 mr-1" />Save</Button>
                </div>
              </div>
            ) : deal.financial_goal ? (
              <div className="p-3 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div><span className="text-muted-foreground">Goal: </span><span className="font-medium">{GOAL_LABELS[deal.financial_goal]}</span></div>
                  {deal.risk_tolerance && <div><span className="text-muted-foreground">Risk: </span><span className="font-medium">{TOLERANCE_LABELS[deal.risk_tolerance]}</span></div>}
                  {deal.investment_horizon && <div><span className="text-muted-foreground">Horizon: </span><span className="font-medium">{HORIZON_LABELS[deal.investment_horizon]}</span></div>}
                  {deal.monthly_investable && <div><span className="text-muted-foreground">Investable: </span><span className="font-medium">{formatCurrency(deal.monthly_investable)}<span className="text-muted-foreground font-normal"> / mo</span></span></div>}
                  {deal.existing_investments && <div className="col-span-2"><span className="text-muted-foreground">Existing: </span><span>{deal.existing_investments}</span></div>}
                </div>
                {deal.fact_find_notes && <p className="text-muted-foreground italic border-t pt-2 mt-1">{deal.fact_find_notes}</p>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                {canEdit ? "No fact find yet — fill in after first meeting with client." : "Fact find not completed yet."}
              </p>
            )}
          </div>

          {/* Comments & activity timeline */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2.5 bg-muted/50 border-b flex items-center justify-between">
              <span className="text-xs font-medium">Comments & Activity</span>
              <span className="text-[11px] text-muted-foreground">{dealActivities.length} entries</span>
            </div>

            {/* Comment composer — notes from calls, meetings & status changes all land here */}
            {canEdit && (
              <div className="flex items-start gap-2 border-b p-3">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment about this deal…"
                  rows={2}
                  className="text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={handlePostComment}
                  disabled={!comment.trim() || createActivityMutation.isPending}
                >
                  Post
                </Button>
              </div>
            )}

            {dealActivities.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No comments or activity yet</p>
            ) : (
              <div className="divide-y max-h-80 overflow-y-auto">
                {dealActivities.map((a) => {
                  const by = users.find((u) => u.id === a.assigned_to_id || u.id === a.created_by);
                  const isComment = !!a.metadata?.comment;
                  return (
                    <div key={a.id} className="px-3 py-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <ActivityTypeBadge type={a.type} />
                        <span className="font-medium flex-1 truncate">{a.subject}</span>
                        {a.result && !isComment && <ActivityResultBadge result={a.result} />}
                      </div>
                      {a.description && (
                        <p className="text-foreground/80 mt-1 whitespace-pre-wrap">{a.description}</p>
                      )}
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
                createDealProposalMutation.mutate({ ...data, created_by: currentUser.id });
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
                    updateDealProposalMutation.mutate({ id: p.id, payload: data, dealId: p.deal_id });
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
                          onClick={() => deleteDealProposalMutation.mutate({ id: p.id, dealId: p.deal_id })}
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

            {/* Adviser assignment — shown when moving to APPOINTMENT and no adviser yet */}
            {newStage === "APPOINTMENT" && !deal.assigned_to_id && (
              <div className="space-y-1.5">
                <Label>Assign Adviser <span className="text-muted-foreground font-normal">(recommended)</span></Label>
                <Select value={stageAssignAdviser || "none"} onValueChange={(v) => setStageAssignAdviser(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select adviser" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Skip for now —</SelectItem>
                    {advisers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Insurer details — shown when moving to SUBMITTED */}
            {newStage === "SUBMITTED" && (
              <>
                <div className="space-y-1.5">
                  <Label>Insurer <span className="text-muted-foreground font-normal">(e.g. Singlife, AIA, Prudential)</span></Label>
                  <Input value={stageInsurer} onChange={(e) => setStageInsurer(e.target.value)} placeholder="Insurer name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Submission Reference <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input value={stageInsurerRef} onChange={(e) => setStageInsurerRef(e.target.value)} placeholder="Reference / case number" />
                </div>
              </>
            )}

            {/* Policy number — shown when moving to WON */}
            {newStage === "WON" && (
              <div className="space-y-1.5">
                <Label>Policy Number <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={stagePolicyNumber} onChange={(e) => setStagePolicyNumber(e.target.value)} placeholder="e.g. SLF-20260001" />
              </div>
            )}

            {newStage === "LOST" && (
              <div className="space-y-1.5">
                <Label>Lost Reason</Label>
                <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Why was this deal lost?" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={stageNote} onChange={(e) => setStageNote(e.target.value)} rows={2} placeholder="Add a note about this stage change…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageModalOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleMoveStage()} disabled={!newStage}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release / Transfer dialog */}
      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              Release Deal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Release <strong>{deal.title}</strong> from your active pipeline. You'll earn{" "}
              <strong>+1 credit</strong> for returning a warm prospect.
            </p>

            {/* Release mode selector */}
            <div className="grid grid-cols-2 gap-2">
              {(["pool", "transfer"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setReleaseMode(mode)}
                  className={`rounded-lg border p-3 text-left text-sm font-medium transition-colors ${
                    releaseMode === mode
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <span className="block text-base mb-0.5">
                    {mode === "pool" ? "🔙 Return to Pool" : "🔄 Transfer"}
                  </span>
                  <span className="block text-xs text-muted-foreground font-normal">
                    {mode === "pool"
                      ? "Master can reassign to any adviser"
                      : "Pass directly to another adviser"}
                  </span>
                </button>
              ))}
            </div>

            {/* Transfer target */}
            {releaseMode === "transfer" && (
              <div className="space-y-1.5">
                <Label>Transfer to Adviser *</Label>
                <Select value={transferTarget || "none"} onValueChange={(v) => setTransferTarget(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select adviser" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select adviser —</SelectItem>
                    {advisers
                      .filter((u) => u.id !== currentUser?.id)
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2.5 text-xs text-amber-700 dark:text-amber-400">
              ⚠️ This action removes this deal from your pipeline immediately.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => void handleRelease()}
              disabled={releaseMode === "transfer" && !transferTarget}
            >
              Release Deal (+1 credit)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
