import type { Activity, Deal, Lead } from "@/data/types";

function getActivityDurationSeconds(activity: Activity): number {
  const value = activity.metadata?.duration_seconds;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

export function getLastContactedDate(
  leadId: string,
  activities: Activity[],
  lead?: Pick<Lead, "last_contacted_at">,
): string | null {
  const leadActivities = activities.filter(
    (a) => a.lead_id === leadId && a.completed_at && !a.deleted_at
  );
  leadActivities.sort((a, b) =>
    new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
  );
  const latestActivity = leadActivities[0]?.completed_at ?? null;

  if (lead?.last_contacted_at && latestActivity) {
    return new Date(lead.last_contacted_at) >= new Date(latestActivity)
      ? lead.last_contacted_at
      : latestActivity;
  }
  return lead?.last_contacted_at ?? latestActivity;
}

export function getLeadActivities(leadId: string, activities: Activity[]): Activity[] {
  return activities
    .filter((a) => a.lead_id === leadId && !a.deleted_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getDealActivities(dealId: string, activities: Activity[]): Activity[] {
  return activities
    .filter((a) => a.deal_id === dealId && !a.deleted_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getContactActivities(contactId: string, activities: Activity[]): Activity[] {
  return activities
    .filter((a) => a.contact_id === contactId && !a.deleted_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getStaleDeals(deals: import("@/data/types").Deal[], thresholdDays = 7) {
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
  return deals.filter((d) => {
    if (d.deleted_at) return false;
    if (d.stage === "WON" || d.stage === "LOST") return false;
    return new Date(d.updated_at).getTime() < cutoff;
  });
}

export function getDaysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export function getTodayCallStats(activities: Activity[], userId: string, callSessions: import("@/data/types").CallSession[]) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCalls = activities.filter(
    (a) =>
      a.type === "CALL" &&
      a.created_by === userId &&
      !a.deleted_at &&
      new Date(a.created_at) >= todayStart
  );
  const callsMade = todayCalls.length;
  const pickups = todayCalls.filter((a) => a.result !== "NO_ANSWER").length;
  const activityDurationSeconds = todayCalls.reduce(
    (sum, activity) => sum + getActivityDurationSeconds(activity),
    0,
  );

  const todaySessions = callSessions.filter(
    (s) => s.user_id === userId && new Date(s.started_at) >= todayStart
  );
  const sessionDurationSeconds = todaySessions.reduce((sum, s) => sum + s.total_duration_seconds, 0);
  const totalDurationSeconds = Math.max(activityDurationSeconds, sessionDurationSeconds);

  return { callsMade, pickups, totalDurationSeconds };
}

