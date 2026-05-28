import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, UserCheck, Plus } from "lucide-react";
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
import { canEdit, canManage } from "@/lib/permissions";
import type { LeadStatus, LeadSource, DealStage, Lead } from "@/data/types";

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
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
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
    updateLead,
    convertLead,
    createActivity,
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
    dealStage: "LEAD" as DealStage,
  });
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
              <Button
                variant="secondary"
                className="gap-1.5"
                onClick={() => setConvertOpen(true)}
              >
                <UserCheck className="h-4 w-4" />
                Convert to Client
              </Button>
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
                  <InfoRow
                    label="Appointment"
                    value={`${new Date(lead.appointment_date).toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" })}${lead.appointment_time ? ` at ${lead.appointment_time}` : ""}`}
                  />
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

      {/* Activity timeline */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Activity Timeline</CardTitle>
          {canEdit(currentUser) && !isConverted && (
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
                    "DEMO",
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
                    "DEAL_ADVANCED",
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
