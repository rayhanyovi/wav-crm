import type { Request, Response } from "express";
import { getActor } from "../../middleware/auth.js";
import * as service from "./contacts.service.js";
import type { AddNoteInput, CreateContactInput, ListQuery, UpdateContactInput } from "./contacts.schema.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await service.listContacts(getActor(req), req.query as unknown as ListQuery);
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const contact = await service.getContact(getActor(req), req.params.id as string);
  res.json({ data: contact });
}

export async function create(req: Request, res: Response): Promise<void> {
  const contact = await service.createContact(getActor(req), req.body as CreateContactInput);
  res.status(201).json({ data: contact });
}

export async function update(req: Request, res: Response): Promise<void> {
  const contact = await service.updateContact(
    getActor(req),
    req.params.id as string,
    req.body as UpdateContactInput,
  );
  res.json({ data: contact });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.softDeleteContact(getActor(req), req.params.id as string);
  res.status(204).send();
}

export async function getNotes(req: Request, res: Response): Promise<void> {
  const notes = await service.getContactNotes(getActor(req), req.params.id as string);
  res.json({ data: notes });
}

export async function addNote(req: Request, res: Response): Promise<void> {
  const note = await service.addContactNote(
    getActor(req),
    req.params.id as string,
    req.body as AddNoteInput,
  );
  res.status(201).json({ data: note });
}
