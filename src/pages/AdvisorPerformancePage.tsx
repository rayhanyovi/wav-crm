import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DealStageBadge,
  ActivityTypeBadge,
  ActivityResultBadge,
  RoleBadge,
} from "@/components/common/StatusBadge";
import { formatDateTime, formatDuration } from "@/lib/format";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
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
  const { users, activities, deals, campaigns } = useCrmStore();

  const advisor = users.find((u) => u.id === id);
  if (!advisor)
    return <div className="p-6 text-muted-foreground">User not found.</div>;

  const userActivities = activities.filter(
    (a) => a.created_by === id && !a.deleted_at,
  );
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
    "LEAD",
    "QUALIFIED",
    "PROPOSAL",
    "NEGOTIATION",
    "CLOSED_WON",
    "CLOSED_LOST",
  ]
    .map((stage) => ({
      stage,
      count: userDeals.filter((d) => d.stage === stage).length,
    }))
    .filter((d) => d.count > 0);

  const campaignBreakdown = campaigns
    .map((campaign) => {
      const campCalls = calls.filter((a) => a.campaign_id === campaign.id);
      const campPickups = campCalls.filter(
        (a) => a.result !== "NO_ANSWER" && a.result !== "CANCELLED",
      );
      return {
        name: campaign.name,
        calls: campCalls.length,
        pickups: campPickups.length,
      };
    })
    .filter((c) => c.calls > 0);

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

      {campaignBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={campaignBreakdown}
                margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar
                  dataKey="calls"
                  name="Calls"
                  fill="#3b82f6"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="pickups"
                  name="Pickups"
                  fill="#22c55e"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
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
