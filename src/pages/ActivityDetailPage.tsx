import { useParams, Navigate } from "react-router-dom";
import { useActivity } from "@/hooks/useActivities";

/**
 * Activities are log entries only — they have no standalone detail page.
 * Visiting /activities/:id resolves the activity's related record and
 * redirects to it (deal → lead → contact), falling back to the list.
 */
export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: activity, isLoading, isError } = useActivity(id);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-7xl">
        <div className="h-10 w-48 rounded bg-muted animate-pulse" />
        <div className="h-52 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (isError || !activity) return <Navigate to="/activities" replace />;

  if (activity.deal_id) return <Navigate to={`/deals/${activity.deal_id}`} replace />;
  if (activity.lead_id) return <Navigate to={`/leads/${activity.lead_id}`} replace />;
  if (activity.contact_id) return <Navigate to={`/contacts/${activity.contact_id}`} replace />;

  return <Navigate to="/activities" replace />;
}
