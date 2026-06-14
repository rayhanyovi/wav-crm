import { randomUUID } from "node:crypto";
import type { Contact, ContactNote, Prisma } from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import type { Actor } from "../../middleware/context.js";
import {
  canCreateContact,
  canDeleteContact,
  canListContacts,
  canUpdateContact,
  canViewContact,
} from "./contacts.authz.js";
import type { AddNoteInput, CreateContactInput, ListQuery, UpdateContactInput } from "./contacts.schema.js";
import { writeAuditLog } from "./contacts.sideEffects.js";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

async function getSharedAdviserIdsForTelemarketer(
  db: Pick<typeof prisma, "crmUser">,
  actor: Actor,
): Promise<string[]> {
  if (actor.role !== "TELEMARKETER") return [];
  const advisers = await db.crmUser.findMany({
    where: {
      role: "ADVISER",
      isActive: true,
      telemarketerAccess: true,
      telemarketerId: actor.id,
    },
    select: { id: true },
  });
  return advisers.map((adviser) => adviser.id);
}

export async function listContacts(actor: Actor, query: ListQuery): Promise<Paginated<Contact>> {
  if (!canListContacts(actor)) throw new ForbiddenError("Not allowed to view contacts");

  const where: Prisma.ContactWhereInput = { deletedAt: null };
  const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(prisma, actor);
  if (actor.role === "TELEMARKETER") {
    where.createdBy = { in: [actor.id, ...sharedAdviserIds] };
  }
  if (query.search) {
    const searchFilter: Prisma.ContactWhereInput = {
      OR: [
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search } },
      ],
    };
    if (where.createdBy) {
      where.AND = [{ createdBy: where.createdBy }, searchFilter];
      delete where.createdBy;
    } else {
      Object.assign(where, searchFilter);
    }
  }

  const [data, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.contact.count({ where }),
  ]);

  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function getContact(actor: Actor, id: string): Promise<Contact> {
  const contact = await prisma.contact.findFirst({ where: { id, deletedAt: null } });
  if (!contact) throw new NotFoundError("Contact not found");
  const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(prisma, actor);
  if (!canViewContact(actor, contact, sharedAdviserIds)) throw new ForbiddenError("Not allowed to view contacts");
  return contact;
}

export async function createContact(actor: Actor, input: CreateContactInput): Promise<Contact> {
  if (!canCreateContact(actor)) throw new ForbiddenError("Not allowed to create contacts");

  return prisma.$transaction(async (tx) => {
    const contact = await tx.contact.create({
      data: {
        id: randomUUID(),
        firstName: input.first_name,
        lastName: input.last_name,
        email: input.email,
        phone: input.phone,
        title: input.title,
        source: input.source,
        financialGoal: input.financial_goal,
        riskTolerance: input.risk_tolerance,
        investmentHorizon: input.investment_horizon,
        monthlyInvestable: input.monthly_investable,
        existingInvestments: input.existing_investments,
        factFindNotes: input.fact_find_notes,
        factFindDone: input.fact_find_done,
        createdBy: actor.id,
      },
    });

    await writeAuditLog(tx, { userId: actor.id, action: "CREATE", entityId: contact.id, old: null, next: contact });
    return contact;
  });
}

export async function updateContact(
  actor: Actor,
  id: string,
  input: UpdateContactInput,
): Promise<Contact> {
  return prisma.$transaction(async (tx) => {
    const prev = await tx.contact.findFirst({ where: { id, deletedAt: null } });
    if (!prev) throw new NotFoundError("Contact not found");
    const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(tx, actor);
    if (!canUpdateContact(actor, prev, sharedAdviserIds)) throw new ForbiddenError("Not allowed to update contacts");

    const data: Prisma.ContactUpdateInput = {};
    if (input.first_name !== undefined) data.firstName = input.first_name;
    if (input.last_name !== undefined) data.lastName = input.last_name;
    if (input.email !== undefined) data.email = input.email ?? undefined;
    if (input.phone !== undefined) data.phone = input.phone ?? undefined;
    if (input.title !== undefined) data.title = input.title ?? undefined;
    if (input.source !== undefined) data.source = input.source;
    if (input.financial_goal !== undefined) data.financialGoal = input.financial_goal ?? undefined;
    if (input.risk_tolerance !== undefined) data.riskTolerance = input.risk_tolerance ?? undefined;
    if (input.investment_horizon !== undefined) data.investmentHorizon = input.investment_horizon ?? undefined;
    if (input.monthly_investable !== undefined) data.monthlyInvestable = input.monthly_investable ?? undefined;
    if (input.existing_investments !== undefined) data.existingInvestments = input.existing_investments ?? undefined;
    if (input.fact_find_notes !== undefined) data.factFindNotes = input.fact_find_notes ?? undefined;
    if (input.fact_find_done !== undefined) data.factFindDone = input.fact_find_done ?? undefined;

    const next = await tx.contact.update({ where: { id }, data });
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: prev, next });
    return next;
  });
}

export async function softDeleteContact(actor: Actor, id: string): Promise<void> {
  if (!canDeleteContact(actor)) throw new ForbiddenError("Only MASTER can delete contacts");

  await prisma.$transaction(async (tx) => {
    const contact = await tx.contact.findFirst({ where: { id, deletedAt: null } });
    if (!contact) throw new NotFoundError("Contact not found");

    await tx.contact.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(tx, { userId: actor.id, action: "DELETE", entityId: id, old: contact, next: null });
  });
}

export async function getContactNotes(actor: Actor, contactId: string): Promise<ContactNote[]> {
  const contact = await prisma.contact.findFirst({ where: { id: contactId, deletedAt: null } });
  if (!contact) throw new NotFoundError("Contact not found");
  const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(prisma, actor);
  if (!canViewContact(actor, contact, sharedAdviserIds)) throw new ForbiddenError("Not allowed to view contacts");
  return prisma.contactNote.findMany({ where: { contactId }, orderBy: { createdAt: "desc" } });
}

export async function addContactNote(
  actor: Actor,
  contactId: string,
  input: AddNoteInput,
): Promise<ContactNote> {
  const contact = await prisma.contact.findFirst({ where: { id: contactId, deletedAt: null } });
  if (!contact) throw new NotFoundError("Contact not found");
  const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(prisma, actor);
  if (!canViewContact(actor, contact, sharedAdviserIds)) throw new ForbiddenError("Not allowed to add notes to contacts");
  return prisma.contactNote.create({
    data: { contactId, content: input.content, createdBy: actor.id },
  });
}
