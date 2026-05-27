import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CampaignStatusBadge,
  ActivityTypeBadge,
  ActivityResultBadge,
} from "@/components/common/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { getCampaignOfferItems } from "@/lib/campaignOfferings";

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campaigns, products, bundles, activities, users, leads, contacts } =
    useCrmStore();

  const campaign = campaigns.find((c) => c.id === id);
  if (!campaign)
    return <div className="p-6 text-muted-foreground">Campaign not found.</div>;

  const offerItems = getCampaignOfferItems(campaign, products, bundles);

  const campaignActivities = activities
    .filter((a) => a.campaign_id === campaign.id && !a.deleted_at)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const calls = campaignActivities.filter((a) => a.type === "CALL");
  const pickups = calls.filter(
    (a) => a.result !== "NO_ANSWER" && a.result !== "CANCELLED",
  );
  const conversions = campaignActivities.filter(
    (a) => a.result === "DEAL_ADVANCED" || a.result === "MEETING_SCHEDULED",
  );

  const pickupRate =
    calls.length > 0 ? Math.round((pickups.length / calls.length) * 100) : 0;
  const conversionRate =
    pickups.length > 0
      ? Math.round((conversions.length / pickups.length) * 100)
      : 0;

  const totalDuration = campaignActivities.reduce((acc, a) => {
    const d = a.metadata?.duration_seconds as number | undefined;
    return acc + (d || 0);
  }, 0);

  const progressPct = campaign.target_count
    ? Math.min(100, Math.round((calls.length / campaign.target_count) * 100))
    : 0;

  const uniqueLeadIds = new Set(
    campaignActivities.map((a) => a.lead_id).filter(Boolean),
  );
  const uniqueContactIds = new Set(
    campaignActivities.map((a) => a.contact_id).filter(Boolean),
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/campaigns")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <CampaignStatusBadge status={campaign.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Calls", value: calls.length },
          { label: "Pickups", value: `${pickups.length} (${pickupRate}%)` },
          {
            label: "Conversions",
            value: `${conversions.length} (${conversionRate}%)`,
          },
          {
            label: "Unique Prospects",
            value: uniqueLeadIds.size + uniqueContactIds.size,
          },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold mt-0.5">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Campaign Info</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              <span className="text-muted-foreground">Start Date:</span>{" "}
              {formatDate(campaign.start_date)}
            </p>
            <p>
              <span className="text-muted-foreground">End Date:</span>{" "}
              {formatDate(campaign.end_date)}
            </p>
            {campaign.target_count && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground">Progress:</span>
                  <span>
                    {calls.length} / {campaign.target_count}
                  </span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </div>
            )}
            <p>
              <span className="text-muted-foreground">Dialer Time:</span>{" "}
              {Math.floor(totalDuration / 60)}m {totalDuration % 60}s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Offering</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {offerItems.map((item) => {
              const bundleProducts =
                item.productIds
                  ?.map((pid) => products.find((p) => p.id === pid))
                  .filter(Boolean) ?? [];
              return (
                <div key={`${item.kind}-${item.id}`}>
                  <p className="text-muted-foreground text-xs">
                    {item.kind === "PRODUCT" ? "Product" : "Bundle"}
                  </p>
                  {item.kind === "PRODUCT" ? (
                    <Link
                      to={`/products/${item.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <Link
                      to={`/bundles/${item.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.name}
                    </Link>
                  )}
                  {item.ticker && (
                    <Badge variant="outline" className="text-xs mt-0.5">
                      {item.ticker}
                    </Badge>
                  )}
                  {bundleProducts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {bundleProducts.map(
                        (p) =>
                          p && (
                            <Badge
                              key={p.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              <Link to={`/products/${p.id}`} className="hover:underline">
                                {p.name}
                              </Link>
                            </Badge>
                          ),
                      )}
                    </div>
                  )}
                  {item.description && (
                    <p className="text-muted-foreground text-xs mt-1">
                      {item.description}
                    </p>
                  )}
                </div>
              );
            })}
            {offerItems.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No offering configured.
              </p>
            )}
            {campaign.script && (
              <div className="pt-1">
                <p className="text-muted-foreground text-xs">Call Script</p>
                <p className="text-xs mt-0.5 bg-muted/50 p-2 rounded leading-relaxed whitespace-pre-wrap">
                  {campaign.script}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Activity Log ({campaignActivities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaignActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activities recorded for this campaign yet.
            </p>
          ) : (
            <div className="space-y-2">
              {campaignActivities.map((a) => {
                const creator = users.find((u) => u.id === a.created_by);
                const lead = a.lead_id
                  ? leads.find((l) => l.id === a.lead_id)
                  : null;
                const contact = a.contact_id
                  ? contacts.find((c) => c.id === a.contact_id)
                  : null;
                const related = lead
                  ? {
                      label: `${lead.first_name} ${lead.last_name}`,
                      href: `/leads/${lead.id}`,
                    }
                  : contact
                    ? {
                        label: `${contact.first_name} ${contact.last_name}`,
                        href: `/contacts/${contact.id}`,
                      }
                    : null;
                const dur = a.metadata?.duration_seconds as number | undefined;
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 text-sm border-b last:border-0 pb-2 last:pb-0"
                  >
                    <ActivityTypeBadge
                      type={a.type}
                      className="shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">{a.subject}</p>
                        <ActivityResultBadge result={a.result} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {creator ? (
                          <Link
                            to={`/team/${creator.id}`}
                            className="text-primary hover:underline"
                          >
                            {creator.name}
                          </Link>
                        ) : (
                          <span>System</span>
                        )}
                        {related && (
                          <>
                            <span>·</span>
                            <Link
                              to={related.href}
                              className="text-primary hover:underline"
                            >
                              {related.label}
                            </Link>
                          </>
                        )}
                        {dur && (
                          <>
                            <span>·</span>
                            <span>
                              {Math.floor(dur / 60)}m {dur % 60}s
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span>
                          {formatDateTime(a.completed_at || a.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
