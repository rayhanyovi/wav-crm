import type { Activity, Deal, Lead } from "@/data/types";

export function getLastContactedDate(leadId: string, activities: Activity[]): string | null {
  const leadActivities = activities.filter(
    (a) => a.lead_id === leadId && a.completed_at && !a.deleted_at
  );
  if (!leadActivities.length) return null;
  leadActivities.sort((a, b) =>
    new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
  );
  return leadActivities[0].completed_at ?? null;
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
    if (d.stage === "CLOSED_WON" || d.stage === "CLOSED_LOST") return false;
    return new Date(d.updated_at).getTime() < cutoff;
  });
}

export function getDaysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export function getLeadsForCampaign(
  leads: Lead[],
  campaignId: string,
  userId: string,
  activities: Activity[]
): Lead[] {
  const contactedLeadIds = new Set(
    activities
      .filter((a) => a.campaign_id === campaignId && a.type === "CALL" && !a.deleted_at)
      .map((a) => a.lead_id)
      .filter(Boolean) as string[]
  );
  return leads.filter(
    (l) =>
      l.assigned_to_id === userId &&
      !l.deleted_at &&
      l.status !== "ABANDON" &&
      !l.is_abandoned &&
      !contactedLeadIds.has(l.id)
  );
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

  const todaySessions = callSessions.filter(
    (s) => s.user_id === userId && new Date(s.started_at) >= todayStart
  );
  const totalDurationSeconds = todaySessions.reduce((sum, s) => sum + s.total_duration_seconds, 0);

  return { callsMade, pickups, totalDurationSeconds };
}

export function getCampaignDealConversions(
  activities: Activity[],
  deals: Deal[],
  campaignIds: Set<string>
): Deal[] {
  const convertedDealIds = new Set(
    activities
      .filter((activity) =>
        activity.campaign_id &&
        campaignIds.has(activity.campaign_id) &&
        activity.deal_id &&
        !activity.deleted_at
      )
      .map((activity) => activity.deal_id as string)
  );

  return deals.filter(
    (deal) =>
      convertedDealIds.has(deal.id) &&
      !deal.deleted_at &&
      deal.stage !== "CLOSED_LOST"
  );
}
