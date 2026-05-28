import type { Lead, User } from "@/data/types";

/** Build a Google Calendar "add event" deeplink URL.
 *  Opens calendar.google.com in a new tab with the event pre-filled.
 *  The user clicks Save — no OAuth required.
 */
export function buildGoogleCalendarUrl(lead: Lead, adviser?: User): string {
  if (!lead.appointment_date) return "";

  const dateStr = lead.appointment_date.slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const timeStr = lead.appointment_time?.replace(":", "") || "090000";   // HHMMSS

  // Build ISO start — assume 1-hour duration
  const startDT = `${dateStr}T${timeStr}00`;
  const endHour = String((parseInt(timeStr.slice(0, 2)) + 1) % 24).padStart(2, "0");
  const endDT = `${dateStr}T${endHour}${timeStr.slice(2)}00`;

  const title = encodeURIComponent(
    `Appointment: ${lead.first_name} ${lead.last_name}`
  );
  const details = encodeURIComponent(
    [
      `Lead: ${lead.first_name} ${lead.last_name}`,
      lead.phone ? `Phone: ${lead.phone}` : "",
      lead.email ? `Email: ${lead.email}` : "",
      adviser ? `Adviser: ${adviser.name}` : "",
      lead.notes ? `Notes: ${lead.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  return (
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}` +
    `&dates=${startDT}/${endDT}` +
    `&details=${details}`
  );
}

/** Generate and trigger download of an .ics (iCalendar) file for the appointment. */
export function downloadIcs(lead: Lead, adviser?: User): void {
  if (!lead.appointment_date) return;

  const dateStr = lead.appointment_date.slice(0, 10).replace(/-/g, "");
  const timeStr = lead.appointment_time?.replace(":", "") + "00" || "090000";
  const endHour = String((parseInt(timeStr.slice(0, 2)) + 1) % 24)
    .padStart(2, "0");
  const endTime = `${endHour}${timeStr.slice(2)}`;

  const uid = `wav-appt-${lead.id}-${Date.now()}@wav.sg`;
  const now = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

  const summary = `Appointment: ${lead.first_name} ${lead.last_name}`;
  const description = [
    `Phone: ${lead.phone ?? "N/A"}`,
    `Email: ${lead.email ?? "N/A"}`,
    adviser ? `Adviser: ${adviser.name}` : "",
    lead.notes ? `Notes: ${lead.notes}` : "",
  ]
    .filter(Boolean)
    .join("\\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WAV CRM//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dateStr}T${timeStr}`,
    `DTEND:${dateStr}T${endTime}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appointment-${lead.first_name}-${lead.last_name}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
