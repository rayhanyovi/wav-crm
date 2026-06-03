import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, UserPlus } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import {
  useUsers,
  usePendingUsers,
  useApproveUser,
  useRejectUser,
} from "@/hooks/useUsers";
import { useActivities } from "@/hooks/useActivities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleBadge } from "@/components/common/StatusBadge";
import { formatDuration, formatDate } from "@/lib/format";
import type { UserRole } from "@/data/types";
import type { PendingUser } from "@/services/users";

function PendingApprovals() {
  const { data: pending = [], isLoading } = usePendingUsers();
  if (isLoading || pending.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          Pending Approvals
          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {pending.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.map((user) => (
          <PendingRow key={user.id} user={user} />
        ))}
      </CardContent>
    </Card>
  );
}

function PendingRow({ user }: { user: PendingUser }) {
  const approve = useApproveUser();
  const reject = useRejectUser();
  const initialRole =
    user.requested_role === "ADVISER" || user.requested_role === "TELEMARKETER"
      ? (user.requested_role as UserRole)
      : "ADVISER";
  const [role, setRole] = useState<UserRole>(initialRole);
  const busy = approve.isPending || reject.isPending;

  const awaitingProfile = user.account_status === "PENDING_PROFILE";

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{user.name}</p>
          {awaitingProfile && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              hasn't finished onboarding
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Requested: {user.requested_role ?? "—"} · {formatDate(user.created_at)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={busy}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ADVISER">Adviser</SelectItem>
            <SelectItem value="TELEMARKETER">Telemarketer</SelectItem>
            <SelectItem value="MASTER">Master</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="h-8 gap-1"
          disabled={busy}
          onClick={() => approve.mutate({ id: user.id, role })}
        >
          <Check className="h-4 w-4" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => reject.mutate(user.id)}
        >
          <X className="h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}

export function TeamPage() {
  const { deals } = useCrmStore();
  const { data: activities = [] } = useActivities();
  const { data: users = [] } = useUsers();
  const navigate = useNavigate();

  const teamMembers = users.filter((u) => u.is_active);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Team</h1>

      <PendingApprovals />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamMembers.map((member) => {
          const memberActivities = activities.filter((a) => a.created_by === member.id);
          const calls = memberActivities.filter((a) => a.type === "CALL");
          const pickups = calls.filter((a) => a.result !== "NO_ANSWER" && a.result !== "CANCELLED");
          const pickupRate = calls.length > 0 ? Math.round((pickups.length / calls.length) * 100) : 0;
          const dialerSeconds = calls.reduce((acc, a) => acc + ((a.metadata?.duration_seconds as number) || 0), 0);
          const openDeals = deals.filter((d) => d.assigned_to_id === member.id && !d.deleted_at && d.stage !== "WON" && d.stage !== "LOST");
          const wonDeals = deals.filter((d) => d.assigned_to_id === member.id && d.stage === "WON");

          return (
            <Card key={member.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(`/team/${member.id}`)}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-base">{member.avatar || member.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{member.name}</p>
                      <RoleBadge role={member.role} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                </div>
                <div className="mt-4 overflow-hidden rounded-md border">
                  <table className="w-full text-xs">
                    <tbody>
                      {[
                        ["Calls Made", calls.length],
                        ["Pickup Rate", `${pickupRate}%`],
                        ["Dialer Time", formatDuration(dialerSeconds)],
                        ["Open Deals", openDeals.length],
                        ["Total Activities", memberActivities.length],
                        ["Won Deals", wonDeals.length],
                      ].map(([label, value]) => (
                        <tr key={label} className="border-b last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">{label}</td>
                          <td className="px-3 py-2 text-right font-semibold">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
