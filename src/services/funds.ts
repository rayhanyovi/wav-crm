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

export interface FetchSgaFundsOptions {
  search?: string;
  sourceSheet?: string;
  insurer?: string;
  platform?: string;
}

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

export async function fetchSgaFunds(options: FetchSgaFundsOptions = {}): Promise<SgaFund[]> {
  const pageSize = 500;
  const funds: SgaFund[] = [];
  let page = 1;
  let total = 0;

  do {
    const res = await api.get<Page<ApiSgaFund>>("/api/funds", {
      page,
      pageSize,
      ...(options.search ? { search: options.search } : {}),
      ...(options.sourceSheet ? { sourceSheet: options.sourceSheet } : {}),
      ...(options.insurer ? { insurer: options.insurer } : {}),
      ...(options.platform ? { platform: options.platform } : {}),
    });
    funds.push(...res.data.map(mapFund));
    total = res.total;
    page += 1;
  } while (funds.length < total);

  return funds;
}
