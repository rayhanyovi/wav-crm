import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, UserCog } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useUsers, useUpdateUser } from "@/hooks/useUsers";
import { useActivities } from "@/hooks/useActivities";
import { useDeals } from "@/hooks/useDeals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DealStageBadge,
  ActivityTypeBadge,
  ActivityResultBadge,
  RoleBadge,
} from "@/components/common/StatusBadge";
import { formatDateTime, formatDuration } from "@/lib/format";
import { isMaster } from "@/lib/permissions";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const RESULT_COLORS: Record<string, string> = {
  COMPLETED: "#22c55e",
  NO_ANSWER: "#94a3b8",
  FOLLOW_UP_NEEDED: "#f59e0b",
  MEETING_SCHEDULED: "#3b82f6",
  CANCELLED: "#ef4444",
  FAILED: "#dc2626",
};

export function AdvisorPerformancePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: deals = [] } = useDeals();
  const { data: activities = [] } = useActivities();
  const { data: users = [] } = useUsers();
  const updateUserMutation = useUpdateUser();
  const { currentUser } = useAuthStore();
  const [creditAdjust, setCreditAdjust] = useState(0);

  const advisor = users.find((u) => u.id === id);
  if (!advisor)
    return <div className="p-6 text-muted-foreground">User not found.</div>;

  const userActivities = activities.filter((a) => a.created_by === id);
  const calls = userActivities.filter((a) => a.type === "CALL");
  const pickups = calls.filter(
    (a) => a.result !== "NO_ANSWER" && a.result !== "CANCELLED",
  );
  const totalDialerSeconds = calls.reduce(
    (acc, a) => acc + ((a.metadata?.duration_seconds as number) || 0),
    0,
  );
  const conversions = userActivities.filter(
    (a) => a.result === "MEETING_SCHEDULED" || a.result === "COMPLETED",
  );
  const conversionRate =
    pickups.length > 0
      ? Math.round((conversions.length / pickups.length) * 100)
      : 0;
  const pickupRate =
    calls.length > 0 ? Math.round((pickups.length / calls.length) * 100) : 0;

  const userDeals = deals.filter(
    (d) => d.assigned_to_id === id && !d.deleted_at,
  );

  const resultBreakdown = Object.entries(
    calls.reduce<Record<string, number>>((acc, a) => {
      const r = a.result || "UNKNOWN";
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const dealsByStage = [
    "CALLING",
    "APPOINTMENT",
    "PROPOSAL",
    "SUBMITTED",
    "WON",
    "LOST",
  ]
    .map((stage) => ({
      stage,
      count: userDeals.filter((d) => d.stage === stage).length,
    }))
    .filter((d) => d.count > 0);

  const recentActivities = [...userActivities]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 10);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/team")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="text-base">
            {advisor.avatar || advisor.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-bold">{advisor.name}</h1>
          <RoleBadge role={advisor.role} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Calls Made", value: calls.length },
          { label: "Pickups", value: `${pickups.length} (${pickupRate}%)` },
          {
            label: "Conversions",
            value: `${conversions.length} (${conversionRate}%)`,
          },
          { label: "Dialer Time", value: formatDuration(totalDialerSeconds) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold mt-0.5">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resultBreakdown.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Call Outcome Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={resultBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={({
                      name,
                      percent,
                    }: {
                      name?: string;
                      percent?: number;
                    }) =>
                      name && percent != null
                        ? `${name.replace(/_/g, " ")} ${Math.round(percent * 100)}%`
                        : ""
                    }
                    labelLine={false}
                    fontSize={10}
                  >
                    {resultBreakdown.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={RESULT_COLORS[entry.name] || "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, n) => [v, String(n).replace(/_/g, " ")]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {dealsByStage.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Deals by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 pt-2">
                {dealsByStage.map(({ stage, count }) => (
                  <div
                    key={stage}
                    className="flex items-center justify-between"
                  >
                    <DealStageBadge stage={stage as never} />
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Leads module access — MASTER only */}
      {advisor.role === "ADVISER" && isMaster(currentUser) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              Leads Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="leads-access-toggle" className="text-sm font-medium">
                  Allow access to Leads
                </Label>
                <p className="text-xs text-muted-foreground">
                  When disabled, this adviser can't see or manage the Leads module — they only work from Deals.
                </p>
              </div>
              <Switch
                id="leads-access-toggle"
                checked={advisor.leads_access ?? true}
                onCheckedChange={(checked) => {
                  updateUserMutation.mutate({
                    id: advisor.id,
                    payload: { leads_access: checked },
                  });
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Telemarketer access panel — MASTER can manage anyone; ADVISER can manage their own */}
      {advisor.role === "ADVISER" && (isMaster(currentUser) || currentUser?.id === advisor.id) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              Telemarketer Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="tele-toggle" className="text-sm font-medium">
                  Enable Telemarketer Support
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow a telemarketer to call on behalf of this adviser.
                </p>
              </div>
              <Switch
                id="tele-toggle"
                checked={!!advisor.telemarketer_access}
                onCheckedChange={(checked) => {
                  updateUserMutation.mutate({
                    id: advisor.id,
                    payload: {
                      telemarketer_access: checked,
                      telemarketer_id: checked ? advisor.telemarketer_id || null : null,
                    },
                  });
                }}
              />
            </div>

            {advisor.telemarketer_access && (
              <div className="space-y-1.5">
                <Label className="text-sm">Assigned Telemarketer</Label>
                <Select
                  value={advisor.telemarketer_id ?? ""}
                  onValueChange={(v) =>
                    updateUserMutation.mutate({
                      id: advisor.id,
                      payload: { telemarketer_id: v || null },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select telemarketer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter((u) => u.role === "TELEMARKETER" && u.is_active)
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {advisor.telemarketer_id && (
                  <p className="text-xs text-muted-foreground">
                    {users.find((u) => u.id === advisor.telemarketer_id)?.name ?? "Unknown"} can see and call{" "}
                    {advisor.name}'s leads.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Credit balance — shown for ADVISER profiles */}
      {advisor.role === "ADVISER" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lead Credits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{advisor.credit_balance ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Available credits (1 credit = claim 1 unassigned lead)
                </p>
              </div>
            </div>

            {/* MASTER only: adjust credits */}
            {isMaster(currentUser) && (
              <div className="border-t pt-3 space-y-2">
                <Label className="text-sm font-medium">Adjust Credits</Label>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-8 px-0"
                    onClick={() => setCreditAdjust((v) => v - 1)}
                  >
                    −
                  </Button>
                  <Input
                    type="number"
                    value={creditAdjust}
                    onChange={(e) => setCreditAdjust(parseInt(e.target.value) || 0)}
                    className="w-20 text-center"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-8 px-0"
                    onClick={() => setCreditAdjust((v) => v + 1)}
                  >
                    +
                  </Button>
                  <Button
                    size="sm"
                    disabled={creditAdjust === 0 || !currentUser}
                    onClick={() => {
                      if (!currentUser) return;
                      updateUserMutation.mutate({
                        id: advisor.id,
                        payload: { credit_balance: Math.max(0, (advisor.credit_balance ?? 0) + creditAdjust) },
                      });
                      setCreditAdjust(0);
                    }}
                  >
                    Apply
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  New balance after apply: {Math.max(0, (advisor.credit_balance ?? 0) + creditAdjust)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities yet.</p>
          ) : (
            <div className="space-y-2">
              {recentActivities.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 text-sm border-b last:border-0 pb-2 last:pb-0"
                >
                  <ActivityTypeBadge
                    type={a.type}
                    className="shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/activities/${a.id}`}
                        className="font-medium truncate text-primary hover:underline"
                      >
                        {a.subject}
                      </Link>
                      <ActivityResultBadge result={a.result} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(a.completed_at || a.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
