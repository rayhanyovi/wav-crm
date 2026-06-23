import {
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  History,
  Phone,
  PhoneCall,
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
import { useActivities } from "@/hooks/useActivities";
import { useContact } from "@/hooks/useContacts";
import { useDeals } from "@/hooks/useDeals";
import { useUpdateLead } from "@/hooks/useLeads";
import { useCreateActivity } from "@/hooks/useActivities";
import { CallbackModal } from "@/components/leads/CallbackModal";
import { LeadStatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Lead, FinancialGoal, RiskTolerance, InvestmentHorizon } from "@/data/types";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { useScripts } from "@/hooks/useScripts";

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

interface DialerToolItem {
  label: string;
  value: string | number | null | undefined;
  wide?: boolean;
}

function displayValue(value: DialerToolItem["value"]): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

interface CallSheetProps {
  lead: Lead | undefined;
}

export function CallSheet({ lead }: CallSheetProps) {
  const { startCall, endCall, liveNotes, setLiveNotes, phase, updateCurrentLead,
    submitOutcome, nextLead, callDurationSeconds } = useCallSessionStore();
  const { data: activities = [] } = useActivities({ lead_id: lead?.id });
  const { data: deals = [] } = useDeals();
  const { data: convertedContact } = useContact(lead?.converted_contact_id);
  const updateLeadMutation = useUpdateLead();
  const createActivityMutation = useCreateActivity();
  const { currentUser } = useAuthStore();
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const { data: scripts = [] } = useScripts();
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [editingFF, setEditingFF] = useState(false);
  const [ffForm, setFfForm] = useState({
    financial_goal: "" as FinancialGoal | "",
    risk_tolerance: "" as RiskTolerance | "",
    investment_horizon: "" as InvestmentHorizon | "",
    monthly_investable: "",
    existing_investments: "",
    fact_find_notes: "",
    gender: "",
    age: "",
    zipcode: "",
  });

  if (!lead)
    return <div className="p-6 text-muted-foreground">No lead selected.</div>;

  const leadActivities = [...activities]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);
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

  const dialerToolItems: DialerToolItem[] = [
    { label: "Primary number", value: lead.phone || "No phone" },
    { label: "Email", value: lead.email || "No email" },
    {
      label: "Positioning cue",
      value: lead.notes || "Confirm investment goals and risk appetite before pitching the offer.",
      wide: true,
    },
    { label: "Age", value: lead.age },
    { label: "First name", value: lead.first_name },
    { label: "Last name", value: lead.last_name },
    { label: "Gender", value: lead.gender },
    { label: "Income range", value: lead.income_range },
    { label: "Postal code", value: lead.zipcode },
  ];

  const openFF = () => {
    setFfForm({
      financial_goal: lead.financial_goal ?? "",
      risk_tolerance: lead.risk_tolerance ?? "",
      investment_horizon: lead.investment_horizon ?? "",
      monthly_investable: lead.monthly_investable != null ? String(lead.monthly_investable) : "",
      existing_investments: lead.existing_investments ?? "",
      fact_find_notes: lead.fact_find_notes ?? "",
      gender: lead.gender ?? "",
      age: lead.age != null ? String(lead.age) : "",
      zipcode: lead.zipcode ?? "",
    });
    setEditingFF(true);
  };

  const handleScheduleCallback = async () => {
    if (!lead || !currentUser) return;
    // Log that we called, without changing the lead status
    await createActivityMutation.mutateAsync({
      type: "CALL",
      subject: `Called — ${lead.first_name} ${lead.last_name} (scheduling callback)`,
      description: liveNotes.trim() || undefined,
      result: "FOLLOW_UP_NEEDED",
      scheduled_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      metadata: { duration_seconds: callDurationSeconds },
      lead_id: lead.id,
      assigned_to_id: currentUser.id,
      created_by: currentUser.id,
    }).catch((e) => console.error("Failed to log callback call", e));
    // Increment call count in session stats, no pickup
    submitOutcome(false);
    // Open the callback scheduler
    setShowCallbackModal(true);
  };

  const saveFF = () => {
    if (!currentUser) return;
    const payload = {
      financial_goal: ffForm.financial_goal || undefined,
      risk_tolerance: ffForm.risk_tolerance || undefined,
      investment_horizon: ffForm.investment_horizon || undefined,
      monthly_investable: ffForm.monthly_investable ? parseFloat(ffForm.monthly_investable) : undefined,
      existing_investments: ffForm.existing_investments || undefined,
      fact_find_notes: ffForm.fact_find_notes || undefined,
      fact_find_done: !!(ffForm.financial_goal && ffForm.risk_tolerance && ffForm.investment_horizon),
      gender: ffForm.gender || undefined,
      age: ffForm.age ? parseInt(ffForm.age, 10) : undefined,
      zipcode: ffForm.zipcode || undefined,
    };
    updateLeadMutation.mutate({
      id: lead.id,
      userId: currentUser.id,
      payload,
    });
    updateCurrentLead(payload);
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
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              {dialerToolItems.map((item) => (
                <div
                  key={item.label}
                  className={item.wide ? "col-span-2 min-w-0" : "min-w-0"}
                >
                  <p className="text-muted-foreground">{item.label}</p>
                  <p
                    className={
                      item.label === "Primary number"
                        ? "break-words font-mono text-foreground"
                        : "break-words text-foreground"
                    }
                  >
                    {displayValue(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Scripts */}
          <div className="rounded-lg border p-3 text-sm space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Scripts
            </p>
            {scripts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No scripts available.</p>
            ) : (
              <div className="space-y-1.5">
                {scripts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedScriptId(selectedScriptId === s.id ? null : s.id)}
                    className="w-full text-left rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
                  >
                    <span className="font-medium">{s.title}</span>
                    <span className="ml-1.5 text-muted-foreground">
                      {selectedScriptId === s.id ? "▲" : "▼"}
                    </span>
                    {selectedScriptId === s.id && s.content && (
                      <p className="mt-1.5 text-foreground whitespace-pre-wrap leading-relaxed">
                        {s.content}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Fact Find tab ── */}
        <TabsContent value="factfind" className="mt-0 space-y-3">
          {editingFF ? (
            <div className="rounded-lg border p-3 space-y-2.5 text-xs">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Client Fact Find — {lead.first_name} {lead.last_name}</p>
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
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Gender</label>
                  <Select value={ffForm.gender} onValueChange={(v) => setFfForm((f) => ({ ...f, gender: v }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Age</label>
                  <Input type="number" className="h-7 text-xs" value={ffForm.age} onChange={(e) => setFfForm((f) => ({ ...f, age: e.target.value }))} placeholder="e.g. 35" min={18} max={99} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Postal Code</label>
                  <Input className="h-7 text-xs" value={ffForm.zipcode} onChange={(e) => setFfForm((f) => ({ ...f, zipcode: e.target.value }))} placeholder="e.g. 560123" />
                </div>
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
                  {lead.fact_find_done ? "✓ Fact Find Complete" : "Fact Find"}
                </p>
                <button onClick={openFF} className="text-[11px] text-primary hover:underline">
                  {lead.financial_goal ? "Edit" : "Fill In"}
                </button>
              </div>
              {lead.financial_goal ? (
                <div className="space-y-1.5">
                  <div><span className="text-muted-foreground">Goal: </span><span className="font-medium">{GOAL_LABELS[lead.financial_goal]}</span></div>
                  {lead.risk_tolerance && <div><span className="text-muted-foreground">Risk: </span><span className="font-medium">{TOLERANCE_LABELS[lead.risk_tolerance]}</span></div>}
                  {lead.investment_horizon && <div><span className="text-muted-foreground">Horizon: </span><span className="font-medium">{HORIZON_LABELS[lead.investment_horizon]}</span></div>}
                  {lead.monthly_investable && <div><span className="text-muted-foreground">Monthly investable: </span><span className="font-medium">SGD {lead.monthly_investable.toLocaleString()}</span></div>}
                  {lead.existing_investments && <div><span className="text-muted-foreground">Existing: </span><span>{lead.existing_investments}</span></div>}
                  {(lead.gender || lead.age || lead.zipcode) && (
                    <div className="flex gap-3 flex-wrap border-t pt-1.5 mt-1">
                      {lead.gender && <span><span className="text-muted-foreground">Gender: </span><span className="font-medium">{lead.gender}</span></span>}
                      {lead.age && <span><span className="text-muted-foreground">Age: </span><span className="font-medium">{lead.age}</span></span>}
                      {lead.zipcode && <span><span className="text-muted-foreground">Postal: </span><span className="font-medium">{lead.zipcode}</span></span>}
                    </div>
                  )}
                  {lead.fact_find_notes && <p className="text-muted-foreground italic border-t pt-1.5 mt-1">{lead.fact_find_notes}</p>}
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
        <div className="space-y-2">
          <Button
            onClick={endCall}
            variant="destructive"
            className="w-full gap-2"
            size="lg"
          >
            <PhoneOff className="h-4 w-4" />
            End Call
          </Button>
          <Button
            onClick={handleScheduleCallback}
            variant="outline"
            className="w-full gap-2"
            size="lg"
            disabled={createActivityMutation.isPending}
          >
            <PhoneCall className="h-4 w-4" />
            Schedule Callback
          </Button>
        </div>
      )}

      {lead && (
        <CallbackModal
          lead={lead}
          open={showCallbackModal}
          onClose={() => setShowCallbackModal(false)}
          onSaved={() => {
            setShowCallbackModal(false);
            nextLead();
          }}
        />
      )}
    </div>
  );
}
