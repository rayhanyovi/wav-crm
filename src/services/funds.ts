import { api, asNumber, type Page } from "@/lib/api";
import type { SgaFund } from "@/data/sgaFunds";
import { getRiskCategory } from "@/data/sgaFunds";

const RISK_CATEGORIES = new Set(["Conservative", "Moderate", "Balanced", "Growth", "Aggressive"]);

interface ApiSgaFund {
  id: string;
  sourceSheet: string;
  sourceRowNumber: number;
  sourceSheets: string[];
  isin: string;
  fundManagementCompany: string | null;
  fundName: string;
  currency: string | null;
  assetClass: string | null;
  geographicFocus: string | null;
  sgaClassification: string | null;
  riskClassification: string | null;
  riskRating: string | number | null;
  dividendYield: string | number | null;
  dividendDate: string | null;
  dividendFrequency: string | null;
  insurers: string[];
  platformAvailability: Record<string, string>;
  platformRows?: Array<{
    platformName: string;
    availabilityValue: string;
    sourceSheet: string;
    sourceRowNumber: number;
  }>;
}

interface FundsMeta {
  total: number;
  version: string;
}

export interface FetchSgaFundsOptions {
  search?: string;
  sourceSheet?: string;
  insurer?: string;
  platform?: string;
  assetClass?: string;
  riskCategory?: string;
  riskRatings?: number[];
  hasDividend?: boolean;
}

interface SgaFundsCache {
  version: string;
  cachedAt: number;
  funds: SgaFund[];
}

const FUND_CACHE_KEY = "wav:sga-funds:v1";
let memoryCache: SgaFundsCache | null = null;

function mapFund(row: ApiSgaFund): SgaFund {
  const riskRating = asNumber(row.riskRating) ?? 12;
  const riskCategory = RISK_CATEGORIES.has(row.riskClassification ?? "")
    ? row.riskClassification
    : getRiskCategory(riskRating);

  return {
    id: row.id,
    sourceSheet: row.sourceSheet,
    sourceRowNumber: row.sourceRowNumber,
    sourceSheets: row.sourceSheets ?? [],
    isin: row.isin,
    name: row.fundName,
    manager: row.fundManagementCompany ?? "",
    assetClass: row.assetClass ?? "Mixed Assets",
    geoFocus: row.geographicFocus ?? "",
    sgaClass: row.sgaClassification ?? "",
    riskCategory: riskCategory as SgaFund["riskCategory"],
    riskRating,
    currency: row.currency ?? "",
    dividendYield: asNumber(row.dividendYield) ?? null,
    dividendDate: row.dividendDate ?? null,
    dividendFrequency: (row.dividendFrequency as SgaFund["dividendFrequency"]) ?? null,
    insurers: row.insurers ?? [],
    platformAvailability: row.platformAvailability ?? {},
    platformRows: row.platformRows ?? [],
  };
}

function paramsForOptions(options: FetchSgaFundsOptions) {
  return {
    ...(options.search ? { search: options.search } : {}),
    ...(options.sourceSheet ? { sourceSheet: options.sourceSheet } : {}),
    ...(options.insurer ? { insurer: options.insurer } : {}),
    ...(options.platform ? { platform: options.platform } : {}),
    ...(options.assetClass ? { assetClass: options.assetClass } : {}),
    ...(options.riskCategory ? { riskCategory: options.riskCategory } : {}),
    ...(options.riskRatings?.length ? { riskRatings: options.riskRatings.join(",") } : {}),
    ...(options.hasDividend ? { hasDividend: true } : {}),
  };
}

function canUseStorage() {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function readStoredCache(): SgaFundsCache | null {
  if (memoryCache) return memoryCache;
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(FUND_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SgaFundsCache>;
    if (!parsed.version || !Array.isArray(parsed.funds) || parsed.funds.length === 0) {
      window.localStorage.removeItem(FUND_CACHE_KEY);
      return null;
    }
    memoryCache = {
      version: parsed.version,
      cachedAt: typeof parsed.cachedAt === "number" ? parsed.cachedAt : 0,
      funds: parsed.funds,
    };
    return memoryCache;
  } catch {
    window.localStorage.removeItem(FUND_CACHE_KEY);
    return null;
  }
}

function writeStoredCache(cache: SgaFundsCache) {
  memoryCache = cache;
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(FUND_CACHE_KEY, JSON.stringify(cache));
  } catch {
    window.localStorage.removeItem(FUND_CACHE_KEY);
  }
}

