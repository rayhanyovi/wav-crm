import { randomUUID } from "node:crypto";
import type { Lead, LeadNote, LeadStatusHistory, Prisma } from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors.js";
import type { Actor } from "../../middleware/context.js";
import {
  canClaimAppointmentLead,
  canClaimForCall,
  canConvertLead,
  canCreateLead,
  canDeleteLead,
  canListLeads,
  canUpdateLead,
  canViewLead,
} from "./leads.authz.js";
import type {
  AddNoteInput,
  ClaimForCallInput,
  ConvertLeadInput,
  CreateLeadInput,
  ListQuery,
  UpdateLeadInput,
} from "./leads.schema.js";
import {
  buildLeadNotifications,
  deriveStatusColumns,
  emitLeadNotifications,
  recordStatusHistory,
  recordStatusNote,
  writeAuditLog,
} from "./leads.sideEffects.js";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Maps the snake_case update DTO onto Prisma's camelCase fields (patch only). */
function toPrismaUpdate(input: UpdateLeadInput): Prisma.LeadUpdateInput {
  const out: Prisma.LeadUpdateInput = {};
  const set = <K extends keyof Prisma.LeadUpdateInput>(k: K, v: Prisma.LeadUpdateInput[K]) => {
    if (v !== undefined) out[k] = v;
  };
  set("salutation", input.salutation);
  set("firstName", input.first_name);
  set("lastName", input.last_name);
  set("email", input.email);
  set("phone", input.phone);
  set("age", input.age);
  set("gender", input.gender);
  set("status", input.status);
  set("source", input.source);
  set("notes", input.notes);
  set("appointmentDate", input.appointment_date);
  set("appointmentTime", input.appointment_time);
  set("assignedToId", input.assigned_to_id);
  set("telemarketerOwnerId", input.telemarketer_owner_id);
  set("adviserOwnerId", input.adviser_owner_id);
  set("bounceCount", input.bounce_count ?? undefined);
  set("convertedContactId", input.converted_contact_id);
  set("factFindDone", input.fact_find_done);
  set("factFindNotes", input.fact_find_notes);
  return out;
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

export async function listLeads(actor: Actor, query: ListQuery): Promise<Paginated<Lead>> {
  if (!canListLeads(actor)) throw new ForbiddenError("Not allowed to view leads");

  const where: Prisma.LeadWhereInput = { deletedAt: null };
  if (!query.includeAbandoned) where.isAbandoned = false;
  if (query.status) where.status = query.status;
  if (query.source) where.source = query.source;

  const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(prisma, actor);
  const telemarketerScope: Prisma.LeadWhereInput = {
    OR: [
      { telemarketerOwnerId: actor.id },
      { telemarketerOwnerId: null },
      ...(sharedAdviserIds.length > 0
        ? [
            { assignedToId: { in: sharedAdviserIds } },
            { adviserOwnerId: { in: sharedAdviserIds } },
          ]
        : []),
    ],
  };

  const scopeFilter: Prisma.LeadWhereInput | null =
    actor.role === "MASTER" || (actor.role === "ADVISER" && actor.leadsAccess)
      ? null
      : actor.role === "TELEMARKETER"
        ? telemarketerScope
        : { OR: [{ assignedToId: actor.id }, { adviserOwnerId: actor.id }] };

  const searchFilter: Prisma.LeadWhereInput | null = query.search
    ? {
        OR: [
          { firstName: { contains: query.search, mode: "insensitive" } },
          { lastName: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
          { phone: { contains: query.search } },
        ],
      }
    : null;

  if (scopeFilter && searchFilter) where.AND = [scopeFilter, searchFilter];
  else if (scopeFilter) Object.assign(where, scopeFilter);
  else if (searchFilter) Object.assign(where, searchFilter);

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function getLead(actor: Actor, id: string): Promise<Lead> {
  const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) throw new NotFoundError("Lead not found");
  const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(prisma, actor);
  if (!canViewLead(actor, lead, sharedAdviserIds)) throw new ForbiddenError("Not allowed to view leads");
  return lead;
}

export async function createLead(actor: Actor, input: CreateLeadInput): Promise<Lead> {
  if (!canCreateLead(actor)) throw new ForbiddenError("Not allowed to create leads");

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        id: randomUUID(),
        firstName: input.first_name,
        lastName: input.last_name,
        email: input.email,
        phone: input.phone,
        source: input.source,
        status: input.status,
        notes: input.notes,
        assignedToId: input.assigned_to_id,
        createdBy: actor.id,
      },
    });

    // A lead created already-assigned should notify the assignee (mirrors trigger).
    const notifications = buildLeadNotifications(
      { ...lead, assignedToId: null, telemarketerOwnerId: null, status: "NA", bounceCount: 0 } as Lead,
      lead,
    );
    if (notifications.length > 0) await tx.notification.createMany({ data: notifications });

    await writeAuditLog(tx, {
      userId: actor.id,
      action: "CREATE",
      entityId: lead.id,
      old: null,
      next: lead,
    });
    return lead;
  });
}

