import { useState } from "react";
import { ExternalLink, MoreHorizontal, Plus, Upload, Users } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useActivities } from "@/hooks/useActivities";
import { useUsers } from "@/hooks/useUsers";
import { useLeads, useCreateLead, useUpdateLead } from "@/hooks/useLeads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadStatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/format";
import { getLastContactedDate } from "@/lib/selectors";
import { canEdit, isMaster, isAdviser, isTelemarketer } from "@/lib/permissions";
import { Link, useNavigate } from "react-router-dom";
import type { LeadStatus, LeadSource } from "@/data/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadImportDialog } from "@/components/leads/LeadImportDialog";

// APPOINTMENT is excluded — once a lead reaches that status it lives in Deals
const STATUSES: LeadStatus[] = [
  "NA",
  "NOT_INTERESTED",
  "AVOID",
  "KIV",
  "OTHERS",
];
const SOURCES: LeadSource[] = [
  "AP_MARKETING",
  "LP_MARKETING",
  "OWN_SOURCE",
  "OTHERS",
];

const SOURCE_LABELS: Record<LeadSource, string> = {
  AP_MARKETING: "AP Marketing",
  LP_MARKETING: "LP Marketing",
  OWN_SOURCE: "Own Source",
  OTHERS: "Others",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NA: "NA",
  APPOINTMENT: "Appointment",
  NOT_INTERESTED: "Not Interested",
  AVOID: "Avoid",
  KIV: "KIV",
  OTHERS: "Others",
};

