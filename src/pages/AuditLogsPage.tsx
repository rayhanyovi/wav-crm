import { useState } from "react";
import { Shield } from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  CONVERT: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  STAGE_CHANGE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  LOGIN: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  LOGOUT: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  COMPLETE: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

const ENTITY_TYPES = ["contact", "lead", "deal", "activity", "product", "bundle", "user"] as const;
const ACTIONS = ["CREATE", "UPDATE", "DELETE", "CONVERT", "STAGE_CHANGE", "LOGIN", "LOGOUT", "COMPLETE"] as const;

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Active" : "Inactive";
  if (typeof value === "number") return value.toLocaleString("id-ID");
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (value === null || value === undefined || value === "") return "N/A";
  return String(value).replaceAll("_", " ");
}

function formatAuditDetails(metadata: Record<string, unknown> | undefined): string {
  if (!metadata || Object.keys(metadata).length === 0) return "No additional details";

  const name = typeof metadata.name === "string" ? metadata.name : undefined;
  const title = typeof metadata.title === "string" ? metadata.title : undefined;
  const subject = typeof metadata.subject === "string" ? metadata.subject : undefined;
  const type = typeof metadata.type === "string" ? metadata.type.replaceAll("_", " ") : undefined;
  const from = metadata.from !== undefined ? formatValue(metadata.from) : undefined;
  const to = metadata.to !== undefined ? formatValue(metadata.to) : undefined;
  const reason = typeof metadata.reason === "string" ? metadata.reason : undefined;
  const statusChange = typeof metadata.status_change === "string" ? metadata.status_change.replace("->", "to") : undefined;

  if (type && subject) return `${type}: ${subject}`;
  if (title && typeof metadata.value === "number") return `${title} (${formatCurrency(metadata.value)})`;
  if (title) return title;
  if (name && statusChange) return `${name}: status changed from ${statusChange}`;
  if (name) return name;
  if (from && to && reason) return `Changed from ${from} to ${to}. Reason: ${reason}`;
  if (from && to) return `Changed from ${from} to ${to}`;
  if (typeof metadata.field === "string" && to) return `${metadata.field.replaceAll("_", " ")} changed to ${to}`;
  if (metadata.action === "complete" && metadata.result) return `Marked complete with result: ${formatValue(metadata.result)}`;
  if (metadata.contact_id) return `Converted to contact ${formatValue(metadata.contact_id)}`;

  return Object.entries(metadata)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${formatValue(value)}`)
    .join(" · ");
}

function getEntityHref(entityType: string, entityId: string): string | null {
  const routes: Record<string, string> = {
    lead: "leads",
    contact: "contacts",
    deal: "deals",
    activity: "activities",
    product: "products",
    bundle: "bundles",
    user: "team",
  };
  const route = routes[entityType];
  return route ? `/${route}/${entityId}` : null;
}

export function AuditLogsPage() {
  const { data: users = [] } = useUsers();
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState("ALL");
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterEntity, setFilterEntity] = useState("ALL");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useAuditLogs({
    page,
    pageSize: 25,
    search,
    userId: filterUser === "ALL" ? undefined : filterUser,
    action: filterAction,
    entityType: filterEntity,
  });

  const logs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const user = users.find((u) => u.id === l.user_id);
    return (
      l.entity_type.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.entity_id.toLowerCase().includes(q) ||
      !!user?.name.toLowerCase().includes(q) ||
      JSON.stringify(l.metadata ?? {}).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-40"><SelectValue placeholder="User" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Users</SelectItem>
            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={(value) => setFilterAction(value)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Actions</SelectItem>
            {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Entities</SelectItem>
            {ENTITY_TYPES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2 rounded-lg border p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState icon={Shield} title="Could not load audit logs" description="Try refreshing the page." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Shield} title="No audit logs" description="Actions taken in the system will appear here." />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => {
                const user = users.find((u) => u.id === log.user_id);
                const actionColor = ACTION_COLORS[log.action] || ACTION_COLORS.UPDATE;
                const entityHref = getEntityHref(log.entity_type, log.entity_id);
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.created_at)}</TableCell>
                    <TableCell className="text-xs font-medium">
                      {user ? (
                        <Link to={`/team/${user.id}`} className="text-primary hover:underline">
                          {user.name}
                        </Link>
                      ) : (
                        "System"
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionColor}`}>
                        {log.action.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {entityHref ? (
                        <Link to={entityHref} className="hover:underline">
                          <Badge variant="outline" className="text-xs capitalize">{log.entity_type}</Badge>
                        </Link>
                      ) : (
                        <Badge variant="outline" className="text-xs capitalize">{log.entity_type}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-sm truncate">
                      {formatAuditDetails(log.metadata)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Page {page} of {totalPages} · {filtered.length} visible · {total} total
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