export async function updateLead(actor: Actor, id: string, input: UpdateLeadInput): Promise<Lead> {
  return prisma.$transaction(async (tx) => {
    const prev = await tx.lead.findFirst({ where: { id, deletedAt: null } });
    if (!prev) throw new NotFoundError("Lead not found");
    const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(tx, actor);
    if (!canUpdateLead(actor, prev, sharedAdviserIds)) throw new ForbiddenError("Not allowed to update leads");

    const data = toPrismaUpdate(input);
    const nextStatus = (input.status ?? prev.status) as Lead["status"];
    const statusChanged = nextStatus !== prev.status;
    Object.assign(data, deriveStatusColumns(prev.status, nextStatus));
    if (statusChanged) data.lastContactedAt = new Date();

    const next = await tx.lead.update({ where: { id }, data });

    await recordStatusHistory(tx, {
      leadId: id,
      prevStatus: prev.status,
      nextStatus: next.status,
      changedBy: actor.id,
    });
    await recordStatusNote(tx, {
      leadId: id,
      prevStatus: prev.status,
      nextStatus: next.status,
      changedBy: actor.id,
    });
    await emitLeadNotifications(tx, prev, next);
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: prev, next });

    return next;
  });
}

export async function softDeleteLead(actor: Actor, id: string): Promise<void> {
  const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) throw new NotFoundError("Lead not found");
  if (!canDeleteLead(actor, lead)) throw new ForbiddenError("Not allowed to delete this lead");

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(tx, { userId: actor.id, action: "DELETE", entityId: id, old: lead, next: null });
  });
}

// ─── Phase 2: claim / return / convert / call-pool ──────────────────────────

/**
 * ADVISER (or MASTER) claims an APPOINTMENT lead — costs 1 credit.
 * Idempotent if actor already owns it; 409 if no credits or already claimed.
 */
export async function claimLead(actor: Actor, id: string): Promise<Lead> {
  if (actor.role === "TELEMARKETER") {
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id, deletedAt: null } });
      if (!lead) throw new NotFoundError("Lead not found");
      if (lead.status !== "NA" && lead.status !== "COOLDOWN") {
        throw new ConflictError("Only calling-pool leads can be claimed by telemarketers");
      }
      if (lead.telemarketerOwnerId && lead.telemarketerOwnerId !== actor.id) {
        throw new ConflictError("Lead is already claimed by another telemarketer");
      }
      if (lead.telemarketerOwnerId === actor.id) return lead;

      const next = await tx.lead.update({
        where: { id },
        data: { telemarketerOwnerId: actor.id, assignedToId: actor.id },
      });

      await emitLeadNotifications(tx, lead, next);
      await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: lead, next });
      return next;
    });
  }

  if (!canClaimAppointmentLead(actor)) throw new ForbiddenError("Only advisers can claim leads");

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new NotFoundError("Lead not found");
    if (lead.status !== "APPOINTMENT") {
      throw new ConflictError("Only APPOINTMENT leads can be claimed");
    }
    if (lead.adviserOwnerId && lead.adviserOwnerId !== actor.id) {
      throw new ConflictError("Lead is already claimed by another adviser");
    }
    if (lead.adviserOwnerId === actor.id) {
      return lead; // idempotent
    }

    // Lock the user row and check credit balance.
    const user = await tx.crmUser.findUniqueOrThrow({ where: { id: actor.id } });
    if (user.creditBalance <= 0) throw new ConflictError("Insufficient credits");

    const next = await tx.lead.update({
      where: { id },
      data: { adviserOwnerId: actor.id, assignedToId: actor.id },
    });

    await tx.crmUser.update({
      where: { id: actor.id },
      data: { creditBalance: { decrement: 1 } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: actor.id,
        leadId: id,
        action: "CLAIM",
        balanceBefore: user.creditBalance,
        balanceAfter: user.creditBalance - 1,
      },
    });
    await emitLeadNotifications(tx, lead, next);
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: lead, next });
    return next;
  });
}

