import { type ReactNode, useMemo, useState } from "react";
import { TrendingUp, DollarSign, Trophy, Bell, Phone, PhoneCall, PhoneIncoming, ArrowRight } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DealStageBadge, ActivityTypeBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate, formatRelative, formatDuration } from "@/lib/format";
import { getTodayCallStats, getStaleDeals } from "@/lib/selectors";
import { canManage } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { EntitySheet, type EntitySheetTarget } from "@/components/common/EntitySheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Link } from "react-router-dom";
import type { DealStage } from "@/data/types";

const DEAL_STAGES: DealStage[] = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"];
const STAGE_COLORS: Record<DealStage, string> = {
  LEAD: "#64748b",
  QUALIFIED: "#2563eb",
  PROPOSAL: "#d97706",
  NEGOTIATION: "#ea580c",
  CLOSED_WON: "#16a34a",
  CLOSED_LOST: "#dc2626",
};

export function DashboardPage() {
  const { deals, activities, notifications, users, campaigns, call_sessions } = useCrmStore();
  const { currentUser } = useAuthStore();
  const [sheetTarget, setSheetTarget] = useState<EntitySheetTarget | null>(null);
  const [campaignSort, setCampaignSort] = useState("rate");
  const [campaignFilter, setCampaignFilter] = useState("ALL");
  const isManager = canManage(currentUser);
  const isSales = currentUser?.role === "SALES";

  const liveDeals = deals.filter((d) => !d.deleted_at);
  const openDeals = liveDeals.filter((d) => d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const wonThisMonth = liveDeals.filter(
    (d) => d.stage === "CLOSED_WON" && d.closed_at && new Date(d.closed_at) >= monthStart
  );

  const pipelineValue = openDeals.reduce((sum, d) => sum + d.value, 0);

  const myNotifs = notifications.filter((n) => n.recipient_id === currentUser?.id && !n.is_read);

  const { callsMade, pickups, totalDurationSeconds } = useMemo(
    () => getTodayCallStats(activities, currentUser?.id || "", call_sessions),
    [activities, currentUser, call_sessions]
  );

  // Pipeline chart
  const pipelineData = DEAL_STAGES.map((stage) => {
    const stageDeals = liveDeals.filter((d) => d.stage === stage);
    return { name: stage.replace("_", " "), count: stageDeals.length, value: stageDeals.reduce((s, d) => s + d.value, 0) };
  });

  // Campaign performance
  const campPerf = campaigns.map((camp) => {
    const campActivities = activities.filter((a) => a.campaign_id === camp.id && a.type === "CALL" && !a.deleted_at);
    const calls = campActivities.length;
    const pickupCount = campActivities.filter((a) => a.result !== "NO_ANSWER").length;
    const conversions = campActivities.filter((a) => a.result === "DEAL_ADVANCED" || a.result === "MEETING_SCHEDULED").length;
    return { ...camp, calls, pickups: pickupCount, conversions, rate: calls ? Math.round((conversions / calls) * 100) : 0 };
  }).filter((c) => c.calls > 0);
  const visibleCampPerf = campPerf
    .filter((campaign) => {
      if (campaignFilter === "ALL") return true;
      if (campaignFilter === "ACTIVE") return campaign.status === "ACTIVE";
      if (campaignFilter === "HIGH_CONV") return campaign.rate >= 25;
      return campaign.calls > 0;
    })
    .sort((a, b) => {
      if (campaignSort === "calls") return b.calls - a.calls;
      if (campaignSort === "pickups") return b.pickups - a.pickups;
      if (campaignSort === "conversions") return b.conversions - a.conversions;
      return b.rate - a.rate;
    });

  // Team activity chart
  const teamData = users.filter((u) => u.role === "SALES").map((u) => ({
    name: u.name.split(" ")[0],
    activities: activities.filter((a) => a.created_by === u.id && !a.deleted_at).length,
  }));

  // Recent activities
  const recentActivities = [...activities]
    .filter((a) => !a.deleted_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, isSales ? 8 : 8)
    .filter((a) => (isSales ? a.created_by === currentUser?.id : true));

  // Stale deals
  const staleDeals = getStaleDeals(liveDeals);

  // My summary (SALES)
  const myDeals = liveDeals.filter((d) => d.assigned_to_id === currentUser?.id);
  const myDealsByStage = DEAL_STAGES.map((s) => ({ stage: s, count: myDeals.filter((d) => d.stage === s).length })).filter((x) => x.count > 0);
  const nowISO = new Date().toISOString();
  const myUpcoming = activities.filter((a) => !a.deleted_at && a.assigned_to_id === currentUser?.id && !a.completed_at && a.scheduled_at && a.scheduled_at > nowISO);
  const myOverdue = activities.filter((a) => !a.deleted_at && a.assigned_to_id === currentUser?.id && !a.completed_at && a.scheduled_at && a.scheduled_at <= nowISO);

  const getActivityPersonTarget = (activity: typeof activities[0]): EntitySheetTarget | null => {
    if (activity.contact_id) return { type: "contact", id: activity.contact_id };
    if (activity.lead_id) return { type: "lead", id: activity.lead_id };
    if (activity.deal_id) {
      const deal = deals.find((item) => item.id === activity.deal_id);
      return deal?.contact_id ? { type: "contact", id: deal.contact_id } : null;
    }
    return null;
  };

  const getActivityRowTarget = (activity: typeof activities[0]): EntitySheetTarget => {
    if (activity.deal_id) return { type: "deal", id: activity.deal_id };
    return { type: "activity", id: activity.id };
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard tone="indigo" icon={<TrendingUp className="h-4 w-4" />} label="Total Deals" value={liveDeals.length.toString()} sub={`${openDeals.length} open`} />
        <StatCard tone="emerald" icon={<DollarSign className="h-4 w-4" />} label="Pipeline Value" value={formatCurrency(pipelineValue)} sub="open deals" />
        <StatCard tone="amber" icon={<Trophy className="h-4 w-4" />} label="Won This Month" value={wonThisMonth.length.toString()} sub={formatCurrency(wonThisMonth.reduce((s, d) => s + d.value, 0))} />
        <StatCard tone="rose" icon={<Bell className="h-4 w-4" />} label="Unread Notifications" value={myNotifs.length.toString()} sub="notifications" />
        <StatCard tone="sky" icon={<Phone className="h-4 w-4" />} label="Time on Dialer" value={formatDuration(totalDurationSeconds)} sub="today" />
        <StatCard tone="violet" icon={<PhoneCall className="h-4 w-4" />} label="Calls Made" value={callsMade.toString()} sub="today" />
        <StatCard tone="teal" icon={<PhoneIncoming className="h-4 w-4" />} label="Pickups" value={pickups.toString()} sub={`${callsMade ? Math.round((pickups / callsMade) * 100) : 0}% answer rate`} />
        <StatCard tone="slate" icon={<DollarSign className="h-4 w-4" />} label="Won Value (Month)" value={formatCurrency(wonThisMonth.reduce((s, d) => s + d.value, 0))} sub={`${wonThisMonth.length} deals`} />
      </div>

      {/* Pipeline chart + Campaign perf */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipelineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  cursor={false}
                  formatter={(val, name) => name === "value" ? formatCurrency(val as number) : val}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {pipelineData.map((entry) => (
                    <Cell key={entry.name} fill={STAGE_COLORS[entry.name.replace(" ", "_") as DealStage]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">Campaign Performance</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="HIGH_CONV">High Conv.</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={campaignSort} onValueChange={setCampaignSort}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rate">Rate</SelectItem>
                    <SelectItem value="calls">Calls</SelectItem>
                    <SelectItem value="pickups">Pickups</SelectItem>
                    <SelectItem value="conversions">Conv.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {visibleCampPerf.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No campaign activity yet.</p>
            ) : (
              <div className="space-y-1">
                {visibleCampPerf.map((c) => (
                  <Link
                    key={c.id}
                    to={`/campaigns/${c.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_3.5rem_4rem_4rem_3.5rem] items-center gap-3 rounded-md px-2 py-2 text-xs hover:bg-muted"
                  >
                    <span className="font-medium truncate">{c.name}</span>
                    <span className="text-right text-muted-foreground">{c.calls}</span>
                    <span className="text-right text-muted-foreground">{c.pickups}</span>
                    <span className="text-right text-muted-foreground">{c.conversions}</span>
                    <span className="text-right font-semibold">{c.rate}%</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activities + Stale deals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">Recent Activities</CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <Link to="/activities">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentActivities.slice(0, 8).map((a) => {
                const creator = users.find((u) => u.id === a.created_by);
                const personTarget = getActivityPersonTarget(a);
                return (
                  <div
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSheetTarget(getActivityRowTarget(a))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSheetTarget(getActivityRowTarget(a));
                      }
                    }}
                    className="grid grid-cols-[7rem_minmax(0,1fr)_4rem] items-center gap-3 rounded-md px-2 py-2 text-left text-xs hover:bg-muted/50 transition-colors"
                  >
                    <ActivityTypeBadge type={a.type} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {personTarget ? (
                          <span
                            role="button"
                            tabIndex={0}
                            className="hover:text-primary hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSheetTarget(personTarget);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                setSheetTarget(personTarget);
                              }
                            }}
                          >
                            {a.subject}
                          </span>
                        ) : a.subject}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {creator ? (
                          <span
                            role="button"
                            tabIndex={0}
                            className="hover:text-primary hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSheetTarget({ type: "user", id: creator.id });
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                setSheetTarget({ type: "user", id: creator.id });
                              }
                            }}
                          >
                            {creator.name}
                          </span>
                        ) : "System"} - {formatRelative(a.created_at)}
                      </p>
                    </div>
                    <Link
                      to={`/activities/${a.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="justify-self-end text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                );
              })}
              {recentActivities.length === 0 && <p className="text-sm text-muted-foreground">No activities yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Stale Deals <span className="text-muted-foreground font-normal">(7+ days)</span></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {staleDeals.slice(0, 5).map((d) => {
                const assignee = users.find((u) => u.id === d.assigned_to_id);
                const days = Math.floor((now.getTime() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSheetTarget({ type: "deal", id: d.id })}
                    className="grid w-full grid-cols-[7.5rem_minmax(0,1fr)_4rem] items-center gap-3 rounded-md px-2 py-2 text-left text-xs hover:bg-muted transition-colors"
                  >
                    <DealStageBadge stage={d.stage} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{d.title}</p>
                      <p className="text-muted-foreground truncate">
                        {assignee ? (
                          <span
                            role="button"
                            tabIndex={0}
                            className="hover:text-primary hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSheetTarget({ type: "user", id: assignee.id });
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                setSheetTarget({ type: "user", id: assignee.id });
                              }
                            }}
                          >
                            {assignee.name}
                          </span>
                        ) : "Unassigned"} - {formatCurrency(d.value)}
                      </p>
                    </div>
                    <span className="justify-self-end text-orange-600 dark:text-orange-400 font-medium">{days}d</span>
                  </button>
                );
              })}
              {staleDeals.length === 0 && <p className="text-sm text-muted-foreground">No stale deals. Good job!</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Activity (Manager/Admin) */}
      {isManager && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Team Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={teamData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip cursor={false} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px" }} />
                <Bar dataKey="activities" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* My Summary (SALES) */}
      {isSales && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">My Deals by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              {myDealsByStage.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deals assigned.</p>
              ) : (
                <div className="space-y-1.5">
                  {myDealsByStage.map(({ stage, count }) => (
                    <div key={stage} className="flex items-center justify-between text-sm">
                      <DealStageBadge stage={stage} />
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Upcoming Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {myUpcoming.slice(0, 4).map((a) => (
                  <div key={a.id} className="text-xs border-b last:border-0 pb-1.5 last:pb-0">
                    <p className="font-medium truncate">{a.subject}</p>
                    <p className="text-muted-foreground">{formatDate(a.scheduled_at)}</p>
                  </div>
                ))}
                {myUpcoming.length === 0 && <p className="text-sm text-muted-foreground">None scheduled.</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-orange-600">Overdue Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {myOverdue.slice(0, 4).map((a) => (
                  <div key={a.id} className="text-xs border-b last:border-0 pb-1.5 last:pb-0">
                    <p className="font-medium truncate">{a.subject}</p>
                    <p className="text-red-500">{formatDate(a.scheduled_at)}</p>
                  </div>
                ))}
                {myOverdue.length === 0 && <p className="text-sm text-muted-foreground">None overdue!</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <EntitySheet target={sheetTarget} onClose={() => setSheetTarget(null)} />
    </div>
  );
}

const statToneClasses = {
  indigo: {
    border: "border-l-primary",
    icon: "bg-primary/10 text-primary",
  },
  emerald: {
    border: "border-l-emerald-500",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  amber: {
    border: "border-l-amber-500",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  rose: {
    border: "border-l-rose-500",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  },
  sky: {
    border: "border-l-sky-500",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  },
  violet: {
    border: "border-l-violet-500",
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
  teal: {
    border: "border-l-teal-500",
    icon: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  },
  slate: {
    border: "border-l-slate-500",
    icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

type StatTone = keyof typeof statToneClasses;

function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "indigo",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: StatTone;
}) {
  const toneClasses = statToneClasses[tone];
  return (
    <Card className={cn("overflow-hidden border-l-4", toneClasses.border)}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span className={cn("rounded-lg p-2 [&_svg]:text-current", toneClasses.icon)}>
            {icon}
          </span>
        </div>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
