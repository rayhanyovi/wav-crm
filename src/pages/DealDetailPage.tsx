import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
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
  DealStageBadge,
  ActivityTypeBadge,
  ActivityResultBadge,
} from "@/components/common/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDate, formatCurrency, formatDateTime } from "@/lib/format";
import { getDealActivities } from "@/lib/selectors";
import { canEdit, canManage } from "@/lib/permissions";
import type { DealStage } from "@/data/types";
import { cn } from "@/lib/utils";

const STAGES: DealStage[] = [
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
];

export function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    deals,
    contacts,
    companies,
    users,
    activities,
    stage_history,
    updateDeal,
    moveDealStage,
    createActivity,
  } = useCrmStore();
  const { currentUser } = useAuthStore();

  const deal = deals.find((d) => d.id === id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState<DealStage>("QUALIFIED");
  const [stageNote, setStageNote] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [actForm, setActForm] = useState({
    type: "CALL" as const,
    subject: "",
    description: "",
    result: "COMPLETED" as const,
  });

  if (!deal)
    return <div className="p-6 text-muted-foreground">Deal not found.</div>;

  const contact = contacts.find((c) => c.id === deal.contact_id);
  const company = companies.find((c) => c.id === deal.company_id);
  const assignee = users.find((u) => u.id === deal.assigned_to_id);
  const dealActivities = getDealActivities(deal.id, activities);
  const dealHistory = stage_history
    .filter((h) => h.deal_id === deal.id)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  const handleSave = () => {
    if (!currentUser) return;
    updateDeal(
      deal.id,
      {
        ...form,
        value: form.value ? parseFloat(form.value) : deal.value,
      } as never,
      currentUser.id,
    );
    setEditing(false);
  };

  const handleStageChange = () => {
    if (!currentUser) return;
    moveDealStage(
      deal.id,
      newStage,
      stageNote || undefined,
      currentUser.id,
      newStage === "CLOSED_LOST" ? lostReason : undefined,
    );
    setStageDialogOpen(false);
    setStageNote("");
    setLostReason("");
  };

  const handleAddActivity = () => {
    if (!currentUser || !actForm.subject) return;
    createActivity(
      {
        ...actForm,
        deal_id: deal.id,
        contact_id: deal.contact_id,
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/deals")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{deal.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <DealStageBadge stage={deal.stage} />
            <span className="text-muted-foreground text-sm">
              {formatCurrency(deal.value)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit(currentUser) &&
            deal.stage !== "CLOSED_WON" &&
            deal.stage !== "CLOSED_LOST" && (
              <Button
                size="sm"
                onClick={() => {
                  setNewStage(
                    STAGES[STAGES.indexOf(deal.stage) + 1] || "CLOSED_WON",
                  );
                  setStageDialogOpen(true);
                }}
              >
                Change Stage
              </Button>
            )}
          {canEdit(currentUser) &&
            (editing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  Save
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(true);
                  setForm({
                    title: deal.title,
                    value: deal.value.toString(),
                    expected_close_date:
                      deal.expected_close_date?.split("T")[0] || "",
                  });
                }}
              >
                Edit
              </Button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Deal Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {editing ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input
                    value={form.title || ""}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Value (IDR)</Label>
                  <Input
                    type="number"
                    value={form.value || ""}
                    onChange={(e) =>
                      setForm({ ...form, value: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Expected Close</Label>
                  <Input
                    type="date"
                    value={form.expected_close_date || ""}
                    onChange={(e) =>
                      setForm({ ...form, expected_close_date: e.target.value })
                    }
                  />
                </div>
                {canManage(currentUser) && (
                  <div className="space-y-1">
                    <Label>Assign To</Label>
                    <Select
                      value={form.assigned_to_id || deal.assigned_to_id || ""}
                      onValueChange={(v) =>
                        setForm({ ...form, assigned_to_id: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          .filter((u) => u.role === "SALES")
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
            ) : (
              <>
                <p>
                  <span className="text-muted-foreground">Value:</span>{" "}
                  <span className="font-semibold">
                    {formatCurrency(deal.value)}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Contact:</span>{" "}
                  {contact ? (
                    <Link
                      to={`/contacts/${contact.id}`}
                      className="text-primary hover:underline"
                    >
                      {contact.first_name} {contact.last_name}
                    </Link>
                  ) : (
                    "..."
                  )}
                </p>
                <p>
                  <span className="text-muted-foreground">Company:</span>{" "}
                  {company ? (
                    <Link
                      to={`/companies/${company.id}`}
                      className="text-primary hover:underline"
                    >
                      {company.name}
                    </Link>
                  ) : (
                    "..."
                  )}
                </p>
                <p>
                  <span className="text-muted-foreground">Assigned To:</span>{" "}
                  {assignee ? (
                    <Link
                      to={`/team/${assignee.id}`}
                      className="text-primary hover:underline"
                    >
                      {assignee.name}
                    </Link>
                  ) : (
                    "N/A"
                  )}
                </p>
                <p>
                  <span className="text-muted-foreground">Expected Close:</span>{" "}
                  {formatDate(deal.expected_close_date)}
                </p>
                <p>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  {formatDate(deal.created_at)}
                </p>
                {deal.stage === "CLOSED_LOST" && deal.lost_reason && (
                  <div className="mt-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-2">
                    <p className="text-xs font-medium text-red-800 dark:text-red-300">
                      Lost Reason
                    </p>
                    <p className="text-xs mt-0.5">{deal.lost_reason}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Stage History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-2">
              {dealHistory.map((h, i) => {
                const changer = users.find((u) => u.id === h.changed_by);
                return (
                  <div key={h.id} className="flex items-start gap-2 text-xs">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full mt-0.5",
                          i === dealHistory.length - 1
                            ? "bg-primary"
                            : "bg-muted-foreground/40",
                        )}
                      />
                      {i < dealHistory.length - 1 && (
                        <div className="w-px h-full bg-border min-h-4" />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center gap-1.5">
                        {h.from_stage && (
                          <>
                            <DealStageBadge
                              stage={h.from_stage}
                              className="text-xs py-0"
                            />
                            <span>-</span>
                          </>
                        )}
                        <DealStageBadge
                          stage={h.to_stage}
                          className="text-xs py-0"
                        />
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        {changer ? (
                          <Link
                            to={`/team/${changer.id}`}
                            className="text-primary hover:underline"
                          >
                            {changer.name}
                          </Link>
                        ) : (
                          "System"
                        )}{" "}
                        - {formatDateTime(h.created_at)}
                      </p>
                      {h.note && (
                        <p className="text-foreground/70 italic mt-0.5">
                          "{h.note}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activities */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Activities</CardTitle>
          {canEdit(currentUser) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setActivityOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Log
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {dealActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities yet.</p>
          ) : (
            <div className="space-y-2">
              {dealActivities.map((a) => {
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
                        <p className="text-muted-foreground text-xs">
                          {a.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
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

      {/* Stage change dialog */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Stage</DialogTitle>
            <DialogDescription>
              Move this deal to a new pipeline stage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>New Stage</Label>
              <Select
                value={newStage}
                onValueChange={(v) => setNewStage(v as DealStage)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newStage === "CLOSED_LOST" && (
              <div className="space-y-1">
                <Label>Lost Reason *</Label>
                <Textarea
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  rows={2}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Note (optional)</Label>
              <Input
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
                placeholder="Any context..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStageChange}
              disabled={newStage === "CLOSED_LOST" && !lostReason.trim()}
            >
              Move Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log activity */}
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
