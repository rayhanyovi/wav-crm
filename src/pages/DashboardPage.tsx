import { useMemo, type ReactNode } from "react";
import { Phone, PhoneCall, PhoneIncoming, Users, CalendarDays, Bell, TrendingUp, CalendarPlus } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useUsers } from "@/hooks/useUsers";
import { useLeads } from "@/hooks/useLeads";
import { useActivities } from "@/hooks/useActivities";
import { useNotifications } from "@/hooks/useNotifications";
import { useCallSessions } from "@/hooks/useCallSessions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadStatusBadge, ActivityTypeBadge, RoleBadge } from "@/components/common/StatusBadge";
import { formatDuration, formatRelative } from "@/lib/format";
import { getTodayCallStats } from "@/lib/selectors";
import { canManage, isAdviser, isTelemarketer } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { buildGoogleCalendarUrl } from "@/lib/calendar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { LeadStatus } from "@/data/types";

const STATUS_COLORS: Record<LeadStatus, string> = {
  NA:             "#64748b",
  APPOINTMENT:    "#2563eb",
  NOT_INTERESTED: "#d97706",
  AVOID:          "#dc2626",
  KIV:            "#f59e0b",
  OTHERS:         "#9333ea",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NA:             "NA",
  APPOINTMENT:    "Appointment",
  NOT_INTERESTED: "Not Interested",
  AVOID:          "Avoid",
  KIV:            "KIV",
  OTHERS:         "Others",
};

