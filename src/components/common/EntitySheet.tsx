import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useCrmStore } from "@/store/useCrmStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ActivityResultBadge,
  ActivityTypeBadge,
  DealStageBadge,
  LeadStatusBadge,
  RoleBadge,
} from "@/components/common/StatusBadge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export type EntitySheetTarget =
  | { type: "lead"; id: string }
  | { type: "contact"; id: string }
  | { type: "company"; id: string }
  | { type: "deal"; id: string }
  | { type: "user"; id: string }
  | { type: "activity"; id: string };

interface EntitySheetProps {
  target: EntitySheetTarget | null;
  onClose: () => void;
}

export function EntitySheet({ target, onClose }: EntitySheetProps) {
  const { leads, contacts, companies, deals, users, activities } = useCrmStore();

  const title = getTitle(target, { leads, contacts, companies, deals, users, activities });
  const href = target ? getHref(target) : "";

  return (
    <Sheet open={!!target} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {target && (
          <div className="space-y-5">
            <SheetHeader className="pr-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle>{title}</SheetTitle>
                  <p className="text-sm text-muted-foreground capitalize">{target.type}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to={href}>
                    <ExternalLink className="h-4 w-4" />
                    Details
                  </Link>
                </Button>
              </div>
            </SheetHeader>
            <EntitySheetBody target={target} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EntitySheetBody({ target }: { target: EntitySheetTarget }) {
  const { leads, contacts, companies, deals, users, activities } = useCrmStore();

  if (target.type === "lead") {
    const lead = leads.find((item) => item.id === target.id);
    if (!lead) return <MissingEntity />;
    const company = companies.find((item) => item.id === lead.company_id);
    const assignee = users.find((item) => item.id === lead.assigned_to_id);
    const leadActivities = activities.filter((activity) => activity.lead_id === lead.id && !activity.deleted_at).slice(0, 4);
    return (
      <>
        <InfoCard title="Lead Details">
          <div className="flex items-center gap-2"><LeadStatusBadge status={lead.status} /><span className="text-xs text-muted-foreground">{lead.source.replace("_", " ")}</span></div>
          <DetailGrid items={[
            ["Email", lead.email || "N/A"],
            ["Phone", lead.phone || "N/A"],
            ["Company", company ? <InlineEntityLink to={`/companies/${company.id}`}>{company.name}</InlineEntityLink> : "N/A"],
            ["Assignee", assignee ? <InlineEntityLink to={`/team/${assignee.id}`}>{assignee.name}</InlineEntityLink> : "N/A"],
            ["Created", formatDate(lead.created_at)],
            ["Updated", formatDate(lead.updated_at)],
          ]} />
          {lead.notes && <p className="text-xs">{lead.notes}</p>}
        </InfoCard>
        <ActivityList activities={leadActivities} title="Recent Activity" />
      </>
    );
  }

  if (target.type === "contact") {
    const contact = contacts.find((item) => item.id === target.id);
    if (!contact) return <MissingEntity />;
    const company = companies.find((item) => item.id === contact.company_id);
    const contactDeals = deals.filter((deal) => deal.contact_id === contact.id && !deal.deleted_at);
    return (
      <>
        <InfoCard title="Contact Details">
          <DetailGrid items={[
            ["Email", contact.email || "N/A"],
            ["Phone", contact.phone || "N/A"],
            ["Title", contact.title || "N/A"],
            ["Company", company ? <InlineEntityLink to={`/companies/${company.id}`}>{company.name}</InlineEntityLink> : "N/A"],
            ["Created", formatDate(contact.created_at)],
            ["Updated", formatDate(contact.updated_at)],
          ]} />
        </InfoCard>
        <DealList deals={contactDeals} title="Deals" />
      </>
    );
  }

  if (target.type === "company") {
    const company = companies.find((item) => item.id === target.id);
    if (!company) return <MissingEntity />;
    const companyContacts = contacts.filter((contact) => contact.company_id === company.id && !contact.deleted_at);
    const companyDeals = deals.filter((deal) => deal.company_id === company.id && !deal.deleted_at);
    return (
      <>
        <InfoCard title="Company Details">
          <DetailGrid items={[
            ["Industry", company.industry || "N/A"],
            ["Website", company.website || "N/A"],
            ["Phone", company.phone || "N/A"],
            ["Email", company.email || "N/A"],
            ["Created", formatDate(company.created_at)],
            ["Contacts", companyContacts.length],
          ]} />
          {company.notes && <p className="text-xs">{company.notes}</p>}
        </InfoCard>
        <DealList deals={companyDeals} title="Deals" />
      </>
    );
  }

  if (target.type === "deal") {
    const deal = deals.find((item) => item.id === target.id);
    if (!deal) return <MissingEntity />;
    const contact = contacts.find((item) => item.id === deal.contact_id);
    const company = companies.find((item) => item.id === deal.company_id);
    const assignee = users.find((item) => item.id === deal.assigned_to_id);
    const dealActivities = activities.filter((activity) => activity.deal_id === deal.id && !activity.deleted_at).slice(0, 4);
    return (
      <>
        <InfoCard title="Deal Details">
          <div className="flex items-center justify-between gap-2">
            <DealStageBadge stage={deal.stage} />
            <span className="font-semibold">{formatCurrency(deal.value)}</span>
          </div>
          <DetailGrid items={[
            ["Contact", contact ? <InlineEntityLink to={`/contacts/${contact.id}`}>{contact.first_name} {contact.last_name}</InlineEntityLink> : "N/A"],
            ["Company", company ? <InlineEntityLink to={`/companies/${company.id}`}>{company.name}</InlineEntityLink> : "N/A"],
            ["Assignee", assignee ? <InlineEntityLink to={`/team/${assignee.id}`}>{assignee.name}</InlineEntityLink> : "N/A"],
            ["Expected Close", formatDate(deal.expected_close_date)],
            ["Created", formatDate(deal.created_at)],
            ["Updated", formatDate(deal.updated_at)],
          ]} />
        </InfoCard>
        <ActivityList activities={dealActivities} title="Recent Activity" />
      </>
    );
  }

  if (target.type === "user") {
    const user = users.find((item) => item.id === target.id);
    if (!user) return <MissingEntity />;
    const userActivities = activities.filter((activity) => activity.created_by === user.id && !activity.deleted_at);
    const userDeals = deals.filter((deal) => deal.assigned_to_id === user.id && !deal.deleted_at);
    return (
      <>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10"><AvatarFallback>{user.avatar || user.name.slice(0, 2)}</AvatarFallback></Avatar>
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <RoleBadge role={user.role} className="ml-auto" />
          </div>
        </div>
        <InfoCard title="Performance Snapshot">
          <DetailGrid items={[
            ["Activities", userActivities.length],
            ["Assigned Deals", userDeals.length],
            ["Open Deals", userDeals.filter((deal) => deal.stage !== "WON" && deal.stage !== "LOST").length],
            ["Won Deals", userDeals.filter((deal) => deal.stage === "WON").length],
          ]} />
        </InfoCard>
      </>
    );
  }

  const activity = activities.find((item) => item.id === target.id);
  if (!activity) return <MissingEntity />;
  const assignee = users.find((item) => item.id === activity.assigned_to_id);
  return (
    <InfoCard title="Activity Details">
      <div className="flex flex-wrap items-center gap-2">
        <ActivityTypeBadge type={activity.type} />
        <ActivityResultBadge result={activity.result} />
      </div>
      <DetailGrid items={[
        ["Scheduled", formatDateTime(activity.scheduled_at)],
        ["Completed", formatDateTime(activity.completed_at)],
        ["Created", formatDateTime(activity.created_at)],
        ["Assigned To", assignee ? <InlineEntityLink to={`/team/${assignee.id}`}>{assignee.name}</InlineEntityLink> : "N/A"],
      ]} />
      {activity.description && <p className="text-xs">{activity.description}</p>}
    </InfoCard>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3 text-sm space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function DetailGrid({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {items.map(([label, value]) => (
        <div key={label}>
          <span className="text-muted-foreground">{label}:</span> {value}
        </div>
      ))}
    </div>
  );
}

function InlineEntityLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="font-medium text-primary hover:underline">
      {children}
    </Link>
  );
}

function ActivityList({ activities, title }: { activities: Array<import("@/data/types").Activity>; title: string }) {
  return (
    <InfoCard title={title}>
      {activities.length > 0 ? activities.map((activity) => (
        <div key={activity.id} className="rounded-md border p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <Link to={`/activities/${activity.id}`} className="font-medium truncate text-primary hover:underline">
              {activity.subject}
            </Link>
            <ActivityTypeBadge type={activity.type} />
          </div>
          <p className="mt-1 text-muted-foreground">{formatDateTime(activity.completed_at || activity.scheduled_at || activity.created_at)}</p>
        </div>
      )) : <p className="text-xs text-muted-foreground">No activity found.</p>}
    </InfoCard>
  );
}

function DealList({ deals, title }: { deals: Array<import("@/data/types").Deal>; title: string }) {
  return (
    <InfoCard title={title}>
      {deals.length > 0 ? deals.slice(0, 5).map((deal) => (
        <div key={deal.id} className="rounded-md border p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <Link to={`/deals/${deal.id}`} className="font-medium truncate text-primary hover:underline">
              {deal.title}
            </Link>
            <span className="font-semibold">{formatCurrency(deal.value)}</span>
          </div>
          <Badge variant="outline" className="mt-1 text-xs">{deal.stage}</Badge>
        </div>
      )) : <p className="text-xs text-muted-foreground">No deals found.</p>}
    </InfoCard>
  );
}

function MissingEntity() {
  return <p className="rounded-lg border p-4 text-sm text-muted-foreground">Record not found.</p>;
}

function getHref(target: EntitySheetTarget): string {
  if (target.type === "lead") return `/leads/${target.id}`;
  if (target.type === "contact") return `/contacts/${target.id}`;
  if (target.type === "company") return `/companies/${target.id}`;
  if (target.type === "deal") return `/deals/${target.id}`;
  if (target.type === "activity") return `/activities/${target.id}`;
  return `/team/${target.id}`;
}

function getTitle(target: EntitySheetTarget | null, store: {
  leads: ReturnType<typeof useCrmStore.getState>["leads"];
  contacts: ReturnType<typeof useCrmStore.getState>["contacts"];
  companies: ReturnType<typeof useCrmStore.getState>["companies"];
  deals: ReturnType<typeof useCrmStore.getState>["deals"];
  users: ReturnType<typeof useCrmStore.getState>["users"];
  activities: ReturnType<typeof useCrmStore.getState>["activities"];
}) {
  if (!target) return "";
  if (target.type === "lead") {
    const lead = store.leads.find((item) => item.id === target.id);
    return lead ? `${lead.first_name} ${lead.last_name}` : "Lead";
  }
  if (target.type === "contact") {
    const contact = store.contacts.find((item) => item.id === target.id);
    return contact ? `${contact.first_name} ${contact.last_name}` : "Contact";
  }
  if (target.type === "company") return store.companies.find((item) => item.id === target.id)?.name || "Company";
  if (target.type === "deal") return store.deals.find((item) => item.id === target.id)?.title || "Deal";
  if (target.type === "user") return store.users.find((item) => item.id === target.id)?.name || "User";
  return store.activities.find((item) => item.id === target.id)?.subject || "Activity";
}
