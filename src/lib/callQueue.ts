// Tunable knobs for the TM "Start Calling" pool. Bump these as the team grows.

import type { Lead } from "@/data/types";

/** Max number of leads pulled into a single TM calling session. */
export const CALL_SESSION_SIZE = 15;

/** Days a "Rejected / Not interested for now" lead sits in cooldown before
 *  it's eligible to be called again. */
export const COOLDOWN_DAYS = 14;

export type AttemptBucket = "ALL" | "NEVER" | "NO_ANSWER_1" | "NO_ANSWER_2" | "FINAL_ATTEMPT";

export const ATTEMPT_BUCKET_OPTIONS: { value: AttemptBucket; label: string }[] = [
  { value: "ALL", label: "All attempts" },
  { value: "NEVER", label: "Never called" },
  { value: "NO_ANSWER_1", label: "1x no answer" },
  { value: "NO_ANSWER_2", label: "2x no answer" },
  { value: "FINAL_ATTEMPT", label: "3x+ no answer" },
];

export function callAttemptCount(lead: Lead): number {
  return lead.call_attempt_count ?? (lead.last_call_attempt_at || lead.last_contacted_at ? 1 : 0);
}

export function noAnswerCount(lead: Lead): number {
  return lead.no_answer_count ?? 0;
}

export function lastCallAttemptTime(lead: Lead): number {
  const value = lead.last_call_attempt_at ?? lead.last_contacted_at;
  return value ? new Date(value).getTime() : 0;
}

export function attemptBucketLabel(lead: Lead): string | null {
  const attempts = callAttemptCount(lead);
  const noAnswers = noAnswerCount(lead);
  if (attempts === 0) return "Never called";
  if (noAnswers === 1) return "1x no answer";
  if (noAnswers === 2) return "2x no answer";
  if (noAnswers >= 3) return "Needs final attempt";
  return null;
}

export function matchesAttemptBucket(lead: Lead, bucket: AttemptBucket): boolean {
  if (bucket === "ALL") return true;
  const attempts = callAttemptCount(lead);
  const noAnswers = noAnswerCount(lead);
  if (bucket === "NEVER") return attempts === 0;
  if (bucket === "NO_ANSWER_1") return noAnswers === 1;
  if (bucket === "NO_ANSWER_2") return noAnswers === 2;
  return noAnswers >= 3;
}

export function isFinalAttemptBucket(lead: Lead): boolean {
  return noAnswerCount(lead) >= 3;
}
