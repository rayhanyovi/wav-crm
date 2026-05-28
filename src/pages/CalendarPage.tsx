import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ActivityResultBadge,
  ActivityTypeBadge,
} from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Activity, ActivityType } from "@/data/types";

const ACTIVITY_TYPES: ActivityType[] = [
  "CALL",
  "EMAIL",
  "MEETING",
  "TASK",
  "NOTE",
  "FOLLOW_UP",
];
const STATUS_FILTERS = ["ALL", "SCHEDULED", "COMPLETED"] as const;
type RelatedFilter = "ALL" | "DEALS" | "LEADS" | "CONTACTS" | "UNLINKED";
type RelatedType = "NONE" | "DEAL" | "LEAD" | "CONTACT";

function getActivityDate(activity: Activity): Date {
  return parseISO(
    activity.scheduled_at || activity.completed_at || activity.created_at,
  );
}

function toDateTimeLocalValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function CalendarPage() {
  const { activities, users, deals, leads, contacts, createActivity } =
    useCrmStore();
  const { currentUser } = useAuthStore();

  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [gcalOpen, setGcalOpen] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] =
    useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [filterRelated, setFilterRelated] = useState<RelatedFilter>("ALL");
  const [filterOwner, setFilterOwner] = useState("ALL");
  const [form, setForm] = useState({
    subject: "",
    description: "",
    type: "MEETING" as ActivityType,
    scheduled_at: toDateTimeLocalValue(new Date()),
    assigned_to_id: "",
    related_type: "NONE" as RelatedType,
    related_id: "",
  });

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [visibleMonth]);

  const filteredActivities = useMemo(() => {
    return activities
      .filter((activity) => !activity.deleted_at)
      .filter(
        (activity) => filterType === "ALL" || activity.type === filterType,
      )
      .filter((activity) => {
        if (filterStatus === "SCHEDULED")
          return !!activity.scheduled_at && !activity.completed_at;
        if (filterStatus === "COMPLETED") return !!activity.completed_at;
        return true;
      })
      .filter((activity) => {
        if (filterRelated === "DEALS") return !!activity.deal_id;
        if (filterRelated === "LEADS") return !!activity.lead_id;
        if (filterRelated === "CONTACTS") return !!activity.contact_id;
        if (filterRelated === "UNLINKED")
          return !activity.deal_id && !activity.lead_id && !activity.contact_id;
        return true;
      })
      .filter(
        (activity) =>
          filterOwner === "ALL" ||
          activity.assigned_to_id === filterOwner ||
          activity.created_by === filterOwner,
      );
  }, [activities, filterOwner, filterRelated, filterStatus, filterType]);

  const selectedDayActivities = selectedDate
    ? filteredActivities
        .filter((activity) =>
          isSameDay(getActivityDate(activity), selectedDate),
        )
        .sort(
          (a, b) => getActivityDate(a).getTime() - getActivityDate(b).getTime(),
        )
    : [];

  const relatedOptions = useMemo(() => {
    if (form.related_type === "DEAL")
      return deals
        .filter((deal) => !deal.deleted_at)
        .map((deal) => ({ id: deal.id, label: deal.title }));
    if (form.related_type === "LEAD")
      return leads
        .filter((lead) => !lead.deleted_at)
        .map((lead) => ({
          id: lead.id,
          label: `${lead.first_name} ${lead.last_name}`,
        }));
    if (form.related_type === "CONTACT")
      return contacts
        .filter((contact) => !contact.deleted_at)
        .map((contact) => ({
          id: contact.id,
          label: `${contact.first_name} ${contact.last_name}`,
        }));
    return [];
  }, [contacts, deals, form.related_type, leads]);

  const getRelatedLabel = (activity: Activity) => {
    if (activity.deal_id)
      return deals.find((deal) => deal.id === activity.deal_id)?.title;
    if (activity.lead_id) {
      const lead = leads.find((item) => item.id === activity.lead_id);
      return lead ? `${lead.first_name} ${lead.last_name}` : undefined;
    }
    if (activity.contact_id) {
      const contact = contacts.find((item) => item.id === activity.contact_id);
      return contact ? `${contact.first_name} ${contact.last_name}` : undefined;
    }
    return undefined;
  };

  const getRelatedHref = (activity: Activity) => {
    if (activity.deal_id) return `/deals/${activity.deal_id}`;
    if (activity.lead_id) return `/leads/${activity.lead_id}`;
    if (activity.contact_id) return `/contacts/${activity.contact_id}`;
    return undefined;
  };

  const resetForm = (date = new Date()) => {
    setForm({
      subject: "",
      description: "",
      type: "MEETING",
      scheduled_at: toDateTimeLocalValue(date),
      assigned_to_id: currentUser?.id || "",
      related_type: "NONE",
      related_id: "",
    });
  };

  const openCreateDialog = (date = selectedDate || new Date()) => {
    resetForm(date);
    setCreateOpen(true);
  };

  const handleCreateActivity = () => {
    if (!currentUser || !form.subject.trim()) return;

    createActivity(
      {
        type: form.type,
        subject: form.subject.trim(),
        description: form.description.trim() || undefined,
        scheduled_at: form.scheduled_at
          ? new Date(form.scheduled_at).toISOString()
          : undefined,
        assigned_to_id: form.assigned_to_id || undefined,
        deal_id: form.related_type === "DEAL" ? form.related_id : undefined,
        lead_id: form.related_type === "LEAD" ? form.related_id : undefined,
        contact_id:
          form.related_type === "CONTACT" ? form.related_id : undefined,
        created_by: currentUser.id,
      },
      currentUser.id,
    );
    setCreateOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Track scheduled calls, meetings, follow-ups, tasks, demos, emails,
            and notes.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => setGcalOpen(true)}>
          <RefreshCw className="h-3.5 w-3.5" />
          Sync with Google Calendar
        </Button>
      </div>

      {/* Google Calendar sync — coming soon modal */}
      <Dialog open={gcalOpen} onOpenChange={setGcalOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Google Calendar Sync
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <RefreshCw className="h-7 w-7 text-primary animate-spin [animation-duration:3s]" />
            </div>
            <p className="font-semibold">Feature in Progress</p>
            <p className="text-sm text-muted-foreground">
              Google Calendar integration is currently being built. Stay tuned — two-way sync for meetings and follow-ups is coming soon.
            </p>
          </div>
          <DialogFooter className="justify-center">
            <Button onClick={() => setGcalOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {ACTIVITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterStatus}
            onValueChange={(value) =>
              setFilterStatus(value as typeof filterStatus)
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "ALL" ? "All Statuses" : status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterRelated}
            onValueChange={(value) =>
              setFilterRelated(value as typeof filterRelated)
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Related" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Related</SelectItem>
              <SelectItem value="DEALS">Deals</SelectItem>
              <SelectItem value="LEADS">Leads</SelectItem>
              <SelectItem value="CONTACTS">Contacts</SelectItem>
              <SelectItem value="UNLINKED">Unlinked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Owners</SelectItem>
              {users
                .filter((user) => user.is_active)
                .map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-1.5" onClick={() => openCreateDialog()}>
          <Plus className="h-4 w-4" />
          New Activity
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold">
            {format(visibleMonth, "MMMM yyyy")}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="px-2 py-2 text-center">
              {day}
            </div>
          ))}
        </div>

        {filteredActivities.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No activities in view"
            description="Adjust filters or create a new activity."
          />
        ) : (
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const dayActivities = filteredActivities
                .filter((activity) => isSameDay(getActivityDate(activity), day))
                .sort(
                  (a, b) =>
                    getActivityDate(a).getTime() - getActivityDate(b).getTime(),
                );
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "min-h-32 border-b border-r p-2 text-left align-top transition-colors hover:bg-muted/40",
                    !isSameMonth(day, visibleMonth) &&
                      "bg-muted/20 text-muted-foreground",
                    isSameDay(day, new Date()) && "bg-primary/5",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isSameDay(day, new Date()) &&
                          "rounded-full bg-primary px-2 py-0.5 text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayActivities.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {dayActivities.length}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayActivities.slice(0, 3).map((activity) => (
                      <div
                        key={activity.id}
                        className="rounded border bg-background px-2 py-1 text-[11px] leading-tight shadow-sm"
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-medium">
                            {format(getActivityDate(activity), "HH:mm")}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {activity.type.replace("_", " ")}
                          </span>
                        </div>
                        <p className="truncate font-medium">
                          {activity.subject}
                        </p>
                      </div>
                    ))}
                    {dayActivities.length > 3 && (
                      <p className="px-1 text-[11px] text-muted-foreground">
                        +{dayActivities.length - 3} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Sheet
        open={!!selectedDate}
        onOpenChange={(open) => !open && setSelectedDate(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto"
        >
          {selectedDate && (
            <div className="space-y-5 ">
              <SheetHeader className="pr-8">
                <SheetTitle>
                  {format(selectedDate, "EEEE, d MMM yyyy")}
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedDayActivities.length} activities scheduled or logged.
                </p>
              </SheetHeader>

              <div className="flex flex-col gap-4 items-end">
                <Button
                  className="w-fit gap-1.5"
                  onClick={() => openCreateDialog(selectedDate)}
                >
                  <Plus className="h-4 w-4" />
                  Add Activity on This Day
                </Button>

                {selectedDayActivities.length > 0 ? (
                  <div className="space-y-3 w-full flex-1">
                    {selectedDayActivities.map((activity) => {
                      const relatedLabel = getRelatedLabel(activity);
                      const relatedHref = getRelatedHref(activity);
                      const assignee = users.find(
                        (user) => user.id === activity.assigned_to_id,
                      );
                      return (
                        <div
                          key={activity.id}
                          className="rounded-lg border p-3 text-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                to={`/activities/${activity.id}`}
                                className="block font-semibold truncate text-primary hover:underline"
                              >
                                {activity.subject}
                              </Link>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(
                                  activity.scheduled_at ||
                                    activity.completed_at ||
                                    activity.created_at,
                                )}
                              </p>
                            </div>
                            <ActivityTypeBadge type={activity.type} />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <ActivityResultBadge result={activity.result} />
                            {assignee && (
                              <Link to={`/team/${assignee.id}`} className="hover:underline">
                                <Badge variant="secondary" className="text-xs">
                                  {assignee.name}
                                </Badge>
                              </Link>
                            )}
                          </div>
                          {activity.description && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {activity.description}
                            </p>
                          )}
                          {relatedLabel && relatedHref && (
                            <Link
                              to={relatedHref}
                              className="mt-2 inline-flex text-xs text-primary hover:underline"
                            >
                              {relatedLabel}
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border p-4 text-sm text-muted-foreground w-full items-center text-center">
                    No activities for this day with the current filters.
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Activity</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Subject *</Label>
              <Input
                value={form.subject}
                onChange={(event) =>
                  setForm({ ...form, subject: event.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm({ ...form, type: value as ActivityType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(event) =>
                  setForm({ ...form, scheduled_at: event.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Assigned To</Label>
              <Select
                value={form.assigned_to_id || "UNASSIGNED"}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    assigned_to_id: value === "UNASSIGNED" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                  {users
                    .filter((user) => user.is_active)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Related Type</Label>
              <Select
                value={form.related_type}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    related_type: value as typeof form.related_type,
                    related_id: "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="DEAL">Deal</SelectItem>
                  <SelectItem value="LEAD">Lead</SelectItem>
                  <SelectItem value="CONTACT">Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.related_type !== "NONE" && (
              <div className="space-y-1 col-span-2">
                <Label>Related Record</Label>
                <Select
                  value={form.related_id}
                  onValueChange={(value) =>
                    setForm({ ...form, related_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select record..." />
                  </SelectTrigger>
                  <SelectContent>
                    {relatedOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1 col-span-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateActivity}
              disabled={
                !form.subject.trim() ||
                (form.related_type !== "NONE" && !form.related_id)
              }
            >
              Create Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