/**
 * ADVISER (or MASTER) returns a claimed APPOINTMENT lead — refunds 1 credit.
 */
export async function returnLead(actor: Actor, id: string): Promise<Lead> {
  if (actor.role === "TELEMARKETER") {
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id, deletedAt: null } });
      if (!lead) throw new NotFoundError("Lead not found");
      if (lead.telemarketerOwnerId !== actor.id) {
        throw new ForbiddenError("You don't own this lead");
      }
      if (lead.adviserOwnerId) {
        throw new ConflictError("Lead is already owned by an adviser");
      }

      const next = await tx.lead.update({
        where: { id },
        data: { telemarketerOwnerId: null, assignedToId: null },
      });

      await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: lead, next });
      return next;
    });
  }

  if (!canClaimAppointmentLead(actor)) throw new ForbiddenError("Only advisers can return leads");

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new NotFoundError("Lead not found");
    if (lead.adviserOwnerId !== actor.id && actor.role !== "MASTER") {
      throw new ForbiddenError("You don't own this lead");
    }
    if (!lead.adviserOwnerId) return lead; // nothing to return

    const user = await tx.crmUser.findUniqueOrThrow({ where: { id: lead.adviserOwnerId } });

    const next = await tx.lead.update({
      where: { id },
      data: { adviserOwnerId: null, assignedToId: null },
    });
    await tx.crmUser.update({
      where: { id: user.id },
      data: { creditBalance: { increment: 1 } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: user.id,
        leadId: id,
        action: "RETURN",
        balanceBefore: user.creditBalance,
        balanceAfter: user.creditBalance + 1,
      },
    });
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: lead, next });
    return next;
  });
}

/**
 * Converts a lead to APPOINTMENT status and creates the linked contact + deal.
 * Port of convert_lead RPC (transactional, fact-find carry-over).
 */
export async function convertLead(
  actor: Actor,
  id: string,
  input: ConvertLeadInput,
): Promise<{ lead: Lead; contactId: string; dealId: string }> {
  if (!canConvertLead(actor)) throw new ForbiddenError("Not allowed to convert leads");

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new NotFoundError("Lead not found");
    if (lead.status === "APPOINTMENT") {
      throw new ConflictError("Lead is already an appointment");
    }

    // Resolve or create the contact.
    let contactId = input.contact_id ?? lead.convertedContactId ?? null;
    if (!contactId) {
      const contact = await tx.contact.create({
        data: {
          id: randomUUID(),
          firstName: input.first_name ?? lead.firstName,
          lastName: input.last_name ?? lead.lastName,
          email: input.email ?? lead.email ?? undefined,
          phone: input.phone ?? lead.phone ?? undefined,
          source: lead.source,
          financialGoal: lead.financialGoal ?? undefined,
          riskTolerance: lead.riskTolerance ?? undefined,
          investmentHorizon: lead.investmentHorizon ?? undefined,
          monthlyInvestable: lead.monthlyInvestable ?? undefined,
          existingInvestments: lead.existingInvestments ?? undefined,
          factFindNotes: lead.factFindNotes ?? undefined,
          factFindDone: lead.factFindDone ?? undefined,
          createdBy: actor.id,
        },
      });
      contactId = contact.id;
    }

    // Resolve a direct assignment target, if any. A deal is assigned at creation
    // (spending that adviser's credit) only when the actor is allowed to book on
    // that adviser's behalf — a MASTER, or a delegated TM picking one of their
    // granting advisers. Otherwise the deal stays unassigned for the claim pool.
    let assignedToId: string | undefined = undefined;
    const requestedAdviserId = input.assigned_adviser_id ?? undefined;
    if (requestedAdviserId) {
      const allowed =
        actor.role === "MASTER" || actor.delegatedAdviserIds.includes(requestedAdviserId);
      if (!allowed) {
        throw new ForbiddenError("You can't assign this appointment to that adviser");
      }
      const adviser = await tx.crmUser.findUnique({ where: { id: requestedAdviserId } });
      if (!adviser || adviser.role !== "ADVISER" || !adviser.isActive) {
        throw new ConflictError("Chosen adviser is not available");
      }
      // Only assign + charge when the adviser has a credit to spend; otherwise
      // fall back to the claim pool so the appointment is never lost.
      if (adviser.creditBalance > 0) {
        assignedToId = requestedAdviserId;
      }
    }

    // Create the deal (APPOINTMENT stage; assigned only in the delegated case above).
    const fullName = `${lead.firstName} ${lead.lastName}`.trim();
    const deal = await tx.deal.create({
      data: {
        id: randomUUID(),
        title: fullName,
        stage: "APPOINTMENT",
        leadId: id,
        contactId,
        telemarketerId: actor.role === "TELEMARKETER" ? actor.id : undefined,
        assignedToId,
        financialGoal: lead.financialGoal ?? undefined,
        riskTolerance: lead.riskTolerance ?? undefined,
        investmentHorizon: lead.investmentHorizon ?? undefined,
        monthlyInvestable: lead.monthlyInvestable ?? undefined,
        existingInvestments: lead.existingInvestments ?? undefined,
        factFindNotes: lead.factFindNotes ?? undefined,
        factFindDone: lead.factFindDone ?? false,
        createdBy: actor.id,
      },
    });

    // Charge the assigned adviser one credit (mirrors claimDeal), recorded as a
    // CLAIM transaction so the ledger is consistent however the deal got assigned.
    if (assignedToId) {
      const adviser = await tx.crmUser.findUniqueOrThrow({ where: { id: assignedToId } });
      await tx.crmUser.update({
        where: { id: assignedToId },
        data: { creditBalance: { decrement: 1 } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: assignedToId,
          action: "CLAIM",
          balanceBefore: adviser.creditBalance,
          balanceAfter: adviser.creditBalance - 1,
        },
      });
    }

    // Update the lead itself.
    const next = await tx.lead.update({
      where: { id },
      data: {
        status: "APPOINTMENT",
        appointmentDate: input.appointment_date,
        appointmentTime: input.appointment_time ?? undefined,
        convertedContactId: contactId,
        convertedAt: new Date(),
        notes: input.notes ?? lead.notes,
        ...deriveStatusColumns(lead.status, "APPOINTMENT"),
      },
    });

    await recordStatusHistory(tx, {
      leadId: id,
      prevStatus: lead.status,
      nextStatus: "APPOINTMENT",
      changedBy: actor.id,
    });
    await emitLeadNotifications(tx, lead, next);
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: lead, next });

    return { lead: next, contactId, dealId: deal.id };
  });
}

