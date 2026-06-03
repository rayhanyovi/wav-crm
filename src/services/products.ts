import { supabase } from "@/lib/supabase";
import type { Bundle, Product } from "@/data/types";

interface ProductRow {
  id: string;
  name: string;
  ticker: string;
  description: string | null;
  category: string;
  risk_score: number;
  annual_return: number | string | null;
  market_cap: string | null;
  is_active: boolean;
  created_at: string;
}

interface BundleRow {
  id: string;
  name: string;
  description: string | null;
  risk_score: number;
  is_active: boolean;
  created_at: string;
}

interface BundleProductRow {
  bundle_id: string;
  product_id: string;
  allocation_pct: number | string;
}

const PRODUCT_SELECT =
  "id,name,ticker,description,category,risk_score,annual_return,market_cap,is_active,created_at";
const BUNDLE_SELECT = "id,name,description,risk_score,is_active,created_at";
const BUNDLE_PRODUCT_SELECT = "bundle_id,product_id,allocation_pct";

function asNumber(value: number | string | null): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    ticker: row.ticker,
    description: row.description ?? undefined,
    category: row.category,
    risk_score: row.risk_score,
    annual_return: asNumber(row.annual_return),
    market_cap: row.market_cap ?? undefined,
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as ProductRow[]).map(mapProductRow);
}

export async function fetchBundles(): Promise<Bundle[]> {
  const [{ data: bundles, error: bundleError }, { data: bundleProducts, error: bundleProductError }] =
    await Promise.all([
      supabase.from("bundles").select(BUNDLE_SELECT).order("name", { ascending: true }),
      supabase.from("bundle_products").select(BUNDLE_PRODUCT_SELECT),
    ]);

  if (bundleError) throw new Error(bundleError.message);
  if (bundleProductError) throw new Error(bundleProductError.message);

  const rows = (bundleProducts ?? []) as BundleProductRow[];

  return ((bundles ?? []) as BundleRow[]).map((bundle) => {
    const bundleRows = rows.filter((row) => row.bundle_id === bundle.id);
    return {
      id: bundle.id,
      name: bundle.name,
      description: bundle.description ?? undefined,
      product_ids: bundleRows.map((row) => row.product_id),
      allocations: Object.fromEntries(
        bundleRows.map((row) => [row.product_id, asNumber(row.allocation_pct) ?? 0]),
      ),
      risk_score: bundle.risk_score,
      is_active: bundle.is_active,
      created_at: bundle.created_at,
    };
  });
}
