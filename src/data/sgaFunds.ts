// Mock data derived from SGA Master Fund List + Dividend paying Funds sheet
// Real ISINs, names, risk ratings, and dividend yields preserved from source Excel

export type RiskCategory = 'Conservative' | 'Moderate' | 'Balanced' | 'Growth' | 'Aggressive';
export type AssetClass = 'Equity' | 'Mixed Assets' | 'Bond' | 'Money Market' | 'Alternatives' | 'Commodity' | 'Private Credit';
export type DividendFrequency = 'Mthly' | 'Qtrly' | 'Semi-Annual' | 'Annual';

export interface SgaFund {
  id?: string;
  sourceSheet?: string;
  sourceRowNumber?: number;
  sourceSheets?: string[];
  isin: string;
  name: string;
  manager: string;
  assetClass: AssetClass | string;
  geoFocus: string;
  sgaClass: string;
  riskCategory: RiskCategory;
  riskRating: number; // 1–12
  currency: string;
  dividendYield: number | null;       // Est. yield % from Refinitiv, null = no dividend
  dividendDate?: string | null;
  dividendFrequency: DividendFrequency | null;
  insurers?: string[];
  platformAvailability?: Record<string, string>;
  platformRows?: Array<{
    platformName: string;
    availabilityValue: string;
    sourceSheet: string;
    sourceRowNumber: number;
  }>;
}

// Risk rating → category mapping (from SGA Fund Risk Matrix)
// Bond:  Diversified=1, Regional=2, Sector=3, Country=4
// Mixed: Diversified=5, Regional=6, Sector=7, Country=8
// Equity:Diversified=9, Regional=10, Sector=11, Country=12
export const RISK_RATING_LABELS: Record<number, RiskCategory> = {
  1: 'Conservative',
  2: 'Conservative',
  3: 'Conservative',
  4: 'Moderate',
  5: 'Moderate',
  6: 'Balanced',
  7: 'Balanced',
  8: 'Balanced',
  9: 'Growth',
  10: 'Aggressive',
  11: 'Aggressive',
  12: 'Aggressive',
};

export const RISK_CATEGORY_COLOR: Record<RiskCategory, string> = {
  Conservative: 'text-green-700 bg-green-100 border-green-300 dark:text-green-300 dark:bg-green-950/40 dark:border-green-800',
  Moderate:     'text-yellow-700 bg-yellow-100 border-yellow-300 dark:text-yellow-300 dark:bg-yellow-950/40 dark:border-yellow-800',
  Balanced:     'text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-800',
  Growth:       'text-orange-700 bg-orange-100 border-orange-300 dark:text-orange-300 dark:bg-orange-950/40 dark:border-orange-800',
  Aggressive:   'text-red-700 bg-red-100 border-red-300 dark:text-red-300 dark:bg-red-950/40 dark:border-red-800',
};

export const RISK_CATEGORY_BAR: Record<RiskCategory, string> = {
  Conservative: 'bg-green-500',
  Moderate:     'bg-yellow-400',
  Balanced:     'bg-blue-500',
  Growth:       'bg-orange-500',
  Aggressive:   'bg-red-500',
};

export function getRiskCategory(rating: number): RiskCategory {
  return RISK_RATING_LABELS[Math.round(rating)] ?? 'Aggressive';
}

