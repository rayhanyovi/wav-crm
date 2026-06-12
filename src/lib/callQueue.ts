// Tunable knobs for the TM "Start Calling" pool. Bump these as the team grows.

/** Max number of leads pulled into a single TM calling session. */
export const CALL_SESSION_SIZE = 15;

/** Days a "Rejected / Not interested for now" lead sits in cooldown before
 *  it's eligible to be called again. */
export const COOLDOWN_DAYS = 14;
