import { api, asNumber, type Page } from "@/lib/api";
import type { Bundle, Product } from "@/data/types";

// ─── API response shapes (Prisma camelCase) ───────────────────────────────────

interface ApiProduct {
  id: string;
  name: string;
  ticker: string;
  description: string | null;
  category: string;
  riskScore: number;
  annualReturn: string | null;
  marketCap: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ApiBundleProduct {
  bundleId: string;
  productId: string;
  allocationPct: string;
  product: ApiProduct;
}

interface ApiBundle {
  id: string;
  name: string;
  description: string | null;
  riskScore: number;
  isActive: boolean;
  createdAt: string;
  products: ApiBundleProduct[];
}

function mapProduct(r: ApiProduct): Product {
  return {
    id: r.id,
    name: r.name,
    ticker: r.ticker,
    description: r.description ?? undefined,
    category: r.category,
    risk_score: r.riskScore,
    annual_return: asNumber(r.annualReturn),
    market_cap: r.marketCap ?? undefined,
    is_active: r.isActive,
    created_at: r.createdAt,
  };
}

function mapBundle(r: ApiBundle): Bundle {
  const bundleProducts = r.products ?? [];
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    product_ids: bundleProducts.map((bp) => bp.productId),
    allocations: Object.fromEntries(
      bundleProducts.map((bp) => [bp.productId, asNumber(bp.allocationPct) ?? 0]),
    ),
    risk_score: r.riskScore,
    is_active: r.isActive,
    created_at: r.createdAt,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function fetchProducts(activeOnly = false): Promise<Product[]> {
  const res = await api.get<ApiProduct[]>("/api/products", activeOnly ? { active_only: true } : undefined);
  return res.map(mapProduct);
}

export async function fetchBundles(activeOnly = false): Promise<Bundle[]> {
  const res = await api.get<ApiBundle[]>("/api/bundles", activeOnly ? { active_only: true } : undefined);
  return res.map(mapBundle);
}

export async function fetchFunds(search?: string, page = 1, pageSize = 50) {
  return api.get<Page<Record<string, unknown>>>("/api/funds", {
    page,
    pageSize,
    ...(search ? { search } : {}),
  });
}
