import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, UserCheck, Plus, Trash2, MessageSquare, CalendarPlus, Download } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LeadStatusBadge,
  ActivityTypeBadge,
  ActivityResultBadge,
} from "@/components/common/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDate, formatDateTime } from "@/lib/format";
import { getLeadActivities } from "@/lib/selectors";
import { canEdit, canLogActivity, canManage, isAdviser } from "@/lib/permissions";
import { buildGoogleCalendarUrl, downloadIcs } from "@/lib/calendar";
import type { LeadStatus, LeadSource, DealStage, Lead, AppointmentResult } from "@/data/types";

const SOURCES: LeadSource[] = [
  "COLD_CALL",
  "REFERRAL",
  "MAGNET",
  "SCOUT",
  "LENS",
  "BEACON",
  "MANUAL",
  "WALK_IN",
];
const DEAL_STAGES: DealStage[] = [
  "CALLING",
  "APPOINTMENT",
  "PROPOSAL",
  "SUBMITTED",
];

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    leads,
    companies,
    users,
    activities,
    contacts,
    products,
    lead_notes,
    updateLead,
    convertLead,
    createActivity,
    addLeadNote,
    deleteLeadNote,
    claimLead,
    returnLead,
  } = useCrmStore();
  const { currentUser } = useAuthStore();

  const lead = leads.find((l) => l.id === id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({});
  const [convertOpen, setConvertOpen] = useState(false);
  const [convForm, setConvForm] = useState({
    createDeal: false,
    dealTitle: "",
    dealValue: "",
    dealStage: "CALLING" as DealStage,
  });
  const [noteText, setNoteText] = useState("");
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [outcomeResult, setOutcomeResult] = useState<AppointmentResult>("MET");
  const [activityOpen, setActivityOpen] = useState(false);
  const [actForm, setActForm] = useState({
    type: "CALL" as const,
    subject: "",
    description: "",
    result: "COMPLETED" as const,
  });

  if (!lead)
    return <div className="p-6 text-muted-foreground">Lead not found.</div>;

  const company = companies.find((c) => c.id === lead.company_id);
  const assignee = users.find((u) => u.id === lead.assigned_to_id);
  const convertedContact = contacts.find(
    (c) => c.id === lead.converted_contact_id,
  );
  const leadActivities = getLeadActivities(lead.id, activities);
  const thisLeadNotes = lead_notes
    .filter((n) => n.lead_id === lead.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const isConverted = lead.status === "OTHERS" && !!lead.converted_contact_id;

  const handleSave = () => {
    if (!currentUser) return;
    updateLead(lead.id, form as Partial<typeof lead>, currentUser.id);
    setEditing(false);
  };

  const handleConvert = () => {
    if (!currentUser) return;
    convertLead(
      lead.id,
      {
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        company_id: lead.company_id,
        source: lead.source,
        created_by: currentUser.id,
      },
      convForm.createDeal && convForm.dealTitle
        ? {
            title: convForm.dealTitle,
            value: parseFloat(convForm.dealValue) || 0,
            stage: convForm.dealStage,
            company_id: lead.company_id,
            assigned_to_id: currentUser.id,
            created_by: currentUser.id,
            contact_id: "",
          }
        : null,
      currentUser.id,
    );
    setConvertOpen(false);
    navigate(`/leads/${lead.id}`);
  };

  const handleAppointmentOutcome = () => {
    if (!currentUser) return;
    const base: Partial<Lead> = { appointment_result: outcomeResult };
    if (outcomeResult === "NO_SHOW") {
      // Bounce back: reset to NA, clear appointment, increment bounce count
      base.status = "NA";
      base.appointment_date = undefined;
      base.appointment_time = undefined;
      base.bounce_count = (lead.bounce_count ?? 0) + 1;
    } else if (outcomeResult === "RESCHEDULED") {
      // Keep APPOINTMENT status but clear the date so adviser can set a new one
      base.appointment_date = undefined;
      base.appointment_time = undefined;
    }
    updateLead(lead.id, base, currentUser.id);
    setOutcomeOpen(false);
  };

  const handleAddActivity = () => {
    if (!currentUser || !actForm.subject) return;
    createActivity(
      {
        ...actForm,
        lead_id: lead.id,
        assigned_to_id: currentUser.id,
        created_by: currentUser.id,
        scheduled_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      },
      currentUser.id,
    );
    setActivityOpen(false);
    setActForm({
      type: "CALL",
      subject: "",
      description: "",
      result: "COMPLETED",
    });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/leads")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {lead.first_name} {lead.last_name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <LeadStatusBadge status={lead.status} />
            {isConverted && (
              <span className="text-xs text-muted-foreground">Read-only</span>
            )}
          </div>
        </div>
        {!isConverted && canEdit(currentUser) && (
          <div className="flex gap-2">
            {lead.status === "APPOINTMENT" && (
              <>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setOutcomeOpen(true)}
                >
                  Record Outcome
                </Button>
                <Button
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => setConvertOpen(true)}
                >
                  <UserCheck className="h-4 w-4" />
                  Convert to Client
                </Button>
              </>
            )}
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(true);
                  setForm(lead);
                }}
              >
                Edit
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lead info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lead Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>First Name</Label>
                    <Input
                      value={form.first_name || ""}
                      onChange={(e) =>
                        setForm({ ...form, first_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Last Name</Label>
                    <Input
                      value={form.last_name || ""}
                      onChange={(e) =>
                        setForm({ ...form, last_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input
                      value={form.email || ""}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone || ""}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm({ ...form, status: v as LeadStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["NA", "APPOINTMENT", "NOT_INTERESTED", "ABANDON", "OTHERS"] as LeadStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Source</Label>
                  <Select
                    value={form.source}
                    onValueChange={(v) =>
                      setForm({ ...form, source: v as LeadSource })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Appointment fields — shown only when status=APPOINTMENT (Task #4) */}
                {form.status === "APPOINTMENT" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Appointment Date</Label>
                      <Input
                        type="date"
                        value={form.appointment_date?.slice(0, 10) || ""}
                        onChange={(e) =>
                          setForm({ ...form, appointment_date: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Appointment Time</Label>
                      <Input
                        type="time"
                        value={form.appointment_time || ""}
                        onChange={(e) =>
                          setForm({ ...form, appointment_time: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
                {/* Others free-text (Task #6) */}
                {form.status === "OTHERS" && (
                  <div className="space-y-1">
                    <Label>Outcome Note</Label>
                    <Textarea
                      placeholder="Describe the outcome..."
                      value={form.other_status_note || ""}
                      onChange={(e) =>
                        setForm({ ...form, other_status_note: e.target.value })
                      }
                      rows={2}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes || ""}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    rows={2}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2 text-sm">
                <InfoRow label="Email" value={lead.email} />
                <InfoRow label="Phone" value={lead.phone} />
                <InfoRow
                  label="Source"
                  value={lead.source?.replace("_", " ")}
                />
                <InfoRow
                  label="Company"
                  value={
                    company ? (
                      <Link
                        to={`/companies/${company.id}`}
                        className="text-primary hover:underline"
                      >
                        {company.name}
                      </Link>
                    ) : undefined
                  }
                />
                <InfoRow
                  label="Assigned To"
                  value={
                    assignee ? (
                      <Link
                        to={`/team/${assignee.id}`}
                        className="text-primary hover:underline"
                      >
                        {assignee.name}
                      </Link>
                    ) : undefined
                  }
                />
                <InfoRow label="Created" value={formatDate(lead.created_at)} />
                {/* Appointment details (Task #4) */}
                {lead.status === "APPOINTMENT" && lead.appointment_date && (
                  <>
                    <InfoRow
                      label="Appointment"
                      value={`${new Date(lead.appointment_date).toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" })}${lead.appointment_time ? ` at ${lead.appointment_time}` : ""}`}
                    />
                    {/* Calendar actions (Task #17) */}
                    <div className="flex gap-1.5 pt-0.5">
                      <a
                        href={buildGoogleCalendarUrl(lead, assignee ?? undefined)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <CalendarPlus className="h-3 w-3" />
                        Add to Google Calendar
                      </a>
                      <span className="text-muted-foreground text-xs">·</span>
                      <button
                        onClick={() => downloadIcs(lead, assignee ?? undefined)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        Download .ics
                      </button>
                    </div>
                  </>
                )}
                {/* Others note (Task #6) */}
                {lead.status === "OTHERS" && lead.other_status_note && (
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground mb-0.5">Outcome Note</p>
                    <p className="text-sm">{lead.other_status_note}</p>
                  </div>
                )}
                {lead.notes && (
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Notes
                    </p>
                    <p className="text-sm">{lead.notes}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversion / Assignee */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status & Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Abandon banner (Task #5) */}
            {lead.is_abandoned && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 text-sm">
                <p className="font-semibold text-red-800 dark:text-red-300">⛔ Do Not Contact</p>
                <p className="text-red-700 dark:text-red-400 text-xs mt-0.5">
                  This lead has been marked as Abandoned and flagged as do-not-redistribute.
                  {lead.abandoned_at && ` Abandoned on ${new Date(lead.abandoned_at).toLocaleDateString("en-SG")}.`}
                </p>
              </div>
            )}
            {isConverted && convertedContact && (
              <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-3 text-sm">
                <p className="font-medium text-purple-800 dark:text-purple-300">
                  Converted to Client
                </p>
                <p className="text-purple-700 dark:text-purple-400 text-xs mt-0.5">
                  Contact:{" "}
                  <Link
                    to={`/contacts/${convertedContact.id}`}
                    className="underline"
                  >
                    {convertedContact.first_name} {convertedContact.last_name}
                  </Link>
                </p>
                {lead.converted_at && (
                  <p className="text-muted-foreground text-xs mt-0.5">
                    on {formatDate(lead.converted_at)}
                  </p>
                )}
              </div>
            )}
            {!isConverted && (
              <div className="space-y-2 text-sm">
                <InfoRow
                  label="Current Status"
                  value={<LeadStatusBadge status={lead.status} />}
                />
                <InfoRow
                  label="Assigned To"
                  value={
                    assignee ? (
                      <Link
                        to={`/team/${assignee.id}`}
                        className="text-primary hover:underline"
                      >
                        {assignee.name}
                      </Link>
                    ) : (
                      "Unassigned"
                    )
                  }
                />
                {lead.appointment_result && (
                  <InfoRow
                    label="Appt. Outcome"
                    value={lead.appointment_result.replace("_", " ")}
                  />
                )}
                {(lead.bounce_count ?? 0) > 0 && (
                  <InfoRow
                    label="Bounces"
                    value={
                      <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-semibold">
                        ↩ {lead.bounce_count}× no-show
                      </span>
                    }
                  />
                )}
                {/* Claim / Return (Task #16) */}
                {isAdviser(currentUser) && !lead.assigned_to_id && (
                  <div className="pt-1">
                    <Button
                      size="sm"
                      className="w-full gap-1.5"
                      disabled={(currentUser?.credit_balance ?? 0) < 1}
                      onClick={() => {
                        if (!currentUser) return;
                        claimLead(lead.id, currentUser.id);
                      }}
                    >
                      Claim Lead (1 credit)
                    </Button>
                    <p className="text-center text-xs text-muted-foreground mt-1">
                      Your credits: {currentUser?.credit_balance ?? 0}
                    </p>
                  </div>
                )}
                {isAdviser(currentUser) && lead.assigned_to_id === currentUser?.id && (
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-muted-foreground gap-1.5"
                      onClick={() => {
                        if (!currentUser) return;
                        returnLead(lead.id, currentUser.id);
                      }}
                    >
                      Return Lead (+1 credit)
                    </Button>
                  </div>
                )}
                {canManage(currentUser) && editing && (
                  <div className="space-y-1">
                    <Label>Reassign To</Label>
                    <Select
                      value={form.assigned_to_id || ""}
                      onValueChange={(v) =>
                        setForm({ ...form, assigned_to_id: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          .filter((u) => u.role === "ADVISER")
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status history (Task #3) */}
      {lead.status_history && lead.status_history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {[...lead.status_history].reverse().map((entry, i) => {
                const changer = users.find((u) => u.id === entry.changed_by);
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <LeadStatusBadge status={entry.status} className="shrink-0" />
                    <span className="text-muted-foreground text-xs">
                      {new Date(entry.changed_at).toLocaleString("en-SG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {changer && ` · ${changer.name}`}
                    </span>
                    {entry.note && <span className="text-xs text-muted-foreground">— {entry.note}</span>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products discussed (Task #12) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Products Discussed</CardTitle>
        </CardHeader>
        <CardContent>
          {products.filter((p) => p.is_active).length === 0 ? (
            <p className="text-sm text-muted-foreground">No products in catalog.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {products
                  .filter((p) => p.is_active)
                  .map((p) => {
                    const discussed = (lead.products_discussed ?? []).includes(p.id);
                    const canToggle = canEdit(currentUser) && !isConverted;
                    return (
                      <button
                        key={p.id}
                        disabled={!canToggle}
                        onClick={() => {
                          if (!canToggle || !currentUser) return;
                          const current = lead.products_discussed ?? [];
                          const next = discussed
                            ? current.filter((id) => id !== p.id)
                            : [...current, p.id];
                          updateLead(lead.id, { products_discussed: next }, currentUser.id);
                        }}
                        title={p.name}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                          discussed
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        } ${!canToggle ? "cursor-default" : "cursor-pointer"}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            discussed ? "bg-primary-foreground" : "bg-current opacity-50"
                          }`}
                        />
                        {p.ticker || p.name}
                      </button>
                    );
                  })}
              </div>
              {(lead.products_discussed ?? []).length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {lead.products_discussed!.length} product{lead.products_discussed!.length !== 1 ? "s" : ""} discussed:{" "}
                  {lead.products_discussed!
                    .map((id) => products.find((p) => p.id === id)?.name ?? id)
                    .join(", ")}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes log (Task #11) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Notes Log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add note input — any authenticated user (TM, Adviser, Master) */}
          {canLogActivity(currentUser) && !isConverted && (
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                className="flex-1 resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && noteText.trim() && currentUser) {
                    addLeadNote(lead.id, noteText.trim(), currentUser.id);
                    setNoteText("");
                  }
                }}
              />
              <Button
                size="sm"
                className="self-end"
                disabled={!noteText.trim()}
                onClick={() => {
                  if (!noteText.trim() || !currentUser) return;
                  addLeadNote(lead.id, noteText.trim(), currentUser.id);
                  setNoteText("");
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          )}

          {/* Note list */}
          {thisLeadNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <div className="space-y-2">
              {thisLeadNotes.map((note) => {
                const author = users.find((u) => u.id === note.created_by);
                const canDelete =
                  currentUser?.id === note.created_by ||
                  currentUser?.role === "MASTER";
                return (
                  <div
                    key={note.id}
                    className="group flex items-start gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug whitespace-pre-wrap">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {author?.name ?? "Unknown"} ·{" "}
                        {new Date(note.created_at).toLocaleString("en-SG", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => deleteLeadNote(note.id)}
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

      {/* Activity timeline */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Activity Timeline</CardTitle>
          {canLogActivity(currentUser) && !isConverted && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setActivityOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Log Activity
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {leadActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities yet.</p>
          ) : (
            <div className="space-y-2">
              {leadActivities.map((a) => {
                const creator = users.find((u) => u.id === a.created_by);
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 text-sm border-b last:border-0 pb-2 last:pb-0"
                  >
                    <ActivityTypeBadge
                      type={a.type}
                      className="shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{a.subject}</p>
                      {a.description && (
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {a.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <ActivityResultBadge result={a.result} />
                        <span className="text-xs text-muted-foreground">
                          {creator ? (
                            <Link
                              to={`/team/${creator.id}`}
                              className="text-primary hover:underline"
                            >
                              {creator.name}
                            </Link>
                          ) : (
                            "System"
                          )}{" "}
                          - {formatDateTime(a.completed_at || a.created_at)}
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

      {/* Appointment outcome dialog (Task #10) */}
      <Dialog open={outcomeOpen} onOpenChange={setOutcomeOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Appointment Outcome</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              What happened at the appointment with{" "}
              <strong>{lead.first_name} {lead.last_name}</strong>?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["MET", "NO_SHOW", "RESCHEDULED", "CANCELLED"] as AppointmentResult[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setOutcomeResult(opt)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    outcomeResult === opt
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <span className="block">
                    {opt === "MET" && "✅ Met"}
                    {opt === "NO_SHOW" && "🚫 No-Show"}
                    {opt === "RESCHEDULED" && "🔄 Rescheduled"}
                    {opt === "CANCELLED" && "❌ Cancelled"}
                  </span>
                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                    {opt === "MET" && "Appointment held"}
                    {opt === "NO_SHOW" && "Lead bounces back to NA"}
                    {opt === "RESCHEDULED" && "Clears date for rebooking"}
                    {opt === "CANCELLED" && "Appointment cancelled"}
                  </span>
                </button>
              ))}
            </div>
            {outcomeResult === "NO_SHOW" && (
              <div className="rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 p-2.5 text-xs text-orange-700 dark:text-orange-400">
                ↩ This lead will be bounced back to <strong>NA</strong> status for recalling.
                Bounce count: {(lead.bounce_count ?? 0) + 1}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutcomeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAppointmentOutcome}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert Lead to Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              This will create a Contact from{" "}
              <strong>
                {lead.first_name} {lead.last_name}
              </strong>{" "}
              and mark the lead as CONVERTED.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={convForm.createDeal}
                onChange={(e) =>
                  setConvForm({ ...convForm, createDeal: e.target.checked })
                }
                className="rounded"
              />
              <span>Also create a Deal</span>
            </label>
            {convForm.createDeal && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label>Deal Title *</Label>
                  <Input
                    value={convForm.dealTitle}
                    onChange={(e) =>
                      setConvForm({ ...convForm, dealTitle: e.target.value })
                    }
                    placeholder="e.g. Acme Corp â€“ Investment"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Value (IDR)</Label>
                    <Input
                      type="number"
                      value={convForm.dealValue}
                      onChange={(e) =>
                        setConvForm({ ...convForm, dealValue: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Stage</Label>
                    <Select
                      value={convForm.dealStage}
                      onValueChange={(v) =>
                        setConvForm({ ...convForm, dealStage: v as DealStage })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEAL_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvert}>Convert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log activity dialog */}
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={actForm.type}
                onValueChange={(v) =>
                  setActForm({ ...actForm, type: v as typeof actForm.type })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "CALL",
                    "EMAIL",
                    "MEETING",
                    "TASK",
                    "NOTE",
                    "FOLLOW_UP",
                  ].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Subject *</Label>
              <Input
                value={actForm.subject}
                onChange={(e) =>
                  setActForm({ ...actForm, subject: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={actForm.description}
                onChange={(e) =>
                  setActForm({ ...actForm, description: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>Result</Label>
              <Select
                value={actForm.result}
                onValueChange={(v) =>
                  setActForm({ ...actForm, result: v as typeof actForm.result })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "COMPLETED",
                    "NO_ANSWER",
                    "FOLLOW_UP_NEEDED",
                    "MEETING_SCHEDULED",
                    "CANCELLED",
                    "FAILED",
                  ].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddActivity} disabled={!actForm.subject}>
              Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | string | undefined | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "..."}</span>
    </div>
  );
}