export function getCachedSgaFundsSnapshot(): SgaFund[] | undefined {
  return readStoredCache()?.funds;
}

export async function fetchSgaFundsMeta(): Promise<FundsMeta> {
  return api.get<FundsMeta>("/api/funds/meta");
}

export async function fetchSgaFundsPage(
  options: FetchSgaFundsOptions = {},
  page = 1,
  pageSize = 50,
): Promise<Page<SgaFund>> {
  const res = await api.get<Page<ApiSgaFund>>("/api/funds", {
    page,
    pageSize,
    ...paramsForOptions(options),
  });

  return {
    ...res,
    data: res.data.map(mapFund),
  };
}

function searchText(fund: SgaFund) {
  return `${fund.name} ${fund.manager} ${fund.isin} ${fund.sgaClass}`.toLowerCase();
}

function matchesLocalFilters(fund: SgaFund, options: FetchSgaFundsOptions) {
  const q = options.search?.trim().toLowerCase();
  if (q && !searchText(fund).includes(q)) return false;
  if (options.sourceSheet && !fund.sourceSheets?.some((sheet) => sheet.toLowerCase().includes(options.sourceSheet!.toLowerCase()))) {
    return false;
  }
  if (options.insurer && !fund.insurers?.some((insurer) => insurer.toLowerCase().includes(options.insurer!.toLowerCase()))) {
    return false;
  }
  if (options.platform) {
    const availability = fund.platformAvailability?.[options.platform];
    if (!availability || ["NO", "No", "no", "-", "N/A", "n/a"].includes(availability)) return false;
  }
  if (options.assetClass && fund.assetClass.toLowerCase() !== options.assetClass.toLowerCase()) return false;
  if (options.riskCategory && fund.riskCategory.toLowerCase() !== options.riskCategory.toLowerCase()) return false;
  if (options.riskRatings?.length && !options.riskRatings.includes(fund.riskRating)) return false;
  if (options.hasDividend && fund.dividendYield == null) return false;
  return true;
}

export function filterSgaFunds(funds: SgaFund[], options: FetchSgaFundsOptions = {}) {
  if (Object.keys(options).length === 0) return funds;
  return funds.filter((fund) => matchesLocalFilters(fund, options));
}

async function fetchAllSgaFundsFromApi(): Promise<SgaFund[]> {
  const pageSize = 500;
  const funds: SgaFund[] = [];
  let page = 1;
  let total = 0;

  do {
    const res = await fetchSgaFundsPage({}, page, pageSize);
    funds.push(...res.data);
    total = res.total;
    page += 1;
  } while (funds.length < total);

  return funds;
}

function fallbackVersion(funds: SgaFund[]) {
  const fingerprint = `${funds.length}:${funds[0]?.id ?? "empty"}:${funds.at(-1)?.id ?? "empty"}`;
  return `fallback:${fingerprint}`;
}

export async function fetchSgaFundsCatalog(): Promise<SgaFund[]> {
  const cached = readStoredCache();

  let meta: FundsMeta | null = null;
  try {
    meta = await fetchSgaFundsMeta();
  } catch {
    if (cached) return cached.funds;
  }

  if (meta && cached?.version === meta.version) return cached.funds;

  const funds = await fetchAllSgaFundsFromApi();
  writeStoredCache({
    version: meta?.version ?? fallbackVersion(funds),
    cachedAt: Date.now(),
    funds,
  });
  return funds;
}

export async function fetchSgaFunds(options: FetchSgaFundsOptions = {}): Promise<SgaFund[]> {
  const funds = await fetchSgaFundsCatalog();
  return filterSgaFunds(funds, options);
}
