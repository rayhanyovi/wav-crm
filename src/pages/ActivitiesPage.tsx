import { useState, useMemo } from "react";
import { Activity } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useUsers } from "@/hooks/useUsers";
import { useLeads } from "@/hooks/useLeads";
import { useActivities } from "@/hooks/useActivities";
import { isTelemarketer, isAdviser, isMaster } from "@/lib/permissions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ActivityTypeBadge,
  ActivityResultBadge,
} from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDate } from "@/lib/format";
import { Link, useNavigate } from "react-router-dom";

const TYPES = ["CALL", "EMAIL", "MEETING", "TASK", "NOTE", "DEMO", "FOLLOW_UP"];

export function ActivitiesPage() {
  const { contacts, deals } = useCrmStore();
  const { data: leads = [] } = useLeads({ includeAbandoned: true });
  const { data: users = [] } = useUsers();
  const { data: activities = [], isLoading, isError } = useActivities();
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");

  // Telemarketer: build the set of lead IDs they can see.
  // Includes their own leads + leads of any adviser who has granted them access.
  const tmLeadIds = useMemo(() => {
    if (!currentUser || !isTelemarketer(currentUser)) return null;
    const linkedAdviser = users.find(
      (u) => u.role === "ADVISER" && u.telemarketer_access && u.telemarketer_id === currentUser.id
    );
    return new Set(
      leads
        .filter((l) => !l.deleted_at && (
          l.telemarketer_owner_id === currentUser.id ||
          l.assigned_to_id === currentUser.id ||
          (linkedAdviser != null && l.assigned_to_id === linkedAdviser.id)
        ))
        .map((l) => l.id)
    );
  }, [leads, users, currentUser]);

  // Adviser: build sets of their own lead IDs and deal IDs
  const adviserLeadIds = useMemo(() => {
    if (!currentUser || !isAdviser(currentUser) || isMaster(currentUser)) return null;
    return new Set(
      leads.filter((l) => !l.deleted_at && (
        l.assigned_to_id === currentUser.id ||
        l.adviser_owner_id === currentUser.id
      )).map((l) => l.id)
    );
  }, [leads, currentUser]);

  const adviserDealIds = useMemo(() => {
    if (!currentUser || !isAdviser(currentUser) || isMaster(currentUser)) return null;
    return new Set(
      deals.filter((d) => !d.deleted_at && d.assigned_to_id === currentUser.id).map((d) => d.id)
    );
  }, [deals, currentUser]);

  const live = activities
    .filter((a) => {
      if (!currentUser) return false;
      // MASTER: sees everything
      if (isMaster(currentUser)) { /* no filter */ }
      // TELEMARKETER: only their own + their leads' activities
      else if (tmLeadIds !== null) {
        const isOwn = a.assigned_to_id === currentUser.id || a.created_by === currentUser.id;
        const isTheirLead = a.lead_id ? tmLeadIds.has(a.lead_id) : false;
        if (!isOwn && !isTheirLead) return false;
      }
      // ADVISER: only activities on their leads, deals, or directly assigned/created by them
      else if (adviserLeadIds !== null) {
        const isOwn = a.assigned_to_id === currentUser.id || a.created_by === currentUser.id;
        const isTheirLead = a.lead_id ? adviserLeadIds.has(a.lead_id) : false;
        const isTheirDeal = a.deal_id ? adviserDealIds!.has(a.deal_id) : false;
        if (!isOwn && !isTheirLead && !isTheirDeal) return false;
      }
      if (search && !a.subject.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filterType !== "ALL" && a.type !== filterType) return false;
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const getRelated = (a: (typeof activities)[0]) => {
    if (a.deal_id) {
      const d = deals.find((x) => x.id === a.deal_id);
      return d ? { label: d.title, href: `/deals/${d.id}` } : null;
    }
    if (a.contact_id) {
      const c = contacts.find((x) => x.id === a.contact_id);
      return c
        ? { label: `${c.first_name} ${c.last_name}`, href: `/contacts/${c.id}` }
        : null;
    }
    if (a.lead_id) {
      const l = leads.find((x) => x.id === a.lead_id);
      return l
        ? { label: `${l.first_name} ${l.last_name}`, href: `/leads/${l.id}` }
        : null;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Activities</h1>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Activities</h1>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Failed to load activities. Please refresh the page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Activities</h1>
      <div className="flex gap-2">
        <Input
          placeholder="Search activities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-52"
        />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {live.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activities"
          description="Activities are logged when calls or meetings are recorded."
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Related</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {live.map((a) => {
                const related = getRelated(a);
                const assignee = users.find((u) => u.id === a.assigned_to_id);
                return (
                  <TableRow
                    key={a.id}
                    className={related ? "cursor-pointer" : ""}
                    onClick={() => related && navigate(related.href)}
                  >
                    <TableCell>
                      <ActivityTypeBadge type={a.type} />
                    </TableCell>
                    <TableCell className="font-medium max-w-56 truncate">
                      {a.subject}
                    </TableCell>
                    <TableCell className="text-xs">
                      {related ? (
                        <Link
                          to={related.href}
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-primary hover:underline"
                        >
                          {related.label}
                        </Link>
                      ) : (
                        "..."
                      )}
                    </TableCell>
                    <TableCell>
                      <ActivityResultBadge result={a.result} />
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
                      {formatDate(a.completed_at || a.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
