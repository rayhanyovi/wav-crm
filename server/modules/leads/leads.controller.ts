import type { Request, Response } from "express";
import { getActor } from "../../middleware/auth.js";
import * as service from "./leads.service.js";
import type {
  AddNoteInput,
  ClaimForCallInput,
  ConvertLeadInput,
  CreateLeadInput,
  ListQuery,
  UpdateLeadInput,
} from "./leads.schema.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await service.listLeads(getActor(req), req.query as unknown as ListQuery);
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const lead = await service.getLead(getActor(req), req.params.id as string);
  res.json({ data: lead });
}

export async function create(req: Request, res: Response): Promise<void> {
  const lead = await service.createLead(getActor(req), req.body as CreateLeadInput);
  res.status(201).json({ data: lead });
}

export async function update(req: Request, res: Response): Promise<void> {
  const lead = await service.updateLead(getActor(req), req.params.id as string, req.body as UpdateLeadInput);
  res.json({ data: lead });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.softDeleteLead(getActor(req), req.params.id as string);
  res.status(204).send();
}

export async function claim(req: Request, res: Response): Promise<void> {
  const lead = await service.claimLead(getActor(req), req.params.id as string);
  res.json({ data: lead });
}

export async function returnLead(req: Request, res: Response): Promise<void> {
  const lead = await service.returnLead(getActor(req), req.params.id as string);
  res.json({ data: lead });
}

export async function convert(req: Request, res: Response): Promise<void> {
  const result = await service.convertLead(
    getActor(req),
    req.params.id as string,
    req.body as ConvertLeadInput,
  );
  res.status(201).json({ data: result });
}

export async function claimForCall(req: Request, res: Response): Promise<void> {
  const leads = await service.claimForCall(getActor(req), req.body as ClaimForCallInput);
  res.json({ data: leads });
}

export async function getNotes(req: Request, res: Response): Promise<void> {
  const notes = await service.getLeadNotes(getActor(req), req.params.id as string);
  res.json({ data: notes });
}

export async function addNote(req: Request, res: Response): Promise<void> {
  const note = await service.addLeadNote(
    getActor(req),
    req.params.id as string,
    req.body as AddNoteInput,
  );
  res.status(201).json({ data: note });
}

export async function getStatusHistory(req: Request, res: Response): Promise<void> {
  const history = await service.getLeadStatusHistory(getActor(req), req.params.id as string);
  res.json({ data: history });
}
