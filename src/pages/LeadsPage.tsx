import { useState, useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarCheck, Clock, ExternalLink, MoreHorizontal, Phone, PhoneCall, Plus, Trash2, Upload, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/useAuthStore";
import { useActivities } from "@/hooks/useActivities";
import { useLeads, useCreateLead, useClaimLeadsForCall, useBulkDeleteLeads, useBulkUpdateLeadStatus } from "@/hooks/useLeads";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/store/useToastStore";
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
import { flyDotToNav } from "@/lib/flyToNav";
import { getLastContactedDate } from "@/lib/selectors";
import { canEdit, canLogActivity, isMaster, isAdviser, isTelemarketer, isColdCaller } from "@/lib/permissions";
import { Link, useNavigate } from "react-router-dom";
import type { LeadStatus, LeadSource } from "@/data/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadImportDialog } from "@/components/leads/LeadImportDialog";
import { StatusUpdateModal } from "@/components/leads/StatusUpdateModal";
import { AppointmentModal } from "@/components/leads/AppointmentModal";
import { CallbackModal } from "@/components/leads/CallbackModal";

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
  COOLDOWN: "Cooldown",
};

const PAGE_SIZE = 25;

type SortKey = "name" | "status" | "source" | "lastContacted" | "created";

function SortHead({
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="-ml-1 flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
      >
        {label}
        {active ? (
          dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}

export function LeadsPage() {
  const { data: activities = [] } = useActivities();
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();

  // Real Supabase data — RLS scopes by role automatically
  const { data: leads = [], isLoading: leadsLoading, isError: leadsError, error: leadsErrorObj } = useLeads({ includeAbandoned: true });
  const createLeadMutation = useCreateLead();
  const claimLeadsForCall = useClaimLeadsForCall();
  const startSession = useCallSessionStore((s) => s.startSession);
  const canCall = isColdCaller(currentUser);
  const bulkDelete = useBulkDeleteLeads();
  const bulkStatus = useBulkUpdateLeadStatus();

  // ── Bulk selection ───────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const clearSelection = () => setSelectedIds(new Set());
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Single-lead "Call" — dial one specific person without pulling a whole session.
  // Best-effort soft-lock (no-op if the lead isn't in the claimable pool), then
  // open a one-lead calling session so the TM gets the call sheet + outcome log.
  const handleCall = (lead: typeof leads[0]) => {
    if (!currentUser) return;
    claimLeadsForCall.mutate({ leadIds: [lead.id], userId: currentUser.id });
    startSession([lead]);
  };

  // Pending status change — set when user picks a new status; clears after modal closes
  const [pendingStatus, setPendingStatus] = useState<{ lead: typeof leads[0]; status: LeadStatus } | null>(null);
  // Pending appointment — separate modal for the convert-lead flow
  const [appointmentLead, setAppointmentLead] = useState<typeof leads[0] | null>(null);
  // Lead whose callback is being scheduled / edited
  const [callbackLead, setCallbackLead] = useState<typeof leads[0] | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterSource, setFilterSource] = useState("ALL");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "created", dir: "desc" });
  const [page, setPage] = useState(1);

  // Row element refs (for the fly-to-Deals animation origin) + the row currently
  // animating out after a lead → deal conversion.
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [exiting, setExiting] = useState<{ id: string; rows: typeof leads } | null>(null);
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

  // RLS already scopes by role at DB level — just strip soft-deleted rows
  const scopedLeads = leads.filter((l) => !l.deleted_at);

  // APPOINTMENT leads have been handed off to Deals — hide them here
  const preAppointmentLeads = scopedLeads.filter((l) => l.status !== "APPOINTMENT");

  // Abandon filter — hide abandoned leads by default (Task #5). AVOID is the
  // abandon mechanism (the DB trigger sets is_abandoned), so treat an AVOID-status
  // lead as abandoned immediately — this keeps the optimistic status flip in sync
  // with the row's removal instead of waiting for the refetched is_abandoned flag.
  const isAbandoned = (l: typeof leads[0]) => l.is_abandoned || l.status === "AVOID";
  const liveLeads = preAppointmentLeads.filter((l) =>
    showAbandoned ? true : !isAbandoned(l)
  );

  const lastContactedAt = (lead: typeof liveLeads[0]) => {
    const d = getLastContactedDate(lead.id, activities, lead);
    return d ? new Date(d).getTime() : 0;
  };

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
      return true;
    })
    .sort((a, b) => {
      const mult = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "name":
          return mult * `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        case "status":
          return mult * a.status.localeCompare(b.status);
        case "source":
          return mult * a.source.localeCompare(b.source);
        case "lastContacted":
          return mult * (lastContactedAt(a) - lastContactedAt(b));
        case "created":
        default: {
          // For TM on the default sort: recently bounced (no-show) NA leads float up so they recall first
          if (isTelemarketer(currentUser)) {
            const aBounced = a.last_bounced_at && a.status === "NA" ? new Date(a.last_bounced_at).getTime() : 0;
            const bBounced = b.last_bounced_at && b.status === "NA" ? new Date(b.last_bounced_at).getTime() : 0;
            if (aBounced !== bBounced) return bBounced - aBounced;
          }
          return mult * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }
      }
    });

  const selectedLeads = filtered.filter((lead) => selectedIds.has(lead.id));
  const abandonedCount = scopedLeads.filter(isAbandoned).length;

  // ── Scheduled callbacks board ────────────────────────────────────────────────
  // Leads with a future "call me back" time that haven't been handed off yet.
  // Overdue first, then by time; we surface due + today (the urgent ones).
  const nowMs = Date.now();
  const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
  const callbackLeads = scopedLeads
    .filter(
      (l) =>
        l.callback_at &&
        l.status !== "APPOINTMENT" &&
        !isAbandoned(l) &&
        (isMaster(currentUser) || !l.callback_assigned_to || l.callback_assigned_to === currentUser?.id),
    )
    .sort((a, b) => new Date(a.callback_at!).getTime() - new Date(b.callback_at!).getTime());
  const urgentCallbacks = callbackLeads.filter(
    (l) => new Date(l.callback_at!).getTime() <= nowMs || isToday(l.callback_at!),
  );
  const laterCallbackCount = callbackLeads.length - urgentCallbacks.length;

  // ── Bulk selection derivations + actions ─────────────────────────────────────
  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));
  const someFilteredSelected = selectedIds.size > 0 && !allFilteredSelected;
  const toggleAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (filtered.length > 0 && filtered.every((l) => prev.has(l.id))) {
        filtered.forEach((l) => next.delete(l.id)); // all selected → clear them
      } else {
        filtered.forEach((l) => next.add(l.id));
      }
      return next;
    });

  const runBulkDelete = () => {
    if (selectedIds.size === 0) return;
    bulkDelete.mutate([...selectedIds], {
      onSuccess: ({ ok, failed }) => {
        clearSelection();
        setConfirmBulkDelete(false);
        if (failed > 0) toast.error(`Deleted ${ok}; ${failed} couldn't be deleted (not yours).`);
        else toast.success(`Deleted ${ok} lead${ok === 1 ? "" : "s"}.`);
      },
      onError: (e) => toast.error(`Bulk delete failed: ${e instanceof Error ? e.message : "unknown error"}`),
    });
  };

  const runBulkStatus = (status: LeadStatus) => {
    if (selectedIds.size === 0 || !currentUser) return;
    bulkStatus.mutate(
      { ids: [...selectedIds], status, userId: currentUser.id },
      {
        onSuccess: ({ ok, failed }) => {
          clearSelection();
          if (failed > 0) toast.error(`Updated ${ok}; ${failed} failed.`);
          else toast.success(`Updated ${ok} lead${ok === 1 ? "" : "s"} to ${STATUS_LABELS[status]}.`);
        },
        onError: (e) => toast.error(`Bulk update failed: ${e instanceof Error ? e.message : "unknown error"}`),
      },
    );
  };

  const runBulkCall = () => {
    if (!currentUser || selectedLeads.length === 0) return;
    const queue = selectedLeads;

    claimLeadsForCall.mutate(
      { leadIds: queue.map((lead) => lead.id), userId: currentUser.id },
      {
        onError: (e) =>
          toast.error(`Could not lock selected leads: ${e instanceof Error ? e.message : "unknown error"}`),
      },
    );
    startSession(queue);
    clearSelection();
    toast.success(`Started call session with ${queue.length} lead${queue.length === 1 ? "" : "s"}.`);
  };

  // Reset to page 1 + clear selection whenever any filter or sort changes
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, filterStatus, filterSource, showAbandoned, sort]);

  // While a row animates out (conversion), freeze the displayed rows so the
  // exiting row keeps its place until the animation finishes.
  const displayLeads = exiting ? exiting.rows : filtered;
  const totalPages = Math.max(1, Math.ceil(displayLeads.length / PAGE_SIZE));
  const paginatedLeads = displayLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  // Fade a row out (freezing the list so siblings hold their place), then fly a
  // dot to a nav tab. Once the fade finishes we unfreeze and the row is gone —
  // the rows below shift up to fill the gap.
  const animateRowExit = (leadId: string, navHref: string) => {
    const el = rowRefs.current[leadId];
    flyDotToNav(el, navHref);
    setExiting({ id: leadId, rows: filtered });
    const done = () => setExiting(null);
    if (el) {
      const anim = el.animate(
        [
          { opacity: 1, transform: "translateX(0)" },
          { opacity: 0, transform: "translateX(24px)" },
        ],
        { duration: 450, easing: "ease-in", fill: "forwards" },
      );
      anim.onfinish = done;
    } else {
      setTimeout(done, 450);
    }
  };

  // Lead → Deal conversion: fly a dot to the Deals tab and fade the row out.
  const handleConverted = (leadId: string) => animateRowExit(leadId, "/deals");

  // Will changing this lead to `newStatus` drop it out of the currently visible
  // list? (AVOID gets abandoned & hidden; an active status filter no longer matches.)
  const willLeaveList = (newStatus: LeadStatus) => {
    if (newStatus === "AVOID" && !showAbandoned) return true;
    if (filterStatus !== "ALL" && newStatus !== filterStatus) return true;
    return false;
  };

  // After a status change from the action dropdown: only animate the fly-out when
  // the lead actually leaves the list — otherwise it just updates its badge in place.
  const handleStatusUpdated = (leadId: string, newStatus: LeadStatus) => {
    if (willLeaveList(newStatus)) animateRowExit(leadId, "/deals");
  };

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
  const selectedLastContacted = selectedLead
    ? getLastContactedDate(selectedLead.id, activities, selectedLead)
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

      {/* Scheduled callbacks — due + today, surfaced for urgency */}
      {urgentCallbacks.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <PhoneCall className="h-4 w-4" />
            Callbacks due
            <span className="rounded-full bg-amber-500/20 px-1.5 text-xs">{urgentCallbacks.length}</span>
          </div>
          <ul className="space-y-1.5">
            {urgentCallbacks.map((lead) => {
              const t = new Date(lead.callback_at!);
              const overdue = t.getTime() <= nowMs;
              return (
                <li
                  key={lead.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-2.5 py-1.5 text-sm"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => setCallbackLead(lead)}
                    title="Reschedule callback"
                  >
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                        overdue
                          ? "bg-red-500/15 text-red-600 dark:text-red-400"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {overdue ? "Due now" : t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span className="truncate font-medium">{lead.first_name} {lead.last_name}</span>
                    {lead.callback_note && (
                      <span className="truncate text-xs text-muted-foreground">— {lead.callback_note}</span>
                    )}
                  </button>
                  {canCall && (
                    <Button
                      size="sm"
                      className="h-7 gap-1.5 bg-green-600 text-xs hover:bg-green-700"
                      onClick={() => handleCall(lead)}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {laterCallbackCount > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              + {laterCallbackCount} scheduled for later
            </p>
          )}
        </div>
      )}

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
        {(canEdit(currentUser) || isTelemarketer(currentUser)) && (
          <div className="flex gap-2">
            {canEdit(currentUser) && (
              <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
            )}
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Lead
            </Button>
          </div>
        )}
      </div>

      {/* Error banner — helps diagnose RLS / auth issues */}
      {leadsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load leads: {leadsErrorObj?.message ?? "Unknown error"}
        </div>
      )}

      {/* Bulk action bar — visible when rows are selected */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select onValueChange={(v) => runBulkStatus(v as LeadStatus)}>
              <SelectTrigger className="h-8 w-40 text-xs" disabled={bulkStatus.isPending}>
                <SelectValue placeholder={bulkStatus.isPending ? "Updating…" : "Set status…"} />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canCall && (
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-green-600 text-xs hover:bg-green-700"
                disabled={selectedLeads.length === 0 || claimLeadsForCall.isPending}
                onClick={runBulkCall}
              >
                <Phone className="h-3.5 w-3.5" />
                Call
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={bulkDelete.isPending}
              onClick={() => setConfirmBulkDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {bulkDelete.isPending ? "Deleting…" : "Delete"}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {leadsLoading ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Last Contacted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads found"
          description="Create your first lead or adjust filters."
          action={
            canEdit(currentUser) || isTelemarketer(currentUser)
              ? { label: "New Lead", onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all leads"
                  />
                </TableHead>
                <SortHead label="Name" sortKey="name" active={sort.key === "name"} dir={sort.dir} onSort={toggleSort} />
                <TableHead>Phone</TableHead>
                <SortHead label="Status" sortKey="status" active={sort.key === "status"} dir={sort.dir} onSort={toggleSort} />
                <SortHead label="Source" sortKey="source" active={sort.key === "source"} dir={sort.dir} onSort={toggleSort} />
                <SortHead label="Last Contacted" sortKey="lastContacted" active={sort.key === "lastContacted"} dir={sort.dir} onSort={toggleSort} />
                {canLogActivity(currentUser) && <TableHead className="w-16">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.map((lead) => {
                const lastContacted = getLastContactedDate(lead.id, activities, lead);
                return (
                  <TableRow
                    key={lead.id}
                    ref={(el) => { rowRefs.current[lead.id] = el; }}
                    className={`cursor-pointer ${selectedIds.has(lead.id) ? "bg-muted/40" : ""}`}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleOne(lead.id)}
                        aria-label={`Select ${lead.first_name} ${lead.last_name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {lead.first_name} {lead.last_name}
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
                    <TableCell className="text-xs text-muted-foreground">
                      {lastContacted ? (
                        formatDate(lastContacted)
                      ) : (
                        <span className="text-orange-500">Never</span>
                      )}
                    </TableCell>
                    {canLogActivity(currentUser) && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                        {canCall && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700"
                            title="Call this lead now"
                            onClick={(e) => { e.stopPropagation(); handleCall(lead); }}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={`Lead actions for ${lead.first_name} ${lead.last_name}`}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            {STATUSES.filter((s) => s !== lead.status).map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => setPendingStatus({ lead, status: s })}
                              >
                                <LeadStatusBadge status={s} />
                              </DropdownMenuItem>
                            ))}
                            {lead.status !== "APPOINTMENT" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => setCallbackLead(lead)}
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                  {lead.callback_at ? "Edit callback" : "Schedule callback"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2 font-medium text-primary focus:text-primary"
                                  onClick={() => setAppointmentLead(lead)}
                                >
                                  <CalendarCheck className="h-3.5 w-3.5" />
                                  Move to Appointment
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
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

      {/* Status update modal — opens when user picks a new status from the action dropdown */}
      {pendingStatus && (
        <StatusUpdateModal
          lead={pendingStatus.lead}
          newStatus={pendingStatus.status}
          open={!!pendingStatus}
          onClose={() => setPendingStatus(null)}
          onUpdated={handleStatusUpdated}
        />
      )}

      {/* Appointment modal — convert lead to contact + deal */}
      {appointmentLead && (
        <AppointmentModal
          lead={appointmentLead}
          open={!!appointmentLead}
          onClose={() => setAppointmentLead(null)}
          onConverted={handleConverted}
        />
      )}

      {/* Callback modal — schedule a "call me back at 2PM" follow-up */}
      {callbackLead && (
        <CallbackModal
          lead={callbackLead}
          open={!!callbackLead}
          onClose={() => setCallbackLead(null)}
        />
      )}

      {/* Bulk delete confirmation */}
      <Dialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} lead{selectedIds.size === 1 ? "" : "s"}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the selected leads from your list. You can only delete leads you own —
            any others in the selection are skipped.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={runBulkDelete} disabled={bulkDelete.isPending}>
              {bulkDelete.isPending ? "Deleting…" : `Delete ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