export function LeadsPage() {
  const { data: activities = [] } = useActivities();
  const { data: users = [] } = useUsers();
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();

  // Real Supabase data — RLS scopes by role automatically
  const { data: leads = [] } = useLeads({ includeAbandoned: true });
  const createLeadMutation = useCreateLead();
  const updateLeadMutation = useUpdateLead();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterSource, setFilterSource] = useState("ALL");
  const [filterAssignee, setFilterAssignee] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showAbandoned, setShowAbandoned] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    source: "AP_MARKETING" as LeadSource,
    status: "NA" as LeadStatus,
    notes: "",
  });

  // Role-based lead scoping (Task #7)
  const scopedLeads = leads.filter((l) => {
    if (l.deleted_at) return false;
    if (isMaster(currentUser)) return true;
    if (isAdviser(currentUser)) {
      return (
        l.assigned_to_id === currentUser?.id ||
        l.adviser_owner_id === currentUser?.id
      );
    }
    if (isTelemarketer(currentUser)) {
      // Telemarketer sees leads where they are the telemarketer owner
      // OR where their linked adviser has telemarketer_access enabled and lists this user as telemarketerId
      const linkedAdviser = users.find(
        (u) => u.telemarketer_access && u.telemarketer_id === currentUser?.id
      );
      return (
        l.telemarketer_owner_id === currentUser?.id ||
        (linkedAdviser != null && l.assigned_to_id === linkedAdviser.id)
      );
    }
    return false;
  });

  // APPOINTMENT leads have been handed off to Deals — hide them here
  const preAppointmentLeads = scopedLeads.filter((l) => l.status !== "APPOINTMENT");

  // Abandon filter — hide abandoned leads by default (Task #5)
  const liveLeads = preAppointmentLeads.filter((l) =>
    showAbandoned ? true : !l.is_abandoned
  );

  const filtered = liveLeads
    .filter((l) => {
      const name = `${l.first_name} ${l.last_name}`.toLowerCase();
      if (
        search &&
        !name.includes(search.toLowerCase()) &&
        !l.email?.includes(search.toLowerCase()) &&
        !l.phone?.includes(search)
      )
        return false;
      if (filterStatus !== "ALL" && l.status !== filterStatus) return false;
      if (filterSource !== "ALL" && l.source !== filterSource) return false;
      if (filterAssignee !== "ALL" && l.assigned_to_id !== filterAssignee)
        return false;
      return true;
    })
    .sort((a, b) => {
      // For TM: recently bounced (no-show) leads float to the top so they can recall first
      if (isTelemarketer(currentUser)) {
        const aBounced = a.last_bounced_at && a.status === "NA" ? new Date(a.last_bounced_at).getTime() : 0;
        const bBounced = b.last_bounced_at && b.status === "NA" ? new Date(b.last_bounced_at).getTime() : 0;
        if (aBounced !== bBounced) return bBounced - aBounced;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const abandonedCount = scopedLeads.filter((l) => l.is_abandoned).length;

  const handleCreate = () => {
    if (!form.first_name || !form.last_name || !currentUser) return;
    createLeadMutation.mutate(
      { ...form, assigned_to_id: currentUser.id, created_by: currentUser.id },
    );
    setCreateOpen(false);
    setForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      source: "AP_MARKETING",
      status: "NA",
      notes: "",
    });
  };

  const selectedLead = leads.find((l) => l.id === selectedLeadId);
  const selectedAssignee = selectedLead
    ? users.find((u) => u.id === selectedLead.assigned_to_id)
    : undefined;
  const selectedLastContacted = selectedLead
    ? getLastContactedDate(selectedLead.id, activities)
    : null;
  const selectedActivities = selectedLead
    ? activities
        .filter((a) => a.lead_id === selectedLead.id && !a.deleted_at)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 4)
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leads</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-52"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sources</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Assignees</SelectItem>
              {users
                .filter((u) => u.role === "ADVISER")
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {abandonedCount > 0 && (
            <Button
              variant={showAbandoned ? "destructive" : "outline"}
              size="sm"
              onClick={() => setShowAbandoned(!showAbandoned)}
              className="gap-1.5 text-xs"
            >
              {showAbandoned ? "Hide Abandoned" : `Show Abandoned (${abandonedCount})`}
            </Button>
          )}
        </div>
        {canEdit(currentUser) && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Lead
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads found"
          description="Create your first lead or adjust filters."
          action={
            canEdit(currentUser)
              ? { label: "New Lead", onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Last Contacted</TableHead>
                {canEdit(currentUser) && <TableHead className="w-16">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => {
                const assignee = users.find(
                  (u) => u.id === lead.assigned_to_id,
                );
                const lastContacted = getLastContactedDate(lead.id, activities);
                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <TableCell className="font-medium">
                      {lead.first_name} {lead.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {lead.email || "..."}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {lead.phone || "..."}
                    </TableCell>
                    <TableCell>
                      <LeadStatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </TableCell>
                    <TableCell className="text-xs">
                      {assignee ? (
                        <Link
                          to={`/team/${assignee.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-primary hover:underline"
                        >
                          {assignee.name}
                        </Link>
                      ) : (
                        "..."
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lastContacted ? (
                        formatDate(lastContacted)
                      ) : (
                        <span className="text-orange-500">Never</span>
                      )}
                    </TableCell>
                    {canEdit(currentUser) && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            {STATUSES.filter((s) => s !== lead.status).map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => {
                                  if (!currentUser) return;
                                  updateLeadMutation.mutate({ id: lead.id, payload: { status: s }, userId: currentUser.id });
                                }}
                              >
                                <LeadStatusBadge status={s} />
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLeadId(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          {selectedLead && (
            <div className="space-y-5">
              <SheetHeader className="pr-8">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SheetTitle>
                      {selectedLead.first_name} {selectedLead.last_name}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <LeadStatusBadge status={selectedLead.status} />
                      <span className="text-sm text-muted-foreground">
                        {selectedLead.source.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <Button asChild variant="outline" title="Open detail page">
                    <Link to={`/leads/${selectedLead.id}`}>
                      <ExternalLink className="h-4 w-4" />
                      Details
                    </Link>
                  </Button>
                </div>
              </SheetHeader>

              <div className="rounded-lg border p-3 text-sm space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Lead Details
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    {selectedLead.email || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    {selectedLead.phone || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Assignee:</span>{" "}
                    {selectedAssignee ? (
                      <Link
                        to={`/team/${selectedAssignee.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {selectedAssignee.name}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {formatDate(selectedLead.created_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Last Contacted:
                    </span>{" "}
                    {selectedLastContacted
                      ? formatDate(selectedLastContacted)
                      : "Never"}
                  </div>
                </div>
                {selectedLead.notes && (
                  <p className="text-xs text-foreground pt-1">
                    {selectedLead.notes}
                  </p>
                )}
              </div>

              <div className="rounded-lg border p-3 text-sm space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Recent Activity
                </p>
                {selectedActivities.length > 0 ? (
                  selectedActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="rounded-md border p-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          {activity.subject}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(
                            activity.completed_at || activity.created_at,
                          )}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1">
                        {activity.type}
                        {activity.result ? ` Â· ${activity.result}` : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No activity recorded for this lead.
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>First Name *</Label>
              <Input
                value={form.first_name}
                onChange={(e) =>
                  setForm({ ...form, first_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Last Name *</Label>
              <Input
                value={form.last_name}
                onChange={(e) =>
                  setForm({ ...form, last_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
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
                      {SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.first_name || !form.last_name}
            >
              Create Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog (Task #14) */}
      <LeadImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