/**
 * Batch-claims up to `count` leads from the shared calling pool.
 * Picks NA leads first, then COOLDOWN leads whose cooldown_until has passed.
 * Soft-locks by setting telemarketer_owner_id; no credits consumed.
 */
export async function claimForCall(
  actor: Actor,
  input: ClaimForCallInput,
): Promise<Lead[]> {
  if (!canClaimForCall(actor)) throw new ForbiddenError("Not allowed to claim leads for calling");

  const now = new Date();
  const available = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      isAbandoned: false,
      telemarketerOwnerId: null,
      OR: [
        { status: "NA" },
        { status: "COOLDOWN", cooldownUntil: { lte: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: input.count,
  });

  if (available.length === 0) return [];

  const ids = available.map((l) => l.id);
  await prisma.$transaction([
    prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: { telemarketerOwnerId: actor.id },
    }),
  ]);

  return prisma.lead.findMany({ where: { id: { in: ids } } });
}

// ─── Lead notes ─────────────────────────────────────────────────────────────

export async function getLeadNotes(actor: Actor, leadId: string): Promise<LeadNote[]> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } });
  if (!lead) throw new NotFoundError("Lead not found");
  const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(prisma, actor);
  if (!canViewLead(actor, lead, sharedAdviserIds)) throw new ForbiddenError("Not allowed to view leads");
  return prisma.leadNote.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } });
}

export async function addLeadNote(
  actor: Actor,
  leadId: string,
  input: AddNoteInput,
): Promise<LeadNote> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } });
  if (!lead) throw new NotFoundError("Lead not found");
  const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(prisma, actor);
  if (!canViewLead(actor, lead, sharedAdviserIds)) throw new ForbiddenError("Not allowed to add notes to leads");
  return prisma.leadNote.create({
    data: { leadId, content: input.content, createdBy: actor.id },
  });
}

// ─── Lead status history ─────────────────────────────────────────────────────

export async function getLeadStatusHistory(
  actor: Actor,
  leadId: string,
): Promise<LeadStatusHistory[]> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } });
  if (!lead) throw new NotFoundError("Lead not found");
  const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(prisma, actor);
  if (!canViewLead(actor, lead, sharedAdviserIds)) throw new ForbiddenError("Not allowed to view leads");
  return prisma.leadStatusHistory.findMany({
    where: { leadId },
    orderBy: { changedAt: "desc" },
  });
}
