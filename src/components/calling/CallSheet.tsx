import {
  BriefcaseBusiness,
  Building2,
  FileText,
  History,
  Phone,
  PhoneOff,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { useCrmStore } from "@/store/useCrmStore";
import { LeadStatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Lead, Company } from "@/data/types";
import { getLeadActivities } from "@/lib/selectors";
import { getCampaignOfferItems } from "@/lib/campaignOfferings";
import { Link } from "react-router-dom";

interface CallSheetProps {
  lead: Lead | undefined;
  companies: Company[];
}

export function CallSheet({ lead, companies }: CallSheetProps) {
  const { campaign, startCall, endCall, liveNotes, setLiveNotes, phase } =
    useCallSessionStore();
  const { activities, products, bundles, contacts, deals } = useCrmStore();

  if (!lead)
    return <div className="p-6 text-muted-foreground">No lead selected.</div>;

  const company = companies.find((c) => c.id === lead.company_id);
  const leadActivities = getLeadActivities(lead.id, activities).slice(0, 3);
  const offerItems = campaign
    ? getCampaignOfferItems(campaign, products, bundles)
    : [];
  const convertedContact = lead.converted_contact_id
    ? contacts.find((contact) => contact.id === lead.converted_contact_id)
    : undefined;
  const relatedDeals = deals
    .filter(
      (deal) =>
        !deal.deleted_at &&
        (deal.lead_id === lead.id || deal.contact_id === convertedContact?.id),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );

  return (
    <div className="p-6 space-y-5">
      {/* Lead info */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0">
          {lead.first_name[0]}
          {lead.last_name[0]}
        </div>
        <div>
          <Link
            to={`/leads/${lead.id}`}
            className="font-semibold text-lg text-primary hover:underline"
          >
            {lead.first_name} {lead.last_name}
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            <LeadStatusBadge status={lead.status} />
            <span className="text-xs text-muted-foreground">{lead.source}</span>
          </div>
        </div>
      </div>

      {/* Contact details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="font-mono">{lead.phone || "..."}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-3.5 w-3.5 shrink-0" />
          <span>{lead.email || "..."}</span>
        </div>
        {company && (
          <div className="flex items-center gap-2 text-muted-foreground col-span-2">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              <Link
                to={`/companies/${company.id}`}
                className="text-primary hover:underline"
              >
                {company.name}
              </Link>{" "}
              - {company.industry}
            </span>
          </div>
        )}
      </div>

      <Tabs defaultValue="toolkit" className="space-y-3">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="toolkit" className="gap-1.5 px-2">
            <FileText className="h-3.5 w-3.5" />
            Toolkit
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-1.5 px-2">
            <Building2 className="h-3.5 w-3.5" />
            Details
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 px-2">
            <History className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="toolkit" className="mt-0 space-y-3">
          {campaign && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                Campaign Offering
              </p>
              <p className="font-semibold">{campaign.name}</p>
              {offerItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  {offerItems.map((item) => (
                    <div
                      key={`${item.kind}-${item.id}`}
                      className="flex items-center justify-between gap-2 rounded-md bg-background px-2 py-1.5"
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.kind === "PRODUCT"
                          ? item.ticker || "Product"
                          : "Bundle"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border p-3 text-sm space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <FileText className="h-3.5 w-3.5" />
              Call Script
            </div>
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">
              {campaign?.script || "No script is configured for this campaign."}
            </p>
          </div>

          <div className="rounded-lg border p-3 text-sm space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Dialer Tools
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Primary number</p>
                <p className="font-mono text-foreground">
                  {lead.phone || "No phone"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="truncate text-foreground">
                  {lead.email || "No email"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Positioning cue</p>
                <p className="text-foreground">
                  {lead.notes ||
                    "Confirm investment goals and risk appetite before pitching the offer."}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-0 space-y-3 text-sm">
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Lead Details
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                {lead.status}
              </div>
              <div>
                <span className="text-muted-foreground">Source:</span>{" "}
                {lead.source}
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>{" "}
                {formatDate(lead.created_at)}
              </div>
              <div>
                <span className="text-muted-foreground">Updated:</span>{" "}
                {formatDate(lead.updated_at)}
              </div>
            </div>
            {lead.notes && (
              <p className="text-xs text-foreground pt-1">{lead.notes}</p>
            )}
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Company Account
            </p>
            {company ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Link
                  to={`/companies/${company.id}`}
                  className="col-span-2 font-medium text-sm text-primary hover:underline"
                >
                  {company.name}
                </Link>
                <div>
                  <span className="text-muted-foreground">Industry:</span>{" "}
                  {company.industry}
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>{" "}
                  {company.phone || "N/A"}
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {company.email || "N/A"}
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Website:</span>{" "}
                  {company.website || "N/A"}
                </div>
                {company.notes && (
                  <div className="col-span-2 text-foreground">
                    {company.notes}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No company is linked to this lead.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-3 text-sm">
          <div className="rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Deal History
            </p>
            {relatedDeals.length > 0 ? (
              <div className="space-y-2">
                {relatedDeals.map((deal) => (
                  <div key={deal.id} className="rounded-md border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/deals/${deal.id}`}
                        className="font-medium truncate text-primary hover:underline"
                      >
                        {deal.title}
                      </Link>
                      <span className="font-semibold">
                        {formatCurrency(deal.value)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                      <BriefcaseBusiness className="h-3.5 w-3.5" />
                      <span>{deal.stage}</span>
                      <span>Updated {formatDate(deal.updated_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No deal history found for this person.
              </p>
            )}
          </div>

          {leadActivities.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Recent Activity
              </p>
              <div className="space-y-2">
                {leadActivities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2 text-xs border rounded-md p-2"
                  >
                    <span className="text-muted-foreground shrink-0">
                      {formatDate(a.completed_at || a.created_at)}
                    </span>
                    <span className="font-medium">{a.type}</span>
                    <Link
                      to={`/activities/${a.id}`}
                      className="text-primary hover:underline truncate"
                    >
                      {a.subject}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Live notes (during call) */}
      {phase === "calling" && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Live Notes
          </p>
          <Textarea
            value={liveNotes}
            onChange={(e) => setLiveNotes(e.target.value)}
            placeholder="Type call notes here..."
            className="text-sm"
            rows={3}
          />
        </div>
      )}

      {/* Action button */}
      {phase === "sheet" && (
        <Button onClick={startCall} className="w-full gap-2" size="lg">
          <Phone className="h-4 w-4" />
          Start Call
        </Button>
      )}
      {phase === "calling" && (
        <Button
          onClick={endCall}
          variant="destructive"
          className="w-full gap-2"
          size="lg"
        >
          <PhoneOff className="h-4 w-4" />
          End Call
        </Button>
      )}
    </div>
  );
}
