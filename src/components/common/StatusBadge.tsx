import { cn } from "@/lib/utils";
import type { LeadStatus, DealStage, ActivityType, ActivityResult, CampaignStatus } from "@/data/types";

const leadStatusColors: Record<LeadStatus, string> = {
  NA:             "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  APPOINTMENT:    "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  NOT_INTERESTED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  ABANDON:        "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  OTHERS:         "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const dealStageColors: Record<DealStage, string> = {
  LEAD: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  QUALIFIED: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  PROPOSAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  NEGOTIATION: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  CLOSED_WON: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  CLOSED_LOST: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const activityTypeColors: Record<ActivityType, string> = {
  CALL:      "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  EMAIL:     "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  MEETING:   "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  TASK:      "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  NOTE:      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  FOLLOW_UP: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
};

const activityResultColors: Record<ActivityResult, string> = {
  COMPLETED:        "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  NO_ANSWER:        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  FOLLOW_UP_NEEDED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  MEETING_SCHEDULED:"bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  CANCELLED:        "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  FAILED:           "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const campaignStatusColors: Record<CampaignStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  PAUSED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  COMPLETED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

interface BadgeProps {
  className?: string;
  label?: string;
}

const badgeClassName = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";

function BadgeDot() {
  return <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />;
}

export function LeadStatusBadge({ status, className }: { status: LeadStatus } & BadgeProps) {
  return (
    <span className={cn(badgeClassName, leadStatusColors[status], className)}>
      <BadgeDot />
      {status}
    </span>
  );
}

export function DealStageBadge({ stage, className }: { stage: DealStage } & BadgeProps) {
  const label = stage.replace("_", " ");
  return (
    <span className={cn(badgeClassName, dealStageColors[stage], className)}>
      <BadgeDot />
      {label}
    </span>
  );
}

export function ActivityTypeBadge({ type, className }: { type: ActivityType } & BadgeProps) {
  return (
    <span className={cn(badgeClassName, activityTypeColors[type], className)}>
      <BadgeDot />
      {type.replace("_", " ")}
    </span>
  );
}

export function ActivityResultBadge({ result, className }: { result: ActivityResult | undefined | null } & BadgeProps) {
  if (!result) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <span className={cn(badgeClassName, activityResultColors[result], className)}>
      <BadgeDot />
      {result.replace(/_/g, " ")}
    </span>
  );
}

export function CampaignStatusBadge({ status, className }: { status: CampaignStatus } & BadgeProps) {
  return (
    <span className={cn(badgeClassName, campaignStatusColors[status], className)}>
      <BadgeDot />
      {status}
    </span>
  );
}

export function RoleBadge({ role, className }: { role: string } & BadgeProps) {
  const colors: Record<string, string> = {
    MASTER:       "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
    ADVISER:      "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    TELEMARKETER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  };
  return (
    <span className={cn(badgeClassName, colors[role] || "bg-gray-100 text-gray-700", className)}>
      <BadgeDot />
      {role}
    </span>
  );
}
