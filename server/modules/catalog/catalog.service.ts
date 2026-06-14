import type { Bundle, Prisma, Product, SgaFund } from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import type { FundsQuery, ProductsQuery } from "./catalog.schema.js";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

function mapCatalogFund(row: SgaFund) {
  return {
    ...row,
    platformAvailability: row.platformAvailability,
    sourceSheets: row.sourceSheets,
    insurers: row.insurers,
  };
}

function parseRiskRatings(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 12);
}

export async function listFunds(query: FundsQuery): Promise<Paginated<ReturnType<typeof mapCatalogFund>>> {
  const where: Prisma.SgaFundWhereInput = {};
  const and: Prisma.SgaFundWhereInput[] = [];
  if (query.search) {
    and.push({
      OR: [
        { fundName: { contains: query.search, mode: "insensitive" } },
        { isin: { contains: query.search, mode: "insensitive" } },
        { fundManagementCompany: { contains: query.search, mode: "insensitive" } },
        { sgaClassification: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }
  if (query.sourceSheet) {
    and.push({
      sourceRows: {
        some: { sheetName: { contains: query.sourceSheet, mode: "insensitive" } },
      },
    });
  }
  if (query.insurer) {
    and.push({
      sourceRows: {
        some: { insurer: { contains: query.insurer, mode: "insensitive" } },
      },
    });
  }
  if (query.platform) {
    and.push({
      platformRows: {
        some: {
          platformName: { equals: query.platform, mode: "insensitive" },
          availabilityValue: { notIn: ["NO", "No", "no", "-", "N/A", "n/a"] },
        },
      },
    });
  }
  if (query.assetClass) {
    and.push({ assetClass: { equals: query.assetClass, mode: "insensitive" } });
  }
  if (query.riskCategory) {
    and.push({ riskClassification: { equals: query.riskCategory, mode: "insensitive" } });
  }
  const riskRatings = parseRiskRatings(query.riskRatings);
  if (riskRatings.length > 0) {
    and.push({
      OR: riskRatings.map((rating) => ({ riskRating: rating })),
    });
  }
  if (query.hasDividend) {
    and.push({ dividendYield: { not: null } });
  }
  if (and.length > 0) where.AND = and;

  const [data, total] = await Promise.all([
    prisma.sgaFund.findMany({
      where,
      orderBy: { fundName: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.sgaFund.count({ where }),
  ]);

  return { data: data.map(mapCatalogFund), total, page: query.page, pageSize: query.pageSize };
}

export async function listProducts(query: ProductsQuery): Promise<Product[]> {
  const where: Prisma.ProductWhereInput = {};
  if (query.active_only) where.isActive = true;
  return prisma.product.findMany({ where, orderBy: { name: "asc" } });
}

export async function listBundles(query: ProductsQuery): Promise<Bundle[]> {
  const where: Prisma.BundleWhereInput = {};
  if (query.active_only) where.isActive = true;
  return prisma.bundle.findMany({
    where,
    include: { products: { include: { product: true } } },
    orderBy: { name: "asc" },
  });
}
