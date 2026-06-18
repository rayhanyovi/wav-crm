import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  sgaFund: {
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
  },
  bundle: {
    findMany: vi.fn(),
  },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const { getFundsMeta, listFunds, listProducts, listBundles } = await import("./catalog.service.js");

beforeEach(() => vi.clearAllMocks());

describe("listFunds", () => {
  it("returns canonical funds with pagination", async () => {
    db.sgaFund.findMany.mockResolvedValue([{ id: "fund-1", sourceSheets: ["SGA Master List "], insurers: [] }]);
    db.sgaFund.count.mockResolvedValue(1);

    const result = await listFunds({ page: 1, pageSize: 25 } as never);

    expect(result.total).toBe(1);
    expect(result.data[0]).toMatchObject({ id: "fund-1", sourceSheets: ["SGA Master List "] });
    expect(db.sgaFund.findMany.mock.calls[0]![0]).toMatchObject({
      orderBy: { fundName: "asc" },
      skip: 0,
      take: 25,
    });
    expect(db.sgaFund.findMany.mock.calls[0]![0].select.rawData).toBeUndefined();
    expect(db.sgaFund.findMany.mock.calls[0]![0].select.fundName).toBe(true);
  });

  it("filters search by fund name or ISIN", async () => {
    db.sgaFund.findMany.mockResolvedValue([]);
    db.sgaFund.count.mockResolvedValue(0);

    await listFunds({ search: "dimensional", page: 1, pageSize: 25 } as never);

    expect(db.sgaFund.findMany.mock.calls[0]![0].where.AND[0].OR).toEqual([
      { fundName: { contains: "dimensional", mode: "insensitive" } },
      { isin: { contains: "dimensional", mode: "insensitive" } },
      { fundManagementCompany: { contains: "dimensional", mode: "insensitive" } },
      { sgaClassification: { contains: "dimensional", mode: "insensitive" } },
    ]);
  });

  it("combines source sheet, insurer, platform, and browser filters", async () => {
    db.sgaFund.findMany.mockResolvedValue([]);
    db.sgaFund.count.mockResolvedValue(0);

    await listFunds({
      sourceSheet: "ILP Funds",
      insurer: "FWD",
      platform: "iFAST",
      assetClass: "Bond",
      riskCategory: "Moderate",
      riskRatings: "1,4",
      hasDividend: true,
      page: 2,
      pageSize: 10,
    } as never);

    const args = db.sgaFund.findMany.mock.calls[0]![0];
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(args.where.AND).toEqual([
      { sourceRows: { some: { sheetName: { contains: "ILP Funds", mode: "insensitive" } } } },
      { sourceRows: { some: { insurer: { contains: "FWD", mode: "insensitive" } } } },
      {
        platformRows: {
          some: {
            platformName: { equals: "iFAST", mode: "insensitive" },
            availabilityValue: { notIn: ["NO", "No", "no", "-", "N/A", "n/a"] },
          },
        },
      },
      { assetClass: { equals: "Bond", mode: "insensitive" } },
      { riskClassification: { equals: "Moderate", mode: "insensitive" } },
      { OR: [{ riskRating: 1 }, { riskRating: 4 }] },
      { dividendYield: { not: null } },
    ]);
  });
});

describe("getFundsMeta", () => {
  it("returns total and a stable version from count and latest seed timestamp", async () => {
    db.sgaFund.aggregate.mockResolvedValue({
      _count: { _all: 1694 },
      _max: { seededAt: new Date("2026-06-14T19:24:56.351Z") },
    });

    await expect(getFundsMeta()).resolves.toEqual({
      total: 1694,
      version: "1694:2026-06-14T19:24:56.351Z",
    });
  });

  it("falls back to an 'empty' version when nothing has been seeded", async () => {
    db.sgaFund.aggregate.mockResolvedValue({ _count: { _all: 0 }, _max: { seededAt: null } });
    await expect(getFundsMeta()).resolves.toEqual({ total: 0, version: "0:empty" });
  });
});

describe("listProducts", () => {
  it("returns all products by default", async () => {
    db.product.findMany.mockResolvedValue([{ id: "p1" }]);
    const res = await listProducts({} as never);
    expect(res).toHaveLength(1);
    expect(db.product.findMany.mock.calls[0]![0].where).toEqual({});
  });

  it("filters to active products when active_only is set", async () => {
    db.product.findMany.mockResolvedValue([]);
    await listProducts({ active_only: true } as never);
    expect(db.product.findMany.mock.calls[0]![0].where).toMatchObject({ isActive: true });
  });
});

describe("listBundles", () => {
  it("returns bundles with nested products, filtered by active_only", async () => {
    db.bundle.findMany.mockResolvedValue([{ id: "b1", products: [] }]);
    const res = await listBundles({ active_only: true } as never);
    expect(res).toHaveLength(1);
    expect(db.bundle.findMany.mock.calls[0]![0]).toMatchObject({
      where: { isActive: true },
      include: { products: { include: { product: true } } },
    });
  });
});
