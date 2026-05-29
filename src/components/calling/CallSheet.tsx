import {
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  History,
  Phone,
  PhoneOff,
  User,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { useCrmStore } from "@/store/useCrmStore";
import { LeadStatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Lead, FinancialGoal, RiskTolerance, InvestmentHorizon } from "@/data/types";
import { getLeadActivities } from "@/lib/selectors";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";

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

interface CallSheetProps {
  lead: Lead | undefined;
}

export function CallSheet({ lead }: CallSheetProps) {
  const { startCall, endCall, liveNotes, setLiveNotes, phase } =
    useCallSessionStore();
  const { activities, contacts, deals, updateDeal } = useCrmStore();
  const { currentUser } = useAuthStore();
  const [editingFF, setEditingFF] = useState(false);
  const [ffForm, setFfForm] = useState({
    financial_goal: "" as FinancialGoal | "",
    risk_tolerance: "" as RiskTolerance | "",
    investment_horizon: "" as InvestmentHorizon | "",
    monthly_investable: "",
    existing_investments: "",
    fact_find_notes: "",
  });

  if (!lead)
    return <div className="p-6 text-muted-foreground">No lead selected.</div>;

  const leadActivities = getLeadActivities(lead.id, activities).slice(0, 3);
  const convertedContact = lead.converted_contact_id
    ? contacts.find((contact) => contact.id === lead.converted_contact_id)
    : undefined;
  const relatedDeals = deals
    .filter(
      (deal) =>
        !deal.deleted_at &&
        (deal.lead_id === lead.id || deal.contact_id === convertedContact?.id),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );

  // Latest active deal for fact-find
  const activeDeal = relatedDeals[0];

  const openFF = () => {
    setFfForm({
      financial_goal: activeDeal?.financial_goal ?? "",
      risk_tolerance: activeDeal?.risk_tolerance ?? "",
      investment_horizon: activeDeal?.investment_horizon ?? "",
      monthly_investable: activeDeal?.monthly_investable != null ? String(activeDeal.monthly_investable) : "",
      existing_investments: activeDeal?.existing_investments ?? "",
      fact_find_notes: activeDeal?.fact_find_notes ?? "",
    });
    setEditingFF(true);
  };

  const saveFF = () => {
    if (!activeDeal || !currentUser) return;
    updateDeal(activeDeal.id, {
      financial_goal: ffForm.financial_goal || undefined,
      risk_tolerance: ffForm.risk_tolerance || undefined,
      investment_horizon: ffForm.investment_horizon || undefined,
      monthly_investable: ffForm.monthly_investable ? parseFloat(ffForm.monthly_investable) : undefined,
      existing_investments: ffForm.existing_investments || undefined,
      fact_find_notes: ffForm.fact_find_notes || undefined,
      fact_find_done: !!(ffForm.financial_goal && ffForm.risk_tolerance && ffForm.investment_horizon),
    }, currentUser.id);
    setEditingFF(false);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Lead info */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0">
          {lead.first_name[0]}
          {lead.last_name[0]}
        </div>
        <div>
          <Link
            to={`/leads/${lead.id}`}
            className="font-semibold text-lg text-primary hover:underline"
          >
            {lead.first_name} {lead.last_name}
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            <LeadStatusBadge status={lead.status} />
            <span className="text-xs text-muted-foreground">{lead.source}</span>
          </div>
        </div>
      </div>

      {/* Contact details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="font-mono">{lead.phone || "..."}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-3.5 w-3.5 shrink-0" />
          <span>{lead.email || "..."}</span>
        </div>
      </div>

      <Tabs defaultValue="toolkit" className="space-y-3">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="toolkit" className="gap-1 px-1.5 text-[11px]">
            <FileText className="h-3.5 w-3.5" />
            Toolkit
          </TabsTrigger>
          <TabsTrigger value="factfind" className="gap-1 px-1.5 text-[11px]">
            <ClipboardList className="h-3.5 w-3.5" />
            Fact Find
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-1 px-1.5 text-[11px]">
            <User className="h-3.5 w-3.5" />
            Details
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1 px-1.5 text-[11px]">
            <History className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="toolkit" className="mt-0 space-y-3">
          <div className="rounded-lg border p-3 text-sm space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Dialer Tools
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Primary number</p>
                <p className="font-mono text-foreground">
                  {lead.phone || "No phone"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="truncate text-foreground">
                  {lead.email || "No email"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Positioning cue</p>
                <p className="text-foreground">
                  {lead.notes ||
                    "Confirm investment goals and risk appetite before pitching the offer."}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Fact Find tab ── */}
        <TabsContent value="factfind" className="mt-0 space-y-3">
          {!activeDeal ? (
            <div className="rounded-lg border p-3 text-xs text-muted-foreground text-center py-6">
              No linked deal yet. Create a deal first to record fact-find details.
            </div>
          ) : editingFF ? (
            <div className="rounded-lg border p-3 space-y-2.5 text-xs">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Client Fact Find — {activeDeal.title}</p>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Financial Goal</label>
                <Select value={ffForm.financial_goal} onValueChange={(v) => setFfForm((f) => ({ ...f, financial_goal: v as FinancialGoal }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select goal" /></SelectTrigger>
                  <SelectContent>{(Object.keys(GOAL_LABELS) as FinancialGoal[]).map((g) => <SelectItem key={g} value={g}>{GOAL_LABELS[g]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Risk Tolerance</label>
                <Select value={ffForm.risk_tolerance} onValueChange={(v) => setFfForm((f) => ({ ...f, risk_tolerance: v as RiskTolerance }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select risk" /></SelectTrigger>
                  <SelectContent>{(Object.keys(TOLERANCE_LABELS) as RiskTolerance[]).map((r) => <SelectItem key={r} value={r}>{TOLERANCE_LABELS[r]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Investment Horizon</label>
                <Select value={ffForm.investment_horizon} onValueChange={(v) => setFfForm((f) => ({ ...f, investment_horizon: v as InvestmentHorizon }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select horizon" /></SelectTrigger>
                  <SelectContent>{(Object.keys(HORIZON_LABELS) as InvestmentHorizon[]).map((h) => <SelectItem key={h} value={h}>{HORIZON_LABELS[h]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Monthly Investable (SGD)</label>
                <Input type="number" className="h-7 text-xs" value={ffForm.monthly_investable} onChange={(e) => setFfForm((f) => ({ ...f, monthly_investable: e.target.value }))} placeholder="e.g. 1000" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Existing Investments</label>
                <Input className="h-7 text-xs" value={ffForm.existing_investments} onChange={(e) => setFfForm((f) => ({ ...f, existing_investments: e.target.value }))} placeholder="CPF, endowment, unit trusts…" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Notes</label>
                <Textarea rows={2} className="text-xs" value={ffForm.fact_find_notes} onChange={(e) => setFfForm((f) => ({ ...f, fact_find_notes: e.target.value }))} placeholder="Client concerns, preferences…" />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingFF(false)}>Cancel</Button>
                <Button size="sm" className="h-7 text-xs" onClick={saveFF}>Save</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">
                  {activeDeal.fact_find_done ? "✓ Fact Find Complete" : "Fact Find"}
                </p>
                <button onClick={openFF} className="text-[11px] text-primary hover:underline">
                  {activeDeal.financial_goal ? "Edit" : "Fill In"}
                </button>
              </div>
              {activeDeal.financial_goal ? (
                <div className="space-y-1.5">
                  <div><span className="text-muted-foreground">Goal: </span><span className="font-medium">{GOAL_LABELS[activeDeal.financial_goal]}</span></div>
                  {activeDeal.risk_tolerance && <div><span className="text-muted-foreground">Risk: </span><span className="font-medium">{TOLERANCE_LABELS[activeDeal.risk_tolerance]}</span></div>}
                  {activeDeal.investment_horizon && <div><span className="text-muted-foreground">Horizon: </span><span className="font-medium">{HORIZON_LABELS[activeDeal.investment_horizon]}</span></div>}
                  {activeDeal.monthly_investable && <div><span className="text-muted-foreground">Monthly investable: </span><span className="font-medium">SGD {activeDeal.monthly_investable.toLocaleString()}</span></div>}
                  {activeDeal.existing_investments && <div><span className="text-muted-foreground">Existing: </span><span>{activeDeal.existing_investments}</span></div>}
                  {activeDeal.fact_find_notes && <p className="text-muted-foreground italic border-t pt-1.5 mt-1">{activeDeal.fact_find_notes}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground py-2">Not filled yet. Tap "Fill In" to record client details.</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-0 space-y-3 text-sm">
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Lead Details
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                {lead.status}
              </div>
              <div>
                <span className="text-muted-foreground">Source:</span>{" "}
                {lead.source}
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>{" "}
                {formatDate(lead.created_at)}
              </div>
              <div>
                <span className="text-muted-foreground">Updated:</span>{" "}
                {formatDate(lead.updated_at)}
              </div>
            </div>
            {lead.notes && (
              <p className="text-xs text-foreground pt-1">{lead.notes}</p>
            )}
          </div>

        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-3 text-sm">
          <div className="rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Deal History
            </p>
            {relatedDeals.length > 0 ? (
              <div className="space-y-2">
                {relatedDeals.map((deal) => (
                  <div key={deal.id} className="rounded-md border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/deals/${deal.id}`}
                        className="font-medium truncate text-primary hover:underline"
                      >
                        {deal.title}
                      </Link>
                      <span className="font-semibold">
                        {formatCurrency(deal.value)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                      <BriefcaseBusiness className="h-3.5 w-3.5" />
                      <span>{deal.stage}</span>
                      <span>Updated {formatDate(deal.updated_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No deal history found for this person.
              </p>
            )}
          </div>

          {leadActivities.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Recent Activity
              </p>
              <div className="space-y-2">
                {leadActivities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2 text-xs border rounded-md p-2"
                  >
                    <span className="text-muted-foreground shrink-0">
                      {formatDate(a.completed_at || a.created_at)}
                    </span>
                    <span className="font-medium">{a.type}</span>
                    <Link
                      to={`/activities/${a.id}`}
                      className="text-primary hover:underline truncate"
                    >
                      {a.subject}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Live notes (during call) */}
      {phase === "calling" && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Live Notes
          </p>
          <Textarea
            value={liveNotes}
            onChange={(e) => setLiveNotes(e.target.value)}
            placeholder="Type call notes here..."
            className="text-sm"
            rows={3}
          />
        </div>
      )}

      {/* Action button */}
      {phase === "sheet" && (
        <Button onClick={startCall} className="w-full gap-2" size="lg">
          <Phone className="h-4 w-4" />
          Start Call
        </Button>
      )}
      {phase === "calling" && (
        <Button
          onClick={endCall}
          variant="destructive"
          className="w-full gap-2"
          size="lg"
        >
          <PhoneOff className="h-4 w-4" />
          End Call
        </Button>
      )}
    </div>
  );
}