export const SGA_FUNDS: SgaFund[] = [
  // ── Rating 1 — Conservative ───────────────────────────────────────────────
  { isin: 'IE00B05PYX08', name: 'Dimensional Global Short Fixed Income GBP Dis', manager: 'Dimensional Ireland Ltd', assetClass: 'Bond', geoFocus: 'Global', sgaClass: 'Short Duration Bond', riskCategory: 'Conservative', riskRating: 1, currency: 'GBP', dividendYield: 1.818, dividendFrequency: 'Semi-Annual' },
  { isin: 'SG9999002851', name: 'Eastspring Inv Funds-Monthly Income Plan A', manager: 'Eastspring Investments Ltd', assetClass: 'Bond', geoFocus: 'Global', sgaClass: 'Global Bond', riskCategory: 'Conservative', riskRating: 1, currency: 'SGD', dividendYield: 7.8621, dividendFrequency: 'Annual' },
  { isin: 'LU0048620586', name: 'Fidelity Funds - Flexible Bond A-GBP-DIS', manager: 'Fidelity', assetClass: 'Bond', geoFocus: 'Global', sgaClass: 'Global Bond', riskCategory: 'Conservative', riskRating: 1, currency: 'GBP', dividendYield: 2.2382, dividendFrequency: 'Qtrly' },
  { isin: 'LU2881616820', name: 'abrdn SICAV I - Short Dated Enhanced Income A Acc SGD-H', manager: 'Aberdeen Standard Investments', assetClass: 'Bond', geoFocus: 'Global', sgaClass: 'Global Bond', riskCategory: 'Conservative', riskRating: 1, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  { isin: 'LU2014481829', name: 'Allianz Global Opportunistic Bond Cl AMg Dis H2-SGD', manager: 'Allianz Global Investors GmbH', assetClass: 'Bond', geoFocus: 'Global', sgaClass: 'Global Bond', riskCategory: 'Conservative', riskRating: 1, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  // ── Rating 2 — Conservative ───────────────────────────────────────────────
  { isin: 'LU0706718243', name: 'Allianz Flexi Asia Bond AM (H2-AUD)', manager: 'Allianz Global Investors GmbH', assetClass: 'Bond', geoFocus: 'Asia Pacific', sgaClass: 'Asia Pacific ex-Japan Bond', riskCategory: 'Conservative', riskRating: 2, currency: 'AUD', dividendYield: 3.6438, dividendFrequency: 'Mthly' },
  { isin: 'LU1534104291', name: 'Amundi Funds Emerg Mrkt Hrd Crncy Bnd - A2 SGD HD', manager: 'Amundi', assetClass: 'Bond', geoFocus: 'Global Emerging Markets', sgaClass: 'Global EM Bond', riskCategory: 'Conservative', riskRating: 2, currency: 'SGD', dividendYield: 4.8347, dividendFrequency: 'Mthly' },
  { isin: 'LU0830182670', name: 'BGF Asian Tiger Bond A3 SGD Hedged', manager: 'BlackRock', assetClass: 'Bond', geoFocus: 'Asia (ex-Japan)', sgaClass: 'Asia Pacific ex-Japan Bond', riskCategory: 'Conservative', riskRating: 2, currency: 'SGD', dividendYield: 4.2288, dividendFrequency: 'Mthly' },
  { isin: 'LU1558495500', name: 'abrdn SICAV I - Emerging Market Bond Fund A MInc SGD-H', manager: 'Aberdeen Standard Investments', assetClass: 'Bond', geoFocus: 'Global Emerging Markets', sgaClass: 'Global EM Bond', riskCategory: 'Conservative', riskRating: 2, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  { isin: 'LU0228368113', name: 'Eastspring Investments-Asian Bond AS', manager: 'Eastspring Investments', assetClass: 'Bond', geoFocus: 'Asia (ex-Japan)', sgaClass: 'Asia Pacific ex-Japan Bond', riskCategory: 'Conservative', riskRating: 2, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  // ── Rating 3 — Conservative ───────────────────────────────────────────────
  { isin: 'IE00BKPRGK70', name: 'Dimensional World Allocation 20/80 Fund SGD Accumulation', manager: 'Dimensional Ireland Ltd', assetClass: 'Mixed Assets', geoFocus: 'Global', sgaClass: 'Global Multi-Assets', riskCategory: 'Conservative', riskRating: 3, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  { isin: 'LP68368942', name: 'NTUC Income Asian Bond', manager: 'NTUC Income', assetClass: 'Bond', geoFocus: 'Asia (ex-Japan)', sgaClass: 'Asia Pacific ex-Japan Bond', riskCategory: 'Conservative', riskRating: 3, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  // ── Rating 4 — Moderate ───────────────────────────────────────────────────
  { isin: 'LU0679941160', name: 'BGF China Bond A3 CNH', manager: 'BlackRock', assetClass: 'Bond', geoFocus: 'China', sgaClass: 'China Bond', riskCategory: 'Moderate', riskRating: 4, currency: 'CNH', dividendYield: 3.8209, dividendFrequency: 'Mthly' },
  { isin: 'IE00BFG1R668', name: 'Dimensional Global ShTrm Invt Grd Fxd Inc GBP Dist', manager: 'Dimensional Ireland Ltd', assetClass: 'Bond', geoFocus: 'United Kingdom', sgaClass: 'Short Duration Bond', riskCategory: 'Moderate', riskRating: 4, currency: 'GBP', dividendYield: 1.9797, dividendFrequency: 'Semi-Annual' },
  { isin: 'SG9999007462', name: 'Eastspring IUT-Singapore Select Bond AD', manager: 'Eastspring Investments Ltd', assetClass: 'Bond', geoFocus: 'Singapore', sgaClass: 'Singapore Bond', riskCategory: 'Moderate', riskRating: 4, currency: 'SGD', dividendYield: 3.8954, dividendFrequency: 'Qtrly' },
  { isin: 'LU0592505746', name: 'AB American Income Portfolio Fund', manager: 'AllianceBernstein', assetClass: 'Bond', geoFocus: 'US', sgaClass: 'US Bond', riskCategory: 'Moderate', riskRating: 4, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  { isin: 'LU1883849512', name: 'Amundi Funds - US Bond A2 SGD Hgd (C)', manager: 'Amundi', assetClass: 'Bond', geoFocus: 'United States of America', sgaClass: 'US Bond', riskCategory: 'Moderate', riskRating: 4, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  // ── Rating 5 — Moderate ───────────────────────────────────────────────────
  { isin: 'LU1558495252', name: 'AS SICAV I - Diversified Income A MInc Hgd SGD', manager: 'Aberdeen Standard Investments', assetClass: 'Mixed Assets', geoFocus: 'Global', sgaClass: 'Global Multi-Assets', riskCategory: 'Moderate', riskRating: 5, currency: 'SGD', dividendYield: 4.746, dividendFrequency: 'Mthly' },
  { isin: 'LU0203201768', name: 'AB SICAV I-All Market Income Pf AX USD', manager: 'AllianceBernstein', assetClass: 'Mixed Assets', geoFocus: 'Global', sgaClass: 'Global Multi-Assets', riskCategory: 'Moderate', riskRating: 5, currency: 'USD', dividendYield: 3.0685, dividendFrequency: 'Qtrly' },
  { isin: 'LU1412470343', name: 'First Eagle Amundi Income Builder Fund SGD Hedged A2HSMD', manager: 'Amundi', assetClass: 'Mixed Assets', geoFocus: 'Global', sgaClass: 'Global Multi-Assets', riskCategory: 'Moderate', riskRating: 5, currency: 'SGD', dividendYield: 5.357, dividendFrequency: 'Mthly' },
  { isin: 'SG9999019384', name: 'Ascend Asia Global Multi Asset Income Fund SGDH Dis', manager: 'Ascend Asia Pte. Ltd.', assetClass: 'Mixed Assets', geoFocus: 'Global', sgaClass: 'Global Multi-Assets', riskCategory: 'Moderate', riskRating: 5, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  { isin: 'LU0093503497', name: 'BGF ESG Multi-Asset A2 EUR', manager: 'BlackRock', assetClass: 'Mixed Assets', geoFocus: 'Global', sgaClass: 'Global Multi-Assets', riskCategory: 'Moderate', riskRating: 5, currency: 'EUR', dividendYield: null, dividendFrequency: null },
  // ── Rating 6 — Balanced ───────────────────────────────────────────────────
  { isin: 'LU1282649570', name: 'Allianz Asian Multi Income Plus AMg (H2-GBP)', manager: 'Allianz Global Investors GmbH', assetClass: 'Mixed Assets', geoFocus: 'Asia Pacific ex Japan', sgaClass: 'Asia Multi-Assets', riskCategory: 'Balanced', riskRating: 6, currency: 'GBP', dividendYield: 5.7659, dividendFrequency: 'Mthly' },
  { isin: 'LU2088747998', name: 'Eastspring Investments-Asia RE Mlt Asset Inc ADM', manager: 'Eastspring Investments', assetClass: 'Mixed Assets', geoFocus: 'Asia Pacific ex Japan', sgaClass: 'Asia Multi-Assets', riskCategory: 'Balanced', riskRating: 6, currency: 'USD', dividendYield: 7.5097, dividendFrequency: 'Mthly' },
  { isin: 'SG9999019137', name: 'First Sentier Bridge A Monthly Distributing', manager: 'First Sentier Investors', assetClass: 'Mixed Assets', geoFocus: 'Asia Pacific ex Japan', sgaClass: 'Asia Multi-Assets', riskCategory: 'Balanced', riskRating: 6, currency: 'SGD', dividendYield: 4.1465, dividendFrequency: 'Mthly' },
  { isin: 'LU2758875285', name: 'BNP Paribas Asian Equity Capital Guarantee 100 USD', manager: 'BNP Paribas', assetClass: 'Mixed Assets', geoFocus: 'Asia Pacific', sgaClass: 'Asia Multi-Assets', riskCategory: 'Balanced', riskRating: 6, currency: 'USD', dividendYield: null, dividendFrequency: null },
  { isin: 'LU0854292488', name: 'HSBC GIF MS Asia Focused Conservative AC USD', manager: 'HSBC Investment Funds', assetClass: 'Mixed Assets', geoFocus: 'Asia (ex-Japan)', sgaClass: 'Asia Multi-Assets', riskCategory: 'Balanced', riskRating: 6, currency: 'USD', dividendYield: null, dividendFrequency: null },
  // ── Rating 7 — Balanced ───────────────────────────────────────────────────
  { isin: 'LU1489326972', name: 'First Eagle Amundi International Fund - AHS-MD', manager: 'Amundi', assetClass: 'Mixed Assets', geoFocus: 'Global', sgaClass: 'Global Multi-Assets', riskCategory: 'Balanced', riskRating: 7, currency: 'SGD', dividendYield: 3.9616, dividendFrequency: 'Mthly' },
  { isin: 'LU1066049591', name: 'HSBC Portfolios World Selection 3 AMH SGD D', manager: 'HSBC Global', assetClass: 'Mixed Assets', geoFocus: 'Global', sgaClass: 'Global Multi-Assets', riskCategory: 'Balanced', riskRating: 7, currency: 'SGD', dividendYield: 2.7232, dividendFrequency: 'Mthly' },
  { isin: 'SG9999019392', name: 'Ascend Asia Global Multi Asset Growth Fund SGDH Acc', manager: 'Ascend Asia Pte. Ltd.', assetClass: 'Mixed Assets', geoFocus: 'Global', sgaClass: 'Global Multi-Assets', riskCategory: 'Balanced', riskRating: 7, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  { isin: 'IE00BG85LG16', name: 'Dimensional World Allocation 60/40 Fund SGD Accumulation', manager: 'Dimensional Ireland Ltd', assetClass: 'Mixed Assets', geoFocus: 'Global', sgaClass: 'Global Multi-Assets', riskCategory: 'Balanced', riskRating: 7, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  { isin: 'SG9999010128', name: 'Fullerton Total Return Multi-Asset Advantage A', manager: 'Fullerton Fund Management', assetClass: 'Mixed Assets', geoFocus: 'Global', sgaClass: 'Global Multi-Assets', riskCategory: 'Balanced', riskRating: 7, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  // ── Rating 8 — Balanced ───────────────────────────────────────────────────
  { isin: 'LU0820562030', name: 'Allianz Income and Growth AM (H2-AUD)', manager: 'Allianz Global Investors GmbH', assetClass: 'Mixed Assets', geoFocus: 'North America', sgaClass: 'US Multi-Assets', riskCategory: 'Balanced', riskRating: 8, currency: 'AUD', dividendYield: 7.6605, dividendFrequency: 'Mthly' },
  { isin: 'LU0320765646', name: 'Franklin Income A (Mdis) SGD-H1', manager: 'Franklin Templeton', assetClass: 'Mixed Assets', geoFocus: 'United States of America', sgaClass: 'US Multi-Assets', riskCategory: 'Balanced', riskRating: 8, currency: 'SGD', dividendYield: 7.832, dividendFrequency: 'Mthly' },
  { isin: 'LU2521041199', name: 'Capital Group American Balanced Fund (Lux) Bfydmh-SGD', manager: 'Capital Group', assetClass: 'Mixed Assets', geoFocus: 'United States of America', sgaClass: 'US Multi-Assets', riskCategory: 'Balanced', riskRating: 8, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  { isin: 'HSBCLSBF', name: 'HSBC Life Singapore Balanced Fund', manager: 'HSBC Life', assetClass: 'Mixed Assets', geoFocus: 'Singapore', sgaClass: 'Singapore Multi-Asset', riskCategory: 'Balanced', riskRating: 8, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  // ── Rating 9 — Growth ─────────────────────────────────────────────────────
  { isin: 'LU2237443549', name: 'AS SICAV I - Gl Dyn Div A GrossMIncA Hgd SGD', manager: 'Aberdeen Standard Investments', assetClass: 'Equity', geoFocus: 'Global', sgaClass: 'Equity Global', riskCategory: 'Growth', riskRating: 9, currency: 'SGD', dividendYield: 6.328, dividendFrequency: 'Mthly' },
  { isin: 'LU2089284900', name: 'Allianz Global Sustainability AM (H2-SGD)', manager: 'Allianz Global Investors GmbH', assetClass: 'Equity', geoFocus: 'Global', sgaClass: 'Equity Global', riskCategory: 'Growth', riskRating: 9, currency: 'SGD', dividendYield: 3.362, dividendFrequency: 'Mthly' },
  { isin: 'LU0661504455', name: 'BGF Global Equity Income A5G SGD Hedged', manager: 'BlackRock', assetClass: 'Equity', geoFocus: 'Global', sgaClass: 'Equity Global', riskCategory: 'Growth', riskRating: 9, currency: 'SGD', dividendYield: 2.4305, dividendFrequency: 'Qtrly' },
  { isin: 'SG9999000400', name: 'abrdn Global Sustainable Equity SGD', manager: 'Abrdn Asia Ltd', assetClass: 'Equity', geoFocus: 'Global', sgaClass: 'Equity Global', riskCategory: 'Growth', riskRating: 9, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  { isin: 'LU0289960550', name: 'AB FCP I-Global Equity Blend Portfolio A SGD', manager: 'AllianceBernstein', assetClass: 'Equity', geoFocus: 'Global', sgaClass: 'Equity Global', riskCategory: 'Growth', riskRating: 9, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  // ── Rating 10 — Aggressive ────────────────────────────────────────────────
  { isin: 'LU0971552756', name: 'Allianz European Equity Dividend AM (H2-AUD)', manager: 'Allianz Global Investors GmbH', assetClass: 'Equity', geoFocus: 'Europe', sgaClass: 'Equity Europe', riskCategory: 'Aggressive', riskRating: 10, currency: 'AUD', dividendYield: 5.7293, dividendFrequency: 'Mthly' },
  { isin: 'LU1366334578', name: 'Allspring (Lux) WW-Emerg Mkts Eqty Inc A USD Dist', manager: 'Allspring Global Investments', assetClass: 'Equity', geoFocus: 'Global Emerging Markets', sgaClass: 'Equity Emerging Market', riskCategory: 'Aggressive', riskRating: 10, currency: 'USD', dividendYield: 4.2428, dividendFrequency: 'Mthly' },
  { isin: 'LU1051768304', name: 'BGF Emerging Markets Equity Income A6 USD', manager: 'BlackRock', assetClass: 'Equity', geoFocus: 'Global Emerging Markets', sgaClass: 'Equity Emerging Market', riskCategory: 'Aggressive', riskRating: 10, currency: 'USD', dividendYield: 4.1055, dividendFrequency: 'Mthly' },
  { isin: 'LU0011963245', name: 'AS SICAV I - Asia Pac Sust Eq Fd A Acc USD', manager: 'Aberdeen Standard Investments', assetClass: 'Equity', geoFocus: 'Asia Pacific ex Japan', sgaClass: 'Equity Asia Pacific ex Japan', riskCategory: 'Aggressive', riskRating: 10, currency: 'USD', dividendYield: null, dividendFrequency: null },
  { isin: 'SG9999002984', name: 'abrdn Asian Smaller Companies SGD', manager: 'Abrdn Asia Ltd', assetClass: 'Equity', geoFocus: 'Asia Pacific ex Japan', sgaClass: 'Equity Asia Pacific Sm&Mid Cap', riskCategory: 'Aggressive', riskRating: 10, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  // ── Rating 11 — Aggressive ────────────────────────────────────────────────
  { isin: 'LU0204068877', name: 'BGF World Mining A4 GBP', manager: 'BlackRock', assetClass: 'Equity', geoFocus: 'Global', sgaClass: 'Equity Materials', riskCategory: 'Aggressive', riskRating: 11, currency: 'GBP', dividendYield: 1.461, dividendFrequency: 'Annual' },
  { isin: 'LU1054338089', name: 'DWS Invest Global Infrastructure SGD LDMH', manager: 'DWS Investment SA', assetClass: 'Equity', geoFocus: 'Global', sgaClass: 'Equity Infrastructure', riskCategory: 'Aggressive', riskRating: 11, currency: 'SGD', dividendYield: 8.1931, dividendFrequency: 'Mthly' },
  { isin: 'LU0114722498', name: 'Fidelity Funds - Global Financial Serv A-EUR-DIS', manager: 'Fidelity', assetClass: 'Equity', geoFocus: 'Global', sgaClass: 'Equity Financials', riskCategory: 'Aggressive', riskRating: 11, currency: 'EUR', dividendYield: 0.4915, dividendFrequency: 'Annual' },
  { isin: 'LU0289739699', name: 'AB SICAV I-International Health Care Pf A SGD', manager: 'AllianceBernstein', assetClass: 'Equity', geoFocus: 'Global', sgaClass: 'Equity Healthcare', riskCategory: 'Aggressive', riskRating: 11, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  { isin: 'LU1720051017', name: 'Allianz Gl Artificial Intelligence AT (H2-SGD)', manager: 'Allianz Global Investors GmbH', assetClass: 'Equity', geoFocus: 'Global', sgaClass: 'Equity Information Tech', riskCategory: 'Aggressive', riskRating: 11, currency: 'SGD', dividendYield: null, dividendFrequency: null },
  // ── Rating 12 — Aggressive ────────────────────────────────────────────────
  { isin: 'LU1282650156', name: 'Allianz Dynamic Asian High Yield Bd AMg (H2-AUD)', manager: 'Allianz Global Investors GmbH', assetClass: 'Bond', geoFocus: 'Asia Pacific', sgaClass: 'Asia Pacific ex-Japan High Yield Bond', riskCategory: 'Aggressive', riskRating: 12, currency: 'AUD', dividendYield: 6.5786, dividendFrequency: 'Mthly' },
  { isin: 'LU0752094010', name: 'Aviva Investors Global High Yield Bd Am USD', manager: 'Aviva Investors', assetClass: 'Bond', geoFocus: 'Global', sgaClass: 'Global High Yield Bond', riskCategory: 'Aggressive', riskRating: 12, currency: 'USD', dividendYield: 5.2948, dividendFrequency: 'Mthly' },
  { isin: 'LU1564328141', name: 'BGF Asian High Yield Bond A6 USD', manager: 'BlackRock', assetClass: 'Bond', geoFocus: 'Asia Pacific', sgaClass: 'Asia Pacific ex-Japan High Yield Bond', riskCategory: 'Aggressive', riskRating: 12, currency: 'USD', dividendYield: 9.8351, dividendFrequency: 'Mthly' },
  { isin: 'LU0231483743', name: 'AS SICAV I - All China Sust Equity A Acc USD', manager: 'Aberdeen Standard Investments', assetClass: 'Equity', geoFocus: 'Greater China', sgaClass: 'Equity Greater China', riskCategory: 'Aggressive', riskRating: 12, currency: 'USD', dividendYield: null, dividendFrequency: null },
  { isin: 'SG9999000368', name: 'abrdn All China Sustainable Equity SGD', manager: 'Abrdn Asia Ltd', assetClass: 'Equity', geoFocus: 'Greater China', sgaClass: 'Equity Greater China', riskCategory: 'Aggressive', riskRating: 12, currency: 'SGD', dividendYield: null, dividendFrequency: null },
];
