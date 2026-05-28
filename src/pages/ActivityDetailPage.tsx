import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Paperclip, CheckCircle2 } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ActivityTypeBadge,
  ActivityResultBadge,
} from "@/components/common/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatDateTime, formatRelative } from "@/lib/format";
import { canEdit } from "@/lib/permissions";

export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    activities,
    users,
    deals,
    contacts,
    leads,
    comments,
    addComment,
    updateComment,
    deleteComment,
    completeActivity,
  } = useCrmStore();
  const { currentUser } = useAuthStore();

  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [resultValue, setResultValue] = useState("COMPLETED");

  const activity = activities.find((a) => a.id === id);
  if (!activity)
    return <div className="p-6 text-muted-foreground">Activity not found.</div>;

  const creator = users.find((u) => u.id === activity.created_by);
  const assignee = users.find((u) => u.id === activity.assigned_to_id);
  const deal = activity.deal_id
    ? deals.find((d) => d.id === activity.deal_id)
    : null;
  const contact = activity.contact_id
    ? contacts.find((c) => c.id === activity.contact_id)
    : null;
  const lead = activity.lead_id
    ? leads.find((l) => l.id === activity.lead_id)
    : null;
  const activityComments = comments
    .filter((c) => c.activity_id === activity.id)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  const handleAddComment = () => {
    if (!newComment.trim() || !currentUser) return;
    addComment(activity.id, newComment.trim(), currentUser.id);
    setNewComment("");
  };

  const handleComplete = () => {
    if (!currentUser) return;
    completeActivity(activity.id, resultValue, currentUser.id);
  };

  const duration = activity.metadata?.duration_seconds as number | undefined;
  const prospectValue = activity.metadata?.prospect_value as number | undefined;
  const meetingScheduledAt = activity.metadata?.meeting_scheduled_at as string | undefined;
  const followUpScheduledAt = activity.metadata?.follow_up_scheduled_at as string | undefined;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/activities")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{activity.subject}</h1>
          <div className="flex items-center gap-2 mt-1">
            <ActivityTypeBadge type={activity.type} />
            <ActivityResultBadge result={activity.result} />
          </div>
        </div>
        {!activity.completed_at && canEdit(currentUser) && (
          <div className="flex items-center gap-2">
            <Select value={resultValue} onValueChange={setResultValue}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "COMPLETED",
                  "NO_ANSWER",
                  "FOLLOW_UP_NEEDED",
                  "MEETING_SCHEDULED",
                  "DEAL_ADVANCED",
                  "CANCELLED",
                  "FAILED",
                ].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-1" onClick={handleComplete}>
              <CheckCircle2 className="h-4 w-4" />
              Complete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              <span className="text-muted-foreground">Creator:</span>{" "}
              {creator ? (
                <Link
                  to={`/team/${creator.id}`}
                  className="text-primary hover:underline"
                >
                  {creator.name}
                </Link>
              ) : (
                "System"
              )}
            </p>
            <p>
              <span className="text-muted-foreground">Assigned To:</span>{" "}
              {assignee ? (
                <Link
                  to={`/team/${assignee.id}`}
                  className="text-primary hover:underline"
                >
                  {assignee.name}
                </Link>
              ) : (
                "N/A"
              )}
            </p>
            <p>
              <span className="text-muted-foreground">Scheduled:</span>{" "}
              {formatDateTime(activity.scheduled_at)}
            </p>
            <p>
              <span className="text-muted-foreground">Completed:</span>{" "}
              {formatDateTime(activity.completed_at)}
            </p>
            {duration && (
              <p>
                <span className="text-muted-foreground">Duration:</span>{" "}
                {Math.floor(duration / 60)}m {duration % 60}s
              </p>
            )}
            {prospectValue && (
              <p>
                <span className="text-muted-foreground">Prospect Value:</span>{" "}
                {formatCurrency(prospectValue)}
              </p>
            )}
            {meetingScheduledAt && (
              <p>
                <span className="text-muted-foreground">Meeting Scheduled:</span>{" "}
                {formatDateTime(meetingScheduledAt)}
              </p>
            )}
            {followUpScheduledAt && (
              <p>
                <span className="text-muted-foreground">Follow-up Scheduled:</span>{" "}
                {formatDateTime(followUpScheduledAt)}
              </p>
            )}
            {activity.description && (
              <div className="pt-1">
                <p className="text-muted-foreground">Description</p>
                <p className="mt-0.5">{activity.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Related</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {deal && (
              <p>
                <span className="text-muted-foreground">Deal:</span>{" "}
                <Link
                  to={`/deals/${deal.id}`}
                  className="text-primary hover:underline"
                >
                  {deal.title}
                </Link>
              </p>
            )}
            {contact && (
              <p>
                <span className="text-muted-foreground">Contact:</span>{" "}
                <Link
                  to={`/contacts/${contact.id}`}
                  className="text-primary hover:underline"
                >
                  {contact.first_name} {contact.last_name}
                </Link>
              </p>
            )}
            {lead && (
              <p>
                <span className="text-muted-foreground">Lead:</span>{" "}
                <Link
                  to={`/leads/${lead.id}`}
                  className="text-primary hover:underline"
                >
                  {lead.first_name} {lead.last_name}
                </Link>
              </p>
            )}
            {!deal && !contact && !lead && (
              <p className="text-muted-foreground">No related entities.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Comments ({activityComments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activityComments.map((c) => {
            const commenter = users.find((u) => u.id === c.created_by);
            const isOwn = c.created_by === currentUser?.id;
            return (
              <div key={c.id} className="flex items-start gap-3">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-xs">
                    {commenter?.avatar || commenter?.name?.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {commenter ? (
                      <Link
                        to={`/team/${commenter.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {commenter.name}
                      </Link>
                    ) : (
                      <span className="text-xs font-medium">System</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(c.created_at)}
                    </span>
                  </div>
                  {editingCommentId === c.id ? (
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                        className="text-xs h-7"
                      />
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          updateComment(c.id, editCommentText);
                          setEditingCommentId(null);
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setEditingCommentId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm mt-0.5">{c.text}</p>
                  )}
                  {isOwn && !editingCommentId && (
                    <div className="flex gap-2 mt-0.5">
                      <button
                        onClick={() => {
                          setEditingCommentId(c.id);
                          setEditCommentText(c.text);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {canEdit(currentUser) && (
            <div className="flex gap-2 pt-2 border-t">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="text-sm"
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleAddComment()
                }
              />
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={!newComment.trim()}
              >
                Post
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attachments (UI only) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Paperclip className="h-4 w-4" />
            Attachments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No attachments. (File upload not implemented in this prototype.)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
