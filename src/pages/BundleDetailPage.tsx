import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CampaignStatusBadge } from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/format";
import { getCampaignDealConversions } from "@/lib/selectors";

export function BundleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { bundles, products, campaigns, activities, deals } = useCrmStore();

  const bundle = bundles.find((item) => item.id === id);
  if (!bundle) return <div className="p-6 text-muted-foreground">Bundle not found.</div>;

  const bundleProducts = bundle.product_ids
    .map((productId) => products.find((product) => product.id === productId))
    .filter(Boolean);
  const relatedCampaigns = campaigns.filter((campaign) => {
    const offerItems = campaign.offer_items?.filter((item) => item.id) ?? [];
    return offerItems.length > 0
      ? offerItems.some((item) => item.kind === "BUNDLE" && item.id === bundle.id)
      : campaign.bundle_id === bundle.id;
  });
  const relatedCampaignIds = new Set(relatedCampaigns.map((campaign) => campaign.id));
  const campaignCalls = activities.filter(
    (activity) =>
      activity.campaign_id &&
      relatedCampaignIds.has(activity.campaign_id) &&
      activity.type === "CALL" &&
      !activity.deleted_at,
  );
  const pickups = campaignCalls.filter(
    (activity) => activity.result !== "NO_ANSWER" && activity.result !== "CANCELLED",
  );
  const dealConversions = getCampaignDealConversions(activities, deals, relatedCampaignIds);
  const pickupRate = campaignCalls.length ? Math.round((pickups.length / campaignCalls.length) * 100) : 0;
  const conversionRate = campaignCalls.length ? Math.round((dealConversions.length / campaignCalls.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/campaigns?tab=bundles")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{bundle.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={bundle.is_active ? "secondary" : "outline"}>
              {bundle.is_active ? "Active" : "Inactive"}
            </Badge>
            <span className="text-sm text-muted-foreground">{bundleProducts.length} products</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Risk Score", value: `${bundle.risk_score ?? "N/A"} / 10` },
          { label: "Products", value: bundleProducts.length },
          { label: "Calls Made", value: campaignCalls.length },
          { label: "Conversion Rate", value: `${conversionRate}%` },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-0.5 text-2xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bundle Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-y-2">
              <div>
                <span className="text-muted-foreground text-xs">Risk Score</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        key={i}
                        className={`h-2 w-2 rounded-sm ${
                          i < (bundle.risk_score ?? 0)
                            ? bundle.risk_score <= 3 ? "bg-green-500"
                              : bundle.risk_score <= 6 ? "bg-yellow-500"
                              : "bg-red-500"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{bundle.risk_score}/10</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Campaign Pickup Rate</span>
                <p className="font-medium">{pickupRate}%</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Added</span>
                <p className="font-medium">{formatDate(bundle.created_at)}</p>
              </div>
            </div>
            {bundle.description && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm leading-relaxed">{bundle.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Portfolio Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bundleProducts.map((product) =>
              product ? (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  className="block rounded-md border p-2 text-sm hover:bg-muted"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{product.ticker}</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {bundle.allocations?.[product.id] != null ? `${bundle.allocations[product.id]}%` : "—"}
                    </span>
                  </div>
                  {bundle.allocations?.[product.id] != null && (
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${bundle.allocations[product.id]}%` }}
                      />
                    </div>
                  )}
                </Link>
              ) : null,
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Campaigns Using This Bundle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {relatedCampaigns.length > 0 ? (
            relatedCampaigns.map((campaign) => {
              const calls = campaignCalls.filter((activity) => activity.campaign_id === campaign.id);
              return (
                <Link
                  key={campaign.id}
                  to={`/campaigns/${campaign.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <CampaignStatusBadge status={campaign.status} />
                    <span className="text-xs text-muted-foreground">{calls.length} calls</span>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No campaigns use this bundle.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
