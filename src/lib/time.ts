const TIME_RE = /^(\d{1,2})(?::(\d{1,2}))?$/;
const COMPACT_TIME_RE = /^\d{3,4}$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseTimeInput(input: string): string | null {
  const compact = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!compact) return "";

  const meridiemMatch = compact.match(/(am|pm|a|p)$/);
  const meridiem = meridiemMatch?.[1];
  const timePart = meridiem ? compact.slice(0, -meridiem.length) : compact;

  let hourText: string | undefined;
  let minuteText: string | undefined;

  if (timePart.includes(":")) {
    const match = timePart.match(TIME_RE);
    if (!match) return null;
    hourText = match[1];
    minuteText = match[2] ?? "0";
  } else if (COMPACT_TIME_RE.test(timePart)) {
    hourText = timePart.slice(0, -2);
    minuteText = timePart.slice(-2);
  } else if (/^\d{1,2}$/.test(timePart)) {
    hourText = timePart;
    minuteText = "0";
  } else {
    return null;
  }

  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }

  let normalizedHour = hour;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    const isPm = meridiem.startsWith("p");
    normalizedHour = hour === 12 ? (isPm ? 12 : 0) : isPm ? hour + 12 : hour;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return `${pad2(normalizedHour)}:${pad2(minute)}`;
}

export function formatTimeForInputDisplay(value: string): string {
  const parsed = parseTimeInput(value);
  if (!parsed) return "";

  const [hourText, minuteText] = parsed.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value;

  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${pad2(minute)} ${suffix}`;
}
