import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Phone, Calendar, TrendingUp, MessageSquare, Plus, Trash2, ClipboardList } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DealStageBadge,
  ActivityTypeBadge,
  ActivityResultBadge,
} from "@/components/common/StatusBadge";
import { formatDate, formatCurrency, formatDateTime } from "@/lib/format";
import { getContactActivities } from "@/lib/selectors";
import { canEdit, isAdviser, isMaster } from "@/lib/permissions";
import type { RiskTolerance, FinancialGoal, InvestmentHorizon } from "@/data/types";

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

const RISK_COLOR: Record<RiskTolerance, string> = {
  CONSERVATIVE: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  MODERATE:     "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  BALANCED:     "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  GROWTH:       "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  AGGRESSIVE:   "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    contacts, deals, activities, users,
    contact_notes, addContactNote, deleteContactNote,
    updateContact, updateDeal, createDeal,
  } = useCrmStore();
  const { currentUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [noteText, setNoteText] = useState("");

  // ── Fact Find state ──────────────────────────────────────────────────────────
  const [editingFF, setEditingFF] = useState(false);
  const [investPeriod, setInvestPeriod] = useState<"monthly" | "annually">("monthly");
  const [ffForm, setFfForm] = useState({
    financial_goal: "" as FinancialGoal | "",
    risk_tolerance: "" as RiskTolerance | "",
    investment_horizon: "" as InvestmentHorizon | "",
    monthly_investable: "",
    existing_investments: "",
    fact_find_notes: "",
  });

  const contact = contacts.find((c) => c.id === id);
  if (!contact)
    return <div className="p-6 text-muted-foreground">Contact not found.</div>;

  const contactDeals = deals.filter((d) => d.contact_id === id && !d.deleted_at);
  const contactActivities = getContactActivities(id!, activities);
  const thisNotes = contact_notes
    .filter((n) => n.contact_id === id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // ── Stats ──────────────────────────────────────────────────────────────────
  const callCount = contactActivities.filter((a) => a.type === "CALL").length;
  const meetingCount = contactActivities.filter((a) => a.type === "MEETING").length;
  const totalDealValue = contactDeals.filter((d) => d.stage !== "LOST").reduce((s, d) => s + (d.value || 0), 0);
  const wonDealValue = contactDeals.filter((d) => d.stage === "WON").reduce((s, d) => s + (d.value || 0), 0);

  // ── Risk profile: from most recent deal with fact-find data ────────────────
  const dealWithFF = [...contactDeals]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .find((d) => d.risk_tolerance || d.financial_goal || d.investment_horizon);

  // Target deal to write fact-find to: prefer the one that already has FF, else newest deal
  const ffTargetDeal = dealWithFF
    ?? [...contactDeals].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
    ?? null;

  const canFillFF = currentUser && (isAdviser(currentUser) || isMaster(currentUser));

  const openFF = () => {
    const src = ffTargetDeal;
    setFfForm({
      financial_goal: src?.financial_goal ?? "",
      risk_tolerance: src?.risk_tolerance ?? "",
      investment_horizon: src?.investment_horizon ?? "",
      monthly_investable: src?.monthly_investable != null ? String(src.monthly_investable) : "",
      existing_investments: src?.existing_investments ?? "",
      fact_find_notes: src?.fact_find_notes ?? "",
    });
    setInvestPeriod("monthly");
    setEditingFF(true);
  };

  const saveFF = () => {
    if (!currentUser) return;
    const investable = ffForm.monthly_investable
      ? (investPeriod === "annually"
          ? parseFloat(ffForm.monthly_investable) / 12
          : parseFloat(ffForm.monthly_investable))
      : undefined;
    const ffData = {
      financial_goal: (ffForm.financial_goal as FinancialGoal) || undefined,
      risk_tolerance: (ffForm.risk_tolerance as RiskTolerance) || undefined,
      investment_horizon: (ffForm.investment_horizon as InvestmentHorizon) || undefined,
      monthly_investable: investable,
      existing_investments: ffForm.existing_investments || undefined,
      fact_find_notes: ffForm.fact_find_notes || undefined,
      fact_find_done: !!(ffForm.financial_goal && ffForm.risk_tolerance && ffForm.investment_horizon),
    };

    if (ffTargetDeal) {
      updateDeal(ffTargetDeal.id, ffData, currentUser.id);
    } else {
      // No deal yet — auto-create one so we have somewhere to save the fact-find
      const newDeal = createDeal({
        title: `${contact.first_name} ${contact.last_name}`,
        value: 0,
        stage: "APPOINTMENT",
        contact_id: contact.id,
        assigned_to_id: currentUser.id,
        created_by: currentUser.id,
        deleted_at: undefined,
        ...ffData,
      }, currentUser.id);
      void newDeal; // deal is saved in store
    }
    setEditingFF(false);
  };

  const handleSave = () => {
    if (!currentUser) return;
    updateContact(contact.id, form, currentUser.id);
    setEditing(false);
  };

  const handleAddNote = () => {
    if (!noteText.trim() || !currentUser) return;
    addContactNote(contact.id, noteText.trim(), currentUser.id);
    setNoteText("");
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {contact.first_name} {contact.last_name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {contact.title || "Client"}
          </p>
        </div>
        {canEdit(currentUser) &&
          (editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => {
              setEditing(true);
              setForm({
                first_name: contact.first_name,
                last_name: contact.last_name,
                email: contact.email || "",
                phone: contact.phone || "",
                title: contact.title || "",
              });
            }}>Edit</Button>
          ))}
      </div>

      {/* Summary stat chips */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xl font-bold tabular-nums">{callCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Calls</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xl font-bold tabular-nums">{meetingCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Meetings</p>
          </div>
        </div>
        {totalDealValue > 0 && (
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(totalDealValue)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Pipeline Value{wonDealValue > 0 ? ` · ${formatCurrency(wonDealValue)} WON` : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Contact info + Risk profile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {editing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>First Name</Label>
                    <Input value={form.first_name || ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Last Name</Label>
                    <Input value={form.last_name || ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Title / Role</Label>
                    <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p><span className="text-muted-foreground">Email:</span> {contact.email || "—"}</p>
                <p><span className="text-muted-foreground">Phone:</span> {contact.phone || "—"}</p>
                <p><span className="text-muted-foreground">Title:</span> {contact.title || "—"}</p>
                <p><span className="text-muted-foreground">Source:</span> {contact.source?.replace("_", " ") || "—"}</p>
                <p><span className="text-muted-foreground">Client since:</span> {formatDate(contact.created_at)}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Fact Find / Risk Profile */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Fact Find
                {dealWithFF?.fact_find_done && (
                  <span className="ml-1 text-[10px] font-normal text-green-600 dark:text-green-400">✓ Complete</span>
                )}
              </CardTitle>
              {canFillFF && !editingFF && (
                <Button size="sm" variant={dealWithFF ? "outline" : "default"} className="h-7 text-xs gap-1" onClick={openFF}>
                  {dealWithFF ? "Edit" : (
                    <><ClipboardList className="h-3.5 w-3.5" />Fill In</>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingFF ? (
              /* ── Edit form ── */
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Financial Goal</Label>
                  <Select value={ffForm.financial_goal} onValueChange={(v) => setFfForm((f) => ({ ...f, financial_goal: v as FinancialGoal }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select goal…" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(GOAL_LABELS) as FinancialGoal[]).map((g) => (
                        <SelectItem key={g} value={g}>{GOAL_LABELS[g]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Risk Tolerance</Label>
                  <Select value={ffForm.risk_tolerance} onValueChange={(v) => setFfForm((f) => ({ ...f, risk_tolerance: v as RiskTolerance }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select risk…" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TOLERANCE_LABELS) as RiskTolerance[]).map((r) => (
                        <SelectItem key={r} value={r}>{TOLERANCE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Investment Horizon</Label>
                  <Select value={ffForm.investment_horizon} onValueChange={(v) => setFfForm((f) => ({ ...f, investment_horizon: v as InvestmentHorizon }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select horizon…" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(HORIZON_LABELS) as InvestmentHorizon[]).map((h) => (
                        <SelectItem key={h} value={h}>{HORIZON_LABELS[h]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Investable Amount (SGD)</Label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={ffForm.monthly_investable}
                      onChange={(e) => setFfForm((f) => ({ ...f, monthly_investable: e.target.value }))}
                      placeholder="e.g. 1000"
                    />
                    <div className="flex rounded-md border overflow-hidden shrink-0">
                      {(["monthly", "annually"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setInvestPeriod(p)}
                          className={`px-2 py-1 text-xs transition-colors ${
                            investPeriod === p
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {p === "monthly" ? "/mo" : "/yr"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Existing Investments</Label>
                  <Input
                    className="h-8 text-sm"
                    value={ffForm.existing_investments}
                    onChange={(e) => setFfForm((f) => ({ ...f, existing_investments: e.target.value }))}
                    placeholder="CPF, endowment, unit trusts…"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    rows={3}
                    className="text-sm resize-none"
                    value={ffForm.fact_find_notes}
                    onChange={(e) => setFfForm((f) => ({ ...f, fact_find_notes: e.target.value }))}
                    placeholder="Client concerns, goals, anything notable from the meeting…"
                  />
                </div>

                {!ffTargetDeal && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-1.5">
                    No deal linked yet — a new deal will be created automatically when you save.
                  </p>
                )}

                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={() => setEditingFF(false)}>Cancel</Button>
                  <Button size="sm" onClick={saveFF}>Save Fact Find</Button>
                </div>
              </div>
            ) : !dealWithFF ? (
              /* ── Empty state ── */
              <p className="text-sm text-muted-foreground">
                {canFillFF
                  ? "No fact-find recorded yet. Tap \"Fill In\" to record this client's financial profile."
                  : "No fact-find data yet."}
              </p>
            ) : (
              /* ── Read view ── */
              <div className="space-y-3">
                {dealWithFF.risk_tolerance && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Risk Tolerance</span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RISK_COLOR[dealWithFF.risk_tolerance]}`}>
                      {TOLERANCE_LABELS[dealWithFF.risk_tolerance]}
                    </span>
                  </div>
                )}
                {dealWithFF.financial_goal && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Financial Goal</span>
                    <span className="text-sm font-medium">{GOAL_LABELS[dealWithFF.financial_goal]}</span>
                  </div>
                )}
                {dealWithFF.investment_horizon && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Horizon</span>
                    <span className="text-sm font-medium">{HORIZON_LABELS[dealWithFF.investment_horizon]}</span>
                  </div>
                )}
                {dealWithFF.monthly_investable && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Monthly Investable</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(dealWithFF.monthly_investable)}
                      <span className="text-muted-foreground font-normal"> /mo</span>
                    </span>
                  </div>
                )}
                {dealWithFF.existing_investments && (
                  <div className="pt-1 border-t">
                    <p className="text-xs text-muted-foreground mb-0.5">Existing Investments</p>
                    <p className="text-sm">{dealWithFF.existing_investments}</p>
                  </div>
                )}
                {dealWithFF.fact_find_notes && (
                  <div className="pt-1 border-t">
                    <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{dealWithFF.fact_find_notes}</p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground border-t pt-1">
                  Linked to: <Link to={`/deals/${dealWithFF.id}`} className="text-primary hover:underline">{dealWithFF.title}</Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deal History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Deal History ({contactDeals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {contactDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals linked to this client.</p>
          ) : (
            <div className="divide-y">
              {contactDeals
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .map((d) => {
                  const adviser = users.find((u) => u.id === d.assigned_to_id);
                  const dealActivities = activities.filter((a) => a.deal_id === d.id && !a.deleted_at);
                  const dCalls = dealActivities.filter((a) => a.type === "CALL").length;
                  const dMeetings = dealActivities.filter((a) => a.type === "MEETING").length;
                  return (
                    <Link
                      key={d.id}
                      to={`/deals/${d.id}`}
                      className="flex items-center gap-3 py-2.5 px-1 hover:bg-muted/40 rounded transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{d.title}</span>
                          <DealStageBadge stage={d.stage} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          {dCalls > 0 && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{dCalls}</span>}
                          {dMeetings > 0 && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{dMeetings}</span>}
                          {adviser && <span>Adviser: {adviser.name.split(" ")[0]}</span>}
                          <span>{formatDate(d.created_at)}</span>
                        </div>
                      </div>
                      {d.value > 0 && (
                        <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(d.value)}</span>
                      )}
                    </Link>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes Running Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Client Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit(currentUser) && (
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a note about this client..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                className="flex-1 resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && noteText.trim()) {
                    handleAddNote();
                  }
                }}
              />
              <Button size="sm" className="self-end" disabled={!noteText.trim()} onClick={handleAddNote}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          )}
          {thisNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <div className="space-y-2">
              {thisNotes.map((note) => {
                const author = users.find((u) => u.id === note.created_by);
                const canDelete = currentUser?.id === note.created_by || currentUser?.role === "MASTER";
                return (
                  <div key={note.id} className="group flex items-start gap-3 rounded-lg bg-muted/40 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug whitespace-pre-wrap">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {author?.name ?? "Unknown"} · {new Date(note.created_at).toLocaleString("en-SG", {
                          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => deleteContactNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5 rounded"
                        title="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Activity Timeline ({contactActivities.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {contactActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities recorded for this client.</p>
          ) : (
            <div className="space-y-2">
              {contactActivities.map((a) => {
                const creator = users.find((u) => u.id === a.created_by);
                const duration = a.metadata?.duration_seconds as number | undefined;
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 text-sm border-b last:border-0 pb-2 last:pb-0"
                  >
                    <ActivityTypeBadge type={a.type} className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{a.subject}</p>
                      {a.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <ActivityResultBadge result={a.result} />
                        {duration != null && duration > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {Math.floor(duration / 60)}m {duration % 60}s
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {creator ? (
                            <Link to={`/team/${creator.id}`} className="text-primary hover:underline">
                              {creator.name}
                            </Link>
                          ) : "System"}{" "}
                          · {formatDateTime(a.completed_at || a.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
