import type { Bundle, Prisma, Product, SgaFund } from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import type { FundsQuery, ProductsQuery } from "./catalog.schema.js";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listFunds(query: FundsQuery): Promise<Paginated<SgaFund>> {
  const where: Prisma.SgaFundWhereInput = {};
  if (query.search) {
    where.OR = [
      { fundName: { contains: query.search, mode: "insensitive" } },
      { isin: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.sgaFund.findMany({
      where,
      orderBy: { fundName: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.sgaFund.count({ where }),
  ]);

  return { data, total, page: query.page, pageSize: query.pageSize };
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
