import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import XLSX from "xlsx";
import { PrismaClient } from "../prisma/generated/client/index.js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const DEFAULT_WORKBOOK = "/Users/rayhan/Downloads/WAV's copy of SGA Master Fund List.xlsx";
const workbookPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_WORKBOOK;

const SOURCE_SHEETS = {
  master: "SGA Master List",
  dividend: "Dividend paying Funds",
  ilp: "ILP Funds",
};

const PLATFORM_COLUMNS = [
  "CPF-OA",
  "CPF-SA",
  "Navi",
  "iFAST",
  "PSPL (FAME)",
  "Singlife",
  "FWD",
  "Manulife",
  "Tokio Marine",
  "Income",
  "HSBC Life",
  "Etiqa",
];

function prismaUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.port === "6543" || parsed.hostname.includes("pooler.supabase.com")) {
      parsed.searchParams.set("pgbouncer", "true");
      parsed.searchParams.set("connection_limit", "1");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const prisma = new PrismaClient(
  prismaUrl() ? { datasources: { db: { url: prismaUrl() } } } : undefined,
);

function clean(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalized(value) {
  return clean(value).toLowerCase();
}

function nullable(value) {
  const text = clean(value);
  if (!text || text === "-" || /^null$/i.test(text)) return null;
  return text;
}

function requiredText(value) {
  const text = clean(value);
  if (!text || /^null$/i.test(text)) return null;
  return text;
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = clean(value).replace(/[%,$]/g, "");
  if (!text || text === "-") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(value) {
  if (value == null || value === "" || value === "-") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const parsed = new Date(clean(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function jsonValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return value ?? null;
}

function headerMap(row) {
  const map = new Map();
  row.forEach((value, index) => {
    const key = normalized(value);
    if (key) map.set(key, index);
  });
  return map;
}

function cell(row, map, ...names) {
  for (const name of names) {
    const index = map.get(normalized(name));
    if (index != null) return row[index];
  }
  return null;
}

function rowObject(row, headers) {
  const raw = {};
  headers.forEach((header, index) => {
    raw[clean(header) || `column_${index + 1}`] = jsonValue(row[index]);
  });
  return raw;
}

function slug(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
}

function digest(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function fundKey(row) {
  return [row.isin, row.fundName, row.currency].map((value) => normalized(value)).join("::");
}

function stableFundId(row) {
  const key = fundKey(row);
  return `fund-${slug(row.isin)}-${slug(row.currency)}-${digest(key)}`;
}

function stableSourceRowId(sheetName, rowNumber) {
  return `sga-row-${slug(sheetName)}-${rowNumber}`;
}

function stablePlatformId(sourceRowId, platformName) {
  return `sga-platform-${sourceRowId}-${digest(platformName)}`;
}

function rowsFromSheet(workbook, sheetName) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
}

function findSheetName(workbook, expectedName) {
  const sheetName = workbook.SheetNames.find((name) => clean(name) === expectedName);
  if (!sheetName) throw new Error(`Could not find sheet: ${expectedName}`);
  return sheetName;
}

function findHeaderIndex(rows) {
  return rows.findIndex((row) => row.some((value) => normalized(value) === "isin"));
}

function parseSheetRows(workbook, expectedName) {
  const sheetName = findSheetName(workbook, expectedName);
  const rows = rowsFromSheet(workbook, sheetName);
  const headerIndex = expectedName === SOURCE_SHEETS.ilp ? 0 : findHeaderIndex(rows);
  if (headerIndex < 0) throw new Error(`Could not find header row for ${expectedName}`);

  const headers = rows[headerIndex].map(clean);
  if (expectedName === SOURCE_SHEETS.ilp) headers[0] = "ISIN";
  const map = headerMap(headers);

  return rows.slice(headerIndex + 1).map((row, index) => {
    const sourceRowNumber = headerIndex + index + 2;
    const parsed = {
      sheetName,
      sourceRowNumber,
      isin: requiredText(cell(row, map, "ISIN")),
      fundManagementCompany: nullable(cell(row, map, "Fund Management Company")),
      insurer: nullable(cell(row, map, "Insurer")),
      fundName: nullable(cell(row, map, "Fund Name")),
      currency: nullable(cell(row, map, "Currency")),
      assetClass: nullable(cell(row, map, "Asset Class")),
      geographicFocus: nullable(cell(row, map, "Geographic Focus")),
      sgaClassification: nullable(cell(row, map, "SGA Classification")),
      riskClassification: nullable(cell(row, map, "Fund Risk Classification", "Risk")),
      riskRating: numberOrNull(cell(row, map, "Fund Risk Rating")),
      managementFee: numberOrNull(cell(row, map, "Management Fee")),
      totalExpenseRatio: numberOrNull(cell(row, map, "Total Expense Ratio")),
      inceptionDate: dateOrNull(cell(row, map, "Inception Date")),
      dividendYield: numberOrNull(cell(row, map, "Est. Dividend Yield (%)", "Dividend Yield")),
      dividendDate: dateOrNull(cell(row, map, "Last Dividend Ex-Date", "Last Dividend \nEx-Date", "Dividend Date")),
      dividendFrequency: nullable(cell(row, map, "Dividend Frequency")),
      rawData: rowObject(row, headers),
      platformAvailability: {},
    };

    for (const platformName of PLATFORM_COLUMNS) {
      const value = nullable(cell(row, map, platformName));
      if (value) parsed.platformAvailability[platformName] = value;
    }

    if (!parsed.isin || !parsed.fundName || !parsed.currency) {
      throw new Error(
        `Invalid ${sheetName} row ${sourceRowNumber}: ISIN, Fund Name, and Currency are required`,
      );
    }

    return parsed;
  });
}

function pick(current, incoming) {
  return current ?? incoming ?? null;
}

function mergeCanonicalFund(fund, row) {
  fund.sourceSheets.add(row.sheetName);
  fund.sourceRows.push(row);
  if (row.insurer) fund.insurers.add(row.insurer);

  fund.fundManagementCompany = pick(fund.fundManagementCompany, row.fundManagementCompany);
  fund.assetClass = pick(fund.assetClass, row.assetClass);
  fund.geographicFocus = pick(fund.geographicFocus, row.geographicFocus);
  fund.sgaClassification = pick(fund.sgaClassification, row.sgaClassification);
  fund.riskClassification = pick(fund.riskClassification, row.riskClassification);
  fund.riskRating = pick(fund.riskRating, row.riskRating);
  fund.managementFee = pick(fund.managementFee, row.managementFee);
  fund.totalExpenseRatio = pick(fund.totalExpenseRatio, row.totalExpenseRatio);
  fund.inceptionDate = pick(fund.inceptionDate, row.inceptionDate);
  fund.dividendYield = pick(fund.dividendYield, row.dividendYield);
  fund.dividendDate = pick(fund.dividendDate, row.dividendDate);
  fund.dividendFrequency = pick(fund.dividendFrequency, row.dividendFrequency);

  for (const [platformName, value] of Object.entries(row.platformAvailability)) {
    const existing = fund.platformAvailability[platformName];
    if (!existing || (existing === "NO" && value !== "NO")) {
      fund.platformAvailability[platformName] = value;
    }
  }
}

function buildCatalog(workbook) {
  const sourceRows = [
    ...parseSheetRows(workbook, SOURCE_SHEETS.master),
    ...parseSheetRows(workbook, SOURCE_SHEETS.dividend),
    ...parseSheetRows(workbook, SOURCE_SHEETS.ilp),
  ];

  const funds = new Map();
  for (const row of sourceRows) {
    const key = fundKey(row);
    if (!funds.has(key)) {
      funds.set(key, {
        id: stableFundId(row),
        sourceSheet: row.sheetName,
        sourceRowNumber: row.sourceRowNumber,
        sourceSheets: new Set(),
        isin: row.isin,
        fundManagementCompany: row.fundManagementCompany,
        fundName: row.fundName,
        currency: row.currency,
        assetClass: row.assetClass,
        geographicFocus: row.geographicFocus,
        sgaClassification: row.sgaClassification,
        riskClassification: row.riskClassification,
        riskRating: row.riskRating,
        managementFee: row.managementFee,
        totalExpenseRatio: row.totalExpenseRatio,
        inceptionDate: row.inceptionDate,
        dividendYield: row.dividendYield,
        dividendDate: row.dividendDate,
        dividendFrequency: row.dividendFrequency,
        insurers: new Set(row.insurer ? [row.insurer] : []),
        platformAvailability: { ...row.platformAvailability },
        sourceRows: [],
      });
    }
    mergeCanonicalFund(funds.get(key), row);
  }

  const fundRows = [];
  const provenanceRows = [];
  const platformRows = [];

  for (const fund of funds.values()) {
    fundRows.push({
      id: fund.id,
      sourceSheet: fund.sourceSheet,
      sourceRowNumber: fund.sourceRowNumber,
      sourceSheets: [...fund.sourceSheets],
      isin: fund.isin,
      fundManagementCompany: fund.fundManagementCompany,
      fundName: fund.fundName,
      currency: fund.currency,
      assetClass: fund.assetClass,
      geographicFocus: fund.geographicFocus,
      sgaClassification: fund.sgaClassification,
      riskClassification: fund.riskClassification,
      riskRating: fund.riskRating,
      managementFee: fund.managementFee,
      totalExpenseRatio: fund.totalExpenseRatio,
      inceptionDate: fund.inceptionDate,
      dividendYield: fund.dividendYield,
      dividendDate: fund.dividendDate,
      lastDividendExDate: fund.dividendDate,
      dividendFrequency: fund.dividendFrequency,
      insurers: [...fund.insurers],
      platformAvailability: fund.platformAvailability,
      rawData: {
        canonicalKey: fundKey(fund),
        sourceSheets: [...fund.sourceSheets],
        sourceRowCount: fund.sourceRows.length,
      },
    });

    for (const row of fund.sourceRows) {
      const sourceRowId = stableSourceRowId(row.sheetName, row.sourceRowNumber);
      provenanceRows.push({
        id: sourceRowId,
        fundId: fund.id,
        sheetName: row.sheetName,
        sourceRowNumber: row.sourceRowNumber,
        isin: row.isin,
        fundManagementCompany: row.fundManagementCompany,
        insurer: row.insurer,
        fundName: row.fundName,
        currency: row.currency,
        assetClass: row.assetClass,
        geographicFocus: row.geographicFocus,
        sgaClassification: row.sgaClassification,
        riskClassification: row.riskClassification,
        riskRating: row.riskRating,
        managementFee: row.managementFee,
        totalExpenseRatio: row.totalExpenseRatio,
        inceptionDate: row.inceptionDate,
        dividendYield: row.dividendYield,
        dividendDate: row.dividendDate,
        dividendFrequency: row.dividendFrequency,
        rawData: row.rawData,
      });

      for (const [platformName, value] of Object.entries(row.platformAvailability)) {
        platformRows.push({
          id: stablePlatformId(sourceRowId, platformName),
          fundId: fund.id,
          sourceRowId,
          platformName,
          availabilityValue: value,
          sourceSheet: row.sheetName,
          sourceRowNumber: row.sourceRowNumber,
        });
      }
    }
  }

  return { fundRows, provenanceRows, platformRows, sourceRows };
}

async function createManyInBatches(model, rows, size = 500) {
  for (let index = 0; index < rows.length; index += size) {
    await model.createMany({ data: rows.slice(index, index + size) });
  }
}

async function main() {
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const { fundRows, provenanceRows, platformRows, sourceRows } = buildCatalog(workbook);

  console.log(`Parsed ${sourceRows.length} source rows from ${workbookPath}`);
  console.log(`Built ${fundRows.length} canonical SGA funds`);

  await prisma.$transaction(async (tx) => {
    await tx.sgaFundPlatformAvailability.deleteMany({});
    await tx.sgaFundSourceRow.deleteMany({});
    await tx.sgaFund.deleteMany({});
    await createManyInBatches(tx.sgaFund, fundRows);
    await createManyInBatches(tx.sgaFundSourceRow, provenanceRows);
    await createManyInBatches(tx.sgaFundPlatformAvailability, platformRows);
  }, { timeout: 60_000 });

  const [fundCount, sourceCount, platformCount, bySheet] = await Promise.all([
    prisma.sgaFund.count(),
    prisma.sgaFundSourceRow.count(),
    prisma.sgaFundPlatformAvailability.count(),
    prisma.sgaFundSourceRow.groupBy({
      by: ["sheetName"],
      _count: { _all: true },
      orderBy: { sheetName: "asc" },
    }),
  ]);

  console.log(`Imported ${fundCount} rows into public.sga_funds`);
  console.log(`Imported ${sourceCount} rows into public.sga_fund_source_rows`);
  console.log(`Imported ${platformCount} rows into public.sga_fund_platform_availability`);
  console.table(bySheet.map((row) => ({ sheet: row.sheetName, rows: row._count._all })));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
