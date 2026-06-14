import type { Request, Response } from "express";
import { getActor } from "../../middleware/auth.js";
import * as service from "./deals.service.js";
import type {
  AddProposalLineInput,
  CreateDealInput,
  CreateProposalInput,
  ListQuery,
  StageTransitionInput,
  UpdateDealInput,
  UpdateProposalInput,
} from "./deals.schema.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await service.listDeals(getActor(req), req.query as unknown as ListQuery);
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const deal = await service.getDeal(getActor(req), req.params.id as string);
  res.json({ data: deal });
}

export async function create(req: Request, res: Response): Promise<void> {
  const deal = await service.createDeal(getActor(req), req.body as CreateDealInput);
  res.status(201).json({ data: deal });
}

export async function update(req: Request, res: Response): Promise<void> {
  const deal = await service.updateDeal(getActor(req), req.params.id as string, req.body as UpdateDealInput);
  res.json({ data: deal });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.softDeleteDeal(getActor(req), req.params.id as string);
  res.status(204).send();
}

export async function stage(req: Request, res: Response): Promise<void> {
  const deal = await service.advanceStage(
    getActor(req),
    req.params.id as string,
    req.body as StageTransitionInput,
  );
  res.json({ data: deal });
}

export async function claim(req: Request, res: Response): Promise<void> {
  const deal = await service.claimDeal(getActor(req), req.params.id as string);
  res.json({ data: deal });
}

export async function release(req: Request, res: Response): Promise<void> {
  const deal = await service.releaseDeal(getActor(req), req.params.id as string);
  res.json({ data: deal });
}

export async function getProposals(req: Request, res: Response): Promise<void> {
  const proposals = await service.getProposals(getActor(req), req.params.id as string);
  res.json({ data: proposals });
}

export async function createProposal(req: Request, res: Response): Promise<void> {
  const proposal = await service.createProposal(
    getActor(req),
    req.params.id as string,
    req.body as CreateProposalInput,
  );
  res.status(201).json({ data: proposal });
}

export async function updateProposal(req: Request, res: Response): Promise<void> {
  const proposal = await service.updateProposal(
    getActor(req),
    req.params.id as string,
    req.params.proposalId as string,
    req.body as UpdateProposalInput,
  );
  res.json({ data: proposal });
}

export async function addProposalLine(req: Request, res: Response): Promise<void> {
  const line = await service.addProposalLine(
    getActor(req),
    req.params.id as string,
    req.params.proposalId as string,
    req.body as AddProposalLineInput,
  );
  res.status(201).json({ data: line });
}

export async function removeProposalLine(req: Request, res: Response): Promise<void> {
  await service.removeProposalLine(
    getActor(req),
    req.params.id as string,
    req.params.proposalId as string,
    req.params.lineId as string,
  );
  res.status(204).send();
}

export async function getStageHistory(req: Request, res: Response): Promise<void> {
  const history = await service.getStageHistory(getActor(req), req.params.id as string);
  res.json({ data: history });
}
