import type { Request, Response } from "express";
import { getActor } from "../../middleware/auth.js";
import * as service from "./activities.service.js";
import type {
  AddCommentInput,
  CreateActivityInput,
  ListQuery,
  UpdateActivityInput,
} from "./activities.schema.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await service.listActivities(getActor(req), req.query as unknown as ListQuery);
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const activity = await service.getActivity(getActor(req), req.params.id as string);
  res.json({ data: activity });
}

export async function create(req: Request, res: Response): Promise<void> {
  const activity = await service.createActivity(getActor(req), req.body as CreateActivityInput);
  res.status(201).json({ data: activity });
}

export async function update(req: Request, res: Response): Promise<void> {
  const activity = await service.updateActivity(
    getActor(req),
    req.params.id as string,
    req.body as UpdateActivityInput,
  );
  res.json({ data: activity });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.softDeleteActivity(getActor(req), req.params.id as string);
  res.status(204).send();
}

export async function getComments(req: Request, res: Response): Promise<void> {
  const comments = await service.getComments(getActor(req), req.params.id as string);
  res.json({ data: comments });
}

export async function addComment(req: Request, res: Response): Promise<void> {
  const comment = await service.addComment(
    getActor(req),
    req.params.id as string,
    req.body as AddCommentInput,
  );
  res.status(201).json({ data: comment });
}
