import type { Request, Response } from "express";
import { getActor } from "../../middleware/auth.js";
import * as service from "./users.service.js";
import type {
  ApproveUserInput,
  ListQuery,
  OnboardingInput,
  UpdateUserInput,
} from "./users.schema.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await service.listUsers(getActor(req), req.query as unknown as ListQuery);
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const user = await service.getUser(getActor(req), req.params.id as string);
  res.json({ data: user });
}

export async function update(req: Request, res: Response): Promise<void> {
  const user = await service.updateUser(
    getActor(req),
    req.params.id as string,
    req.body as UpdateUserInput,
  );
  res.json({ data: user });
}

export async function listPending(req: Request, res: Response): Promise<void> {
  const users = await service.listPendingUsers(getActor(req));
  res.json({ data: users });
}

export async function approve(req: Request, res: Response): Promise<void> {
  const { role } = req.body as ApproveUserInput;
  const user = await service.approveUser(getActor(req), req.params.id as string, role);
  res.json({ data: user });
}

export async function reject(req: Request, res: Response): Promise<void> {
  const user = await service.rejectUser(getActor(req), req.params.id as string);
  res.json({ data: user });
}

export async function onboarding(req: Request, res: Response): Promise<void> {
  const { name, requested_role } = req.body as OnboardingInput;
  const user = await service.completeOnboarding(getActor(req), name, requested_role);
  res.json({ data: user });
}

export async function activateSuperAdmin(req: Request, res: Response): Promise<void> {
  const user = await service.activateSuperAdmin(getActor(req));
  res.json({ data: user });
}
