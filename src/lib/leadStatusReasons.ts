import type { LeadStatus, ActivityResult } from "@/data/types";

// Shared between the leads-table "change status" modal (StatusUpdateModal) and
// the telemarketer call-outcome form (CallOutcomeForm) — both write the same
// `reason` into the resulting activity's metadata, so keep them in sync here.

// ─── Reason options per status ────────────────────────────────────────────────
export const STATUS_REASONS: Record<LeadStatus, string[]> = {
  NA: [
    "No answer / rang out",
    "Voicemail Left",
    "Busy / Engaged Tone",
    "Wrong Number",
  ],
  NOT_INTERESTED: [
    "Already Has Coverage / Invested",
    "No Budget Right Now",
    "Not the Right Time",
    "Has Existing Financial Adviser",
    "Language Barrier",
    "Requested Not to Call Again",
  ],
  KIV: [
    "Waiting for Bonus / Payout",
    "Currently Committed Elsewhere",
    "Wants to Review Options First",
    "Follow up needed",
    "Just Started Working",
    "Needs More Information",
  ],
  AVOID: [
    "Hostile / Aggressive",
    "Requested Removal",
    "Wrong Contact / Deceased",
    "Do Not Call (DNC)",
    "Duplicate Lead",
  ],
  OTHERS: [
    "Language Issue",
    "Technical Issue",
    "Referred to Another Channel",
    "Other",
  ],
  APPOINTMENT: [],
  COOLDOWN: [],
};

// Auto-set activity result based on status (stored silently — not shown in UI)
export const AUTO_RESULT: Record<LeadStatus, ActivityResult> = {
  NA:             "NO_ANSWER",
  KIV:            "FOLLOW_UP_NEEDED",
  NOT_INTERESTED: "COMPLETED",
  AVOID:          "FAILED",
  OTHERS:         "COMPLETED",
  APPOINTMENT:    "MEETING_SCHEDULED",
  COOLDOWN:       "COMPLETED",
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  NA:             "New",
  KIV:            "KIV",
  NOT_INTERESTED: "Not Interested",
  AVOID:          "Avoid",
  OTHERS:         "Others",
  APPOINTMENT:    "Appointment",
  COOLDOWN:       "Cooldown",
};

// ─── TM call-outcome statuses ─────────────────────────────────────────────────
// The subset of LeadStatus a telemarketer can set right after a call, with
// friendlier copy than the raw status names.
export type TmCallStatus = "NA" | "KIV" | "AVOID" | "NOT_INTERESTED" | "APPOINTMENT" | "OTHERS";

export const TM_STATUS_OPTIONS: { value: TmCallStatus; label: string; description: string }[] = [
  { value: "NA",             label: "No answer attempt",        description: "No pickup, voicemail, busy line, or wrong number — try again later" },
  { value: "KIV",            label: "Interested, Not Ready Yet", description: "They're open to it but need more time — schedule a follow-up" },
  { value: "APPOINTMENT",    label: "Appointment Set",          description: "They agreed to meet with an adviser" },
  { value: "NOT_INTERESTED", label: "Not Interested",           description: "Politely declined for now — not hostile, just not interested" },
  { value: "AVOID",          label: "Not Interested At All",     description: "Asked not to be contacted again, hostile, or wrong contact" },
  { value: "OTHERS",         label: "Something Else",           description: "Language barrier, technical issue, or another reason" },
];