function StatCard({
  icon, label, value, sub, tone = "slate",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "sky" | "violet" | "teal" | "emerald" | "amber" | "rose" | "slate" | "indigo";
}) {
  const toneClass: Record<string, string> = {
    sky:     "text-sky-600 bg-sky-100 dark:text-sky-400 dark:bg-sky-950/40",
    violet:  "text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-950/40",
    teal:    "text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-950/40",
    emerald: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40",
    amber:   "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40",
    rose:    "text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-950/40",
    slate:   "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800",
    indigo:  "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/40",
  };
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-0.5">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn("rounded-lg p-2 shrink-0", toneClass[tone])}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data: activities = [] } = useActivities();
  const { data: users = [] } = useUsers();
  const { data: leads = [] } = useLeads({ includeAbandoned: true });
  const { currentUser } = useAuthStore();
  const { data: notifications = [] } = useNotifications(currentUser?.id, 50);
  const { data: callSessions = [] } = useCallSessions({ userId: currentUser?.id });

  const isManager = canManage(currentUser);
  const isAdviserUser = isAdviser(currentUser);
  const isTele = isTelemarketer(currentUser);

  // Today's call stats
  const { callsMade, pickups, totalDurationSeconds } = useMemo(
    () => getTodayCallStats(activities, currentUser?.id || "", callSessions),
    [activities, currentUser, callSessions]
  );

  const answerRate = callsMade > 0 ? Math.round((pickups / callsMade) * 100) : 0;

  // My unread notifications
  const myNotifs = notifications.filter((n) => !n.is_read);

  // Lead status breakdown — scoped to current user's leads if not master
  const myLeads = leads.filter((l) => {
    if (!l.deleted_at && !l.is_abandoned) {
      if (isManager) return true;
      return l.assigned_to_id === currentUser?.id || l.telemarketer_owner_id === currentUser?.id;
    }
    return false;
  });

  const STATUSES: LeadStatus[] = ["NA", "APPOINTMENT", "NOT_INTERESTED", "AVOID", "OTHERS"];
  const statusData = STATUSES.map((s) => ({
    name: STATUS_LABELS[s],
    count: myLeads.filter((l) => l.status === s).length,
    status: s,
  }));

  // Upcoming appointments (next 7 days)
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingAppointments = myLeads
    .filter((l) => l.status === "APPOINTMENT" && l.appointment_date)
    .filter((l) => {
      const d = new Date(l.appointment_date!);
      return d >= now && d <= sevenDays;
    })
    .sort((a, b) => new Date(a.appointment_date!).getTime() - new Date(b.appointment_date!).getTime())
    .slice(0, 5);

  // Recent activities (scoped)
  const recentActivities = [...activities]
    .filter((a) => isManager || a.created_by === currentUser?.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  // Team stats for master
  const teamStats = isManager
    ? users
        .filter((u) => u.is_active)
        .map((u) => {
          const uActivities = activities.filter((a) => a.created_by === u.id);
          const uCalls = uActivities.filter((a) => a.type === "CALL");
          const uLeads = leads.filter((l) => l.assigned_to_id === u.id && !l.deleted_at);
          return {
            name: u.name.split(" ")[0],
            role: u.role,
            calls: uCalls.length,
            leads: uLeads.length,
            appointments: uLeads.filter((l) => l.status === "APPOINTMENT").length,
          };
        })
        .filter((u) => u.calls > 0 || u.leads > 0)
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Today's call stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard tone="sky"    icon={<Phone className="h-4 w-4" />}        label="Time on Dialer" value={formatDuration(totalDurationSeconds)} sub="today" />
        <StatCard tone="violet" icon={<PhoneCall className="h-4 w-4" />}    label="Calls Made"     value={callsMade.toString()}                sub="today" />
        <StatCard tone="teal"   icon={<PhoneIncoming className="h-4 w-4" />} label="Pickups"        value={pickups.toString()}                  sub={`${answerRate}% answer rate`} />
        <StatCard tone="rose"   icon={<Bell className="h-4 w-4" />}         label="Notifications"  value={myNotifs.length.toString()}          sub="unread" />
      </div>

      {/* Lead summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statusData.map(({ name, count, status }) => (
          <Card key={status}>
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-2xl font-bold">{count}</p>
              <div className="mt-1 flex justify-center">
                <LeadStatusBadge status={status} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status breakdown chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Lead Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={statusData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusData.map(({ status }) => (
                    <Cell key={status} fill={STATUS_COLORS[status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Upcoming appointments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Upcoming Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No appointments in next 7 days</p>
            ) : (
              <div className="space-y-2">
                {upcomingAppointments.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="text-xs font-medium">{lead.appointment_date ? new Date(lead.appointment_date).toLocaleDateString("en-SG", { day: "2-digit", month: "short" }) : "—"}</p>
                      {lead.appointment_time && <p className="text-xs text-muted-foreground">{lead.appointment_time}</p>}
                      {lead.appointment_date && (
                        <a
                          href={buildGoogleCalendarUrl(lead)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                          title="Add to Google Calendar"
                        >
                          <CalendarPlus className="h-2.5 w-2.5" />
                          GCal
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team performance (MASTER only) */}
      {isManager && teamStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="pb-2 text-left font-medium">Member</th>
                    <th className="pb-2 text-left font-medium">Role</th>
                    <th className="pb-2 text-right font-medium">Calls</th>
                    <th className="pb-2 text-right font-medium">Leads</th>
                    <th className="pb-2 text-right font-medium">Appointments</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStats.map((m) => (
                    <tr key={m.name} className="border-b last:border-0">
                      <td className="py-2 font-medium">{m.name}</td>
                      <td className="py-2"><RoleBadge role={m.role} /></td>
                      <td className="py-2 text-right">{m.calls}</td>
                      <td className="py-2 text-right">{m.leads}</td>
                      <td className="py-2 text-right text-blue-600 dark:text-blue-400 font-medium">{m.appointments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
          ) : (
            <div className="space-y-1">
              {recentActivities.map((a) => {
                const agent = users.find((u) => u.id === a.created_by);
                return (
                  <div key={a.id} className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted/50 text-sm">
                    <ActivityTypeBadge type={a.type} className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{a.subject}</p>
                      {a.description && <p className="text-xs text-muted-foreground truncate">{a.description}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">{formatRelative(a.created_at)}</p>
                      {isManager && agent && <p className="text-xs text-muted-foreground">{agent.name.split(" ")[0]}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
