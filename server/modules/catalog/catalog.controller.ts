import type { Request, Response } from "express";
import * as service from "./catalog.service.js";
import type { FundsQuery, ProductsQuery } from "./catalog.schema.js";

export async function listFunds(req: Request, res: Response): Promise<void> {
  const result = await service.listFunds(req.query as unknown as FundsQuery);
  res.json(result);
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  const products = await service.listProducts(req.query as unknown as ProductsQuery);
  res.json({ data: products });
}

export async function listBundles(req: Request, res: Response): Promise<void> {
  const bundles = await service.listBundles(req.query as unknown as ProductsQuery);
  res.json({ data: bundles });
}
