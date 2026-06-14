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

function nullable(value) {
  const text = clean(value);
  if (!text || text === "-" || /^null$/i.test(text)) return null;
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
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const parsed = new Date(clean(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function headerMap(row) {
  const map = new Map();
  row.forEach((value, index) => {
    const key = clean(value).toLowerCase();
    if (key) map.set(key, index);
  });
  return map;
}

function cell(row, map, ...names) {
  for (const name of names) {
    const index = map.get(name.toLowerCase());
    if (index != null) return row[index];
  }
  return null;
}

function rowObject(row, headers) {
  const raw = {};
  headers.forEach((header, index) => {
    raw[clean(header) || `column_${index + 1}`] = row[index] ?? null;
  });
  return raw;
}

function stableFundId(sheetName, rowNumber, isin, fundName) {
  const slug = [sheetName, rowNumber, isin, fundName]
    .map((part) => clean(part).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x")
    .join("-");
  return `fund-${slug}`.slice(0, 220);
}

function rowsFromSheet(workbook, sheetName) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
}

function findHeaderIndex(rows) {
  return rows.findIndex((row) => row.some((value) => clean(value).toLowerCase() === "isin"));
}

function dividendKey(isin, fundName) {
  return `${clean(isin).toUpperCase()}::${clean(fundName).toLowerCase()}`;
}

function parseDividendRows(workbook) {
  const dividends = new Map();
  for (const sheetName of ["Dividend paying Funds", "Dividend paying Funds (work)"]) {
    if (!workbook.SheetNames.includes(sheetName)) continue;
    const rows = rowsFromSheet(workbook, sheetName);
    const headerIndex = findHeaderIndex(rows);
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map(clean);
    const map = headerMap(headers);

    rows.slice(headerIndex + 1).forEach((row) => {
      const isin = nullable(cell(row, map, "ISIN"));
      const fundName = nullable(cell(row, map, "Fund Name"));
      if (!isin || !fundName) return;
      dividends.set(dividendKey(isin, fundName), {
        dividendYield: numberOrNull(cell(row, map, "Est. Dividend Yield (%)", "Dividend Yield")),
        lastDividendExDate: dateOrNull(cell(row, map, "Last Dividend Ex-Date", "Last Dividend \nEx-Date", "Dividend Date")),
        dividendFrequency: nullable(cell(row, map, "Dividend Frequency")),
      });
    });
  }
  return dividends;
}

function parseMasterFunds(workbook) {
  const sheetName = workbook.SheetNames.find((name) => clean(name) === "SGA Master List");
  if (!sheetName) throw new Error("Could not find SGA Master List sheet");

  const rows = rowsFromSheet(workbook, sheetName);
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) throw new Error("Could not find SGA Master List header row");

  const headers = rows[headerIndex].map(clean);
  const map = headerMap(headers);
  const dividends = parseDividendRows(workbook);

  return rows.slice(headerIndex + 1).flatMap((row, index) => {
    const sourceRowNumber = headerIndex + index + 2;
    const isin = nullable(cell(row, map, "ISIN"));
    const fundName = nullable(cell(row, map, "Fund Name"));
    if (!isin || !fundName) return [];

    const platforms = {};
    [
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
    ].forEach((name) => {
      const value = nullable(cell(row, map, name));
      if (value) platforms[name] = value;
    });

    const dividend = dividends.get(dividendKey(isin, fundName)) ?? {};

    return {
      id: stableFundId(sheetName, sourceRowNumber, isin, fundName),
      sourceSheet: sheetName,
      sourceRowNumber,
      isin,
      fundManagementCompany: nullable(cell(row, map, "Fund Management Company")),
      fundName,
      currency: nullable(cell(row, map, "Currency")),
      assetClass: nullable(cell(row, map, "Asset Class")),
      geographicFocus: nullable(cell(row, map, "Geographic Focus")),
      sgaClassification: nullable(cell(row, map, "SGA Classification")),
      riskClassification: nullable(cell(row, map, "Fund Risk Classification", "Risk")),
      riskRating: numberOrNull(cell(row, map, "Fund Risk Rating")),
      managementFee: numberOrNull(cell(row, map, "Management Fee")),
      totalExpenseRatio: numberOrNull(cell(row, map, "Total Expense Ratio")),
      inceptionDate: dateOrNull(cell(row, map, "Inception Date")),
      dividendYield: dividend.dividendYield ?? null,
      lastDividendExDate: dividend.lastDividendExDate ?? null,
      dividendFrequency: dividend.dividendFrequency ?? null,
      platformAvailability: platforms,
      rawData: rowObject(row, headers),
    };
  });
}

async function main() {
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const funds = parseMasterFunds(workbook);

  console.log(`Parsed ${funds.length} SGA Master List funds from ${workbookPath}`);
  await prisma.sgaFund.deleteMany({});

  for (let index = 0; index < funds.length; index += 500) {
    await prisma.sgaFund.createMany({ data: funds.slice(index, index + 500) });
  }

  const count = await prisma.sgaFund.count();
  console.log(`Imported ${count} rows into public.sga_funds`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
