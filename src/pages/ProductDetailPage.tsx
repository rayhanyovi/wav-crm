import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CampaignStatusBadge } from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/format";
import { campaignIncludesProduct, getCampaignOfferingLabel } from "@/lib/campaignOfferings";
import { getCampaignDealConversions } from "@/lib/selectors";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, bundles, campaigns, activities, deals } = useCrmStore();

  const product = products.find((item) => item.id === id);
  if (!product) return <div className="p-6 text-muted-foreground">Product not found.</div>;

  const relatedBundles = bundles.filter((bundle) => bundle.product_ids.includes(product.id));
  const relatedCampaigns = campaigns.filter((campaign) =>
    campaignIncludesProduct(campaign, product.id, bundles),
  );
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
  const campaignPerformance = relatedCampaigns.map((campaign) => {
    const calls = campaignCalls.filter((activity) => activity.campaign_id === campaign.id);
    const campaignPickups = calls.filter(
      (activity) => activity.result !== "NO_ANSWER" && activity.result !== "CANCELLED",
    );
    const campaignConversions = getCampaignDealConversions(activities, deals, new Set([campaign.id]));
    return {
      id: campaign.id,
      name: campaign.name,
      calls: calls.length,
      pickups: campaignPickups.length,
      conversions: campaignConversions.length,
      rate: calls.length ? Math.round((campaignConversions.length / calls.length) * 100) : 0,
    };
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/campaigns?tab=products")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            {product.ticker && <Badge variant="outline">{product.ticker}</Badge>}
            <span className="text-sm text-muted-foreground">{product.category}</span>
            <Badge variant={product.is_active ? "secondary" : "outline"}>
              {product.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Risk Score", value: `${product.risk_score ?? "N/A"} / 10` },
          { label: "Annual Return", value: product.annual_return != null ? `${product.annual_return}%` : "N/A" },
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
            <CardTitle className="text-sm">Product Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-y-2">
              <div>
                <span className="text-muted-foreground text-xs">Market Cap</span>
                <p className="font-medium">{product.market_cap ?? "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Category</span>
                <p className="font-medium">{product.category}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Risk Score</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        key={i}
                        className={`h-2 w-2 rounded-sm ${
                          i < (product.risk_score ?? 0)
                            ? product.risk_score <= 3 ? "bg-green-500"
                              : product.risk_score <= 6 ? "bg-yellow-500"
                              : "bg-red-500"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{product.risk_score}/10</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Avg Annual Return</span>
                <p className="font-medium text-green-600">{product.annual_return != null ? `+${product.annual_return}%` : "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Campaign Pickup Rate</span>
                <p className="font-medium">{pickupRate}%</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Added</span>
                <p className="font-medium">{formatDate(product.created_at)}</p>
              </div>
            </div>
            {product.description && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm leading-relaxed">{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bundles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {relatedBundles.length > 0 ? (
              relatedBundles.map((bundle) => (
                <Link
                  key={bundle.id}
                  to={`/bundles/${bundle.id}`}
                  className="block rounded-md border p-2 text-sm hover:bg-muted"
                >
                  <p className="font-medium text-primary hover:underline">{bundle.name}</p>
                  {bundle.description && (
                    <p className="text-xs text-muted-foreground">{bundle.description}</p>
                  )}
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No bundles include this product.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Product Performance by Campaign</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {campaignPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaignPerformance} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="calls" name="Calls" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversions" name="Conversions" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No campaign performance data yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Campaigns Using This Product</CardTitle>
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
                    <p className="text-xs text-muted-foreground truncate">
                      {getCampaignOfferingLabel(campaign, products, bundles)}
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
            <p className="text-sm text-muted-foreground">No campaigns use this product.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
