import type { Bundle, Campaign, CampaignOfferItem, Product } from "@/data/types";

export interface CampaignOfferDisplayItem {
  kind: CampaignOfferItem["kind"];
  id: string;
  name: string;
  ticker?: string;
  description?: string;
  productIds?: string[];
}

export function getCampaignOfferItems(
  campaign: Campaign,
  products: Product[],
  bundles: Bundle[]
): CampaignOfferDisplayItem[] {
  const configuredItems = campaign.offer_items?.filter((item) => item.id) ?? [];
  const offerItems =
    configuredItems.length > 0
      ? configuredItems
      : [
          ...(campaign.product_id ? [{ kind: "PRODUCT" as const, id: campaign.product_id }] : []),
          ...(campaign.bundle_id ? [{ kind: "BUNDLE" as const, id: campaign.bundle_id }] : []),
        ];

  return offerItems.flatMap((item): CampaignOfferDisplayItem[] => {
    if (item.kind === "PRODUCT") {
      const product = products.find((p) => p.id === item.id);
      return product
        ? [{ kind: item.kind, id: product.id, name: product.name, ticker: product.ticker, description: product.description }]
        : [];
    }

    const bundle = bundles.find((b) => b.id === item.id);
    return bundle
      ? [{ kind: item.kind, id: bundle.id, name: bundle.name, description: bundle.description, productIds: bundle.product_ids }]
      : [];
  });
}

export function getCampaignOfferingLabel(campaign: Campaign, products: Product[], bundles: Bundle[]): string {
  const offerItems = getCampaignOfferItems(campaign, products, bundles);
  if (offerItems.length === 0) return "";
  if (offerItems.length <= 2) return offerItems.map((item) => item.name).join(", ");
  return `${offerItems[0].name}, ${offerItems[1].name} +${offerItems.length - 2}`;
}

export function campaignIncludesProduct(campaign: Campaign, productId: string, bundles: Bundle[]): boolean {
  const offerItems = campaign.offer_items?.filter((item) => item.id) ?? [];

  if (offerItems.length === 0) {
    if (campaign.product_id === productId) return true;
    const bundle = campaign.bundle_id ? bundles.find((b) => b.id === campaign.bundle_id) : undefined;
    return bundle?.product_ids.includes(productId) ?? false;
  }

  return offerItems.some((item) => {
    if (item.kind === "PRODUCT") return item.id === productId;
    const bundle = bundles.find((b) => b.id === item.id);
    return bundle?.product_ids.includes(productId) ?? false;
  });
}
