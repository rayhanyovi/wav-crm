import { api, asNumber, type Page } from "@/lib/api";
import type { SgaFund } from "@/data/sgaFunds";
import { getRiskCategory } from "@/data/sgaFunds";

const RISK_CATEGORIES = new Set(["Conservative", "Moderate", "Balanced", "Growth", "Aggressive"]);

interface ApiSgaFund {
  id: string;
  sourceSheet: string;
  sourceRowNumber: number;
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
  dividendFrequency: string | null;
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
    dividendFrequency: (row.dividendFrequency as SgaFund["dividendFrequency"]) ?? null,
  };
}

export async function fetchSgaFunds(search?: string): Promise<SgaFund[]> {
  const pageSize = 500;
  const funds: SgaFund[] = [];
  let page = 1;
  let total = 0;

  do {
    const res = await api.get<Page<ApiSgaFund>>("/api/funds", {
      page,
      pageSize,
      ...(search ? { search } : {}),
    });
    funds.push(...res.data.map(mapFund));
    total = res.total;
    page += 1;
  } while (funds.length < total);

  return funds;
}
