import type { User } from "@/data/types";

export interface TourStep {
  selector: string;
  title: string;
  content: string;
}

function tourId(href: string): string {
  return `nav-${href === "/" ? "dashboard" : href.slice(1).replace("/", "-")}`;
}

export function navTourAttr(href: string): Record<string, string> {
  return { "data-tour": tourId(href) };
}

export function getTourSteps(user: User | null): TourStep[] {
  const role = user?.role;

  const activity: TourStep = {
    selector: `[data-tour="${tourId("/activities")}"]`,
    title: "Activities",
    content:
      "Log and review every interaction — calls, meetings, emails, and tasks. The full history of each client relationship lives here.",
  };
  const calendar: TourStep = {
    selector: `[data-tour="${tourId("/calendar")}"]`,
    title: "Calendar",
    content: "Appointments and follow-ups laid out in a calendar view. Great for spotting scheduling gaps.",
  };

  if (role === "TELEMARKETER") {
    return [
      {
        selector: '[data-tour="start-calling"]',
        title: "Start Calling",
        content:
          "Launch a session and work through 15 leads. For each one you can log the outcome, mark a follow-up, or book them for an appointment with an adviser.",
      },
      {
        selector: `[data-tour="${tourId("/leads")}"]`,
        title: "Leads Pool",
        content:
          "Your assigned cold-calling pool. Filter by status or source, search by name, and tap any lead to see its full history.",
      },
      {
        selector: `[data-tour="${tourId("/deals")}"]`,
        title: "Deals",
        content:
          "Every appointment you've booked appears here. Once an adviser claims a deal, they take it through the pipeline from APPOINTMENT → WON.",
      },
      activity,
      calendar,
    ];
  }

  if (role === "ADVISER") {
    return [
      {
        selector: `[data-tour="${tourId("/deals")}"]`,
        title: "Deals Pipeline",
        content:
          "Claim unassigned APPOINTMENT deals (1 credit each), then advance them through PROPOSAL → SUBMITTED → WON. Your credit balance is shown at the top.",
      },
      {
        selector: `[data-tour="${tourId("/contacts")}"]`,
        title: "Contacts",
        content:
          "Full client profiles — fact-find data, all linked deals, and a unified notes feed that pulls notes from every deal into one timeline.",
      },
      activity,
      calendar,
    ];
  }

  if (role === "MASTER") {
    return [
      {
        selector: `[data-tour="${tourId("/")}"]`,
        title: "Dashboard",
        content:
          "Team-wide overview: total pipeline value, stage breakdown, activity volume, and your top performers at a glance.",
      },
      {
        selector: `[data-tour="${tourId("/team")}"]`,
        title: "Team Management",
        content:
          "Approve new joiners, assign roles, grant advisers cold-call access, and delegate a telemarketer to act on an adviser's behalf.",
      },
      {
        selector: `[data-tour="${tourId("/deals")}"]`,
        title: "Deals Pipeline",
        content:
          "Full visibility across every adviser's pipeline. You can move stages, claim unassigned appointments, and review credit history.",
      },
      {
        selector: `[data-tour="${tourId("/leads")}"]`,
        title: "Leads Pool",
        content:
          "The full cold-calling pool. As Master you can run calling sessions just like a telemarketer.",
      },
      {
        selector: `[data-tour="${tourId("/audit-logs")}"]`,
        title: "Audit Logs",
        content:
          "Every action in the CRM, timestamped and attributed to its actor. Use this to investigate anything unusual.",
      },
    ];
  }

  return [activity, calendar];
}
