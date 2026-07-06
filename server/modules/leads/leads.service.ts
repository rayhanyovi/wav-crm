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
  BulkCreateLeadsInput,
  ClaimForCallInput,
  ConvertLeadInput,
  CreateLeadInput,
  ListQuery,
  MergeDuplicateLeadsInput,
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

export interface MergeDuplicateLeadsResult {
  lead: Lead;
  mergedSourceIds: string[];
  moved: {
    notes: number;
    statusHistory: number;
    activities: number;
    deals: number;
    creditTransactions: number;
    notifications: number;
  };
}

function phoneKey(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return typeof value === "string" && value.trim() === "";
}

function firstPresent<T>(
  target: T | null | undefined,
  sources: Array<T | null | undefined>,
): T | undefined {
  if (!isBlank(target)) return undefined;
  return sources.find((value) => !isBlank(value)) ?? undefined;
}

function mergeNotes(target: string | null | undefined, sources: Lead[]): string | undefined {
  const parts = [target?.trim()].filter(Boolean) as string[];
  for (const source of sources) {
    const note = source.notes?.trim();
    if (!note || parts.includes(note)) continue;
    const name = `${source.firstName} ${source.lastName}`.trim() || source.id;
    parts.push(`Merged from duplicate ${name}: ${note}`);
  }
  const merged = parts.join("\n\n");
  return merged && merged !== (target ?? "") ? merged : undefined;
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
  set("residentialStatus", input.residential_status);
  set("incomeRange", input.income_range);
  set("zipcode", input.zipcode);
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
  // Scheduled callback. Rescheduling (a non-null callback_at) resets the
  // "due notification already sent" flag so the new time fires its own alert.
  if (input.callback_at !== undefined) {
    out.callbackAt = input.callback_at ? new Date(input.callback_at) : null;
    if (input.callback_at === null) {
      out.callbackAssignedTo = null;
      out.callbackNote = null;
    }
    out.callbackNotified = false;
  }
  set("callbackAssignedTo", input.callback_assigned_to);
  set("callbackNote", input.callback_note);
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

  // MASTER sees all leads. Advisers and Telemarketers only see leads they uploaded.
  const scopeFilter: Prisma.LeadWhereInput | null =
    actor.role === "MASTER" ? null : { createdBy: actor.id };

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
        salutation: input.salutation,
        firstName: input.first_name,
        lastName: input.last_name,
        email: input.email,
        phone: input.phone,
        source: input.source,
        status: input.status,
        notes: input.notes,
        assignedToId: input.assigned_to_id,
        telemarketerOwnerId: input.telemarketer_owner_id,
        age: input.age,
        gender: input.gender,
        residentialStatus: input.residential_status,
        incomeRange: input.income_range,
        zipcode: input.zipcode,
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

export interface BulkCreateResult {
  created: number;
  skipped: number;
}

export async function bulkCreateLeads(
  actor: Actor,
  input: BulkCreateLeadsInput,
): Promise<BulkCreateResult> {
  if (!canCreateLead(actor)) throw new ForbiddenError("Not allowed to create leads");

  const rows = input.leads.map((lead) => ({
    id: randomUUID(),
    salutation: lead.salutation ?? null,
    firstName: lead.first_name,
    lastName: lead.last_name,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    source: lead.source,
    status: lead.status,
    notes: lead.notes ?? null,
    assignedToId: lead.assigned_to_id ?? null,
    telemarketerOwnerId: lead.telemarketer_owner_id ?? null,
    age: lead.age ?? null,
    gender: lead.gender ?? null,
    residentialStatus: lead.residential_status ?? null,
    incomeRange: lead.income_range ?? null,
    zipcode: lead.zipcode ?? null,
    createdBy: actor.id,
  }));

  // createMany skips rows that violate unique constraints (e.g. duplicate phone)
  // rather than erroring — this is the desired behaviour for bulk import.
  const result = await prisma.lead.createMany({ data: rows, skipDuplicates: true });

  return { created: result.count, skipped: rows.length - result.count };
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

/**
 * True duplicate merge: keep one canonical lead, move dependent records from the
 * duplicate rows, then soft-delete the source rows. Phone-key equality is
 * enforced so this cannot be used as a random bulk delete.
 */
export async function mergeDuplicateLeads(
  actor: Actor,
  targetId: string,
  input: MergeDuplicateLeadsInput,
): Promise<MergeDuplicateLeadsResult> {
  const sourceIds = Array.from(new Set(input.source_ids)).filter((id) => id !== targetId);
  if (sourceIds.length === 0) {
    throw new ConflictError("Choose at least one duplicate lead to merge");
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.lead.findMany({
      where: { id: { in: [targetId, ...sourceIds] }, deletedAt: null },
    });
    const target = rows.find((lead) => lead.id === targetId);
    const sources = sourceIds
      .map((id) => rows.find((lead) => lead.id === id))
      .filter((lead): lead is Lead => Boolean(lead));

    if (!target) throw new NotFoundError("Lead to keep not found");
    if (sources.length !== sourceIds.length) {
      throw new NotFoundError("One or more duplicate leads were not found");
    }

    const targetPhoneKey = phoneKey(target.phone);
    if (targetPhoneKey.length < 6) {
      throw new ConflictError("The lead to keep needs a valid phone number before merging");
    }
    const mismatched = sources.filter((source) => phoneKey(source.phone) !== targetPhoneKey);
    if (mismatched.length > 0) {
      throw new ConflictError("All merged leads must share the same phone number");
    }

    const sharedAdviserIds = await getSharedAdviserIdsForTelemarketer(tx, actor);
    if (!canUpdateLead(actor, target, sharedAdviserIds)) {
      throw new ForbiddenError("Not allowed to update the lead you want to keep");
    }
    const forbiddenSource = sources.find((source) => !canDeleteLead(actor, source));
    if (forbiddenSource) {
      throw new ForbiddenError("Not allowed to merge one or more selected duplicates");
    }

    const data: Prisma.LeadUpdateInput = {};
    const setIfMissing = <K extends keyof Prisma.LeadUpdateInput>(
      key: K,
      value: Prisma.LeadUpdateInput[K] | undefined,
    ) => {
      if (value !== undefined) data[key] = value;
    };

    setIfMissing("salutation", firstPresent(target.salutation, sources.map((source) => source.salutation)));
    setIfMissing("email", firstPresent(target.email, sources.map((source) => source.email)));
    setIfMissing("age", firstPresent(target.age, sources.map((source) => source.age)));
    setIfMissing("gender", firstPresent(target.gender, sources.map((source) => source.gender)));
    setIfMissing("residentialStatus", firstPresent(target.residentialStatus, sources.map((source) => source.residentialStatus)));
    setIfMissing("incomeRange", firstPresent(target.incomeRange, sources.map((source) => source.incomeRange)));
    setIfMissing("zipcode", firstPresent(target.zipcode, sources.map((source) => source.zipcode)));
    setIfMissing("personality", firstPresent(target.personality, sources.map((source) => source.personality)));
    setIfMissing("preferredContactMethod", firstPresent(target.preferredContactMethod, sources.map((source) => source.preferredContactMethod)));
    setIfMissing("bestTimeToCall", firstPresent(target.bestTimeToCall, sources.map((source) => source.bestTimeToCall)));
    setIfMissing("appointmentDate", firstPresent(target.appointmentDate, sources.map((source) => source.appointmentDate)));
    setIfMissing("appointmentTime", firstPresent(target.appointmentTime, sources.map((source) => source.appointmentTime)));
    setIfMissing("appointmentResult", firstPresent(target.appointmentResult, sources.map((source) => source.appointmentResult)));
    setIfMissing("otherStatusNote", firstPresent(target.otherStatusNote, sources.map((source) => source.otherStatusNote)));
    setIfMissing("assignedToId", firstPresent(target.assignedToId, sources.map((source) => source.assignedToId)));
    setIfMissing("telemarketerOwnerId", firstPresent(target.telemarketerOwnerId, sources.map((source) => source.telemarketerOwnerId)));
    setIfMissing("adviserOwnerId", firstPresent(target.adviserOwnerId, sources.map((source) => source.adviserOwnerId)));
    setIfMissing("lastBouncedAt", firstPresent(target.lastBouncedAt, sources.map((source) => source.lastBouncedAt)));
    setIfMissing("convertedContactId", firstPresent(target.convertedContactId, sources.map((source) => source.convertedContactId)));
    setIfMissing("convertedAt", firstPresent(target.convertedAt, sources.map((source) => source.convertedAt)));
    setIfMissing("cooldownUntil", firstPresent(target.cooldownUntil, sources.map((source) => source.cooldownUntil)));
    setIfMissing("lastContactedAt", firstPresent(target.lastContactedAt, sources.map((source) => source.lastContactedAt)));
    setIfMissing("callbackAt", firstPresent(target.callbackAt, sources.map((source) => source.callbackAt)));
    setIfMissing("callbackAssignedTo", firstPresent(target.callbackAssignedTo, sources.map((source) => source.callbackAssignedTo)));
    setIfMissing("callbackNote", firstPresent(target.callbackNote, sources.map((source) => source.callbackNote)));
    setIfMissing("financialGoal", firstPresent(target.financialGoal, sources.map((source) => source.financialGoal)));
    setIfMissing("riskTolerance", firstPresent(target.riskTolerance, sources.map((source) => source.riskTolerance)));
    setIfMissing("investmentHorizon", firstPresent(target.investmentHorizon, sources.map((source) => source.investmentHorizon)));
    setIfMissing("monthlyInvestable", firstPresent(target.monthlyInvestable, sources.map((source) => source.monthlyInvestable)));
    setIfMissing("existingInvestments", firstPresent(target.existingInvestments, sources.map((source) => source.existingInvestments)));
    setIfMissing("factFindNotes", firstPresent(target.factFindNotes, sources.map((source) => source.factFindNotes)));
    setIfMissing("factFindDone", firstPresent(target.factFindDone, sources.map((source) => source.factFindDone)));

    const mergedNotes = mergeNotes(target.notes, sources);
    if (mergedNotes !== undefined) data.notes = mergedNotes;
    if (data.callbackAt !== undefined) data.callbackNotified = false;

    let next = target;
    if (Object.keys(data).length > 0) {
      next = await tx.lead.update({ where: { id: targetId }, data });
    }

    const [notes, statusHistory, activities, deals, creditTransactions, notifications] = await Promise.all([
      tx.leadNote.updateMany({ where: { leadId: { in: sourceIds } }, data: { leadId: targetId } }),
      tx.leadStatusHistory.updateMany({ where: { leadId: { in: sourceIds } }, data: { leadId: targetId } }),
      tx.activity.updateMany({ where: { leadId: { in: sourceIds } }, data: { leadId: targetId } }),
      tx.deal.updateMany({ where: { leadId: { in: sourceIds } }, data: { leadId: targetId } }),
      tx.creditTransaction.updateMany({ where: { leadId: { in: sourceIds } }, data: { leadId: targetId } }),
      tx.notification.updateMany({
        where: { entityType: "lead", entityId: { in: sourceIds } },
        data: { entityId: targetId },
      }),
    ]);

    await tx.lead.updateMany({
      where: { id: { in: sourceIds } },
      data: { deletedAt: new Date() },
    });

    await tx.leadNote.create({
      data: {
        leadId: targetId,
        content: `Merged duplicate lead${sourceIds.length === 1 ? "" : "s"}: ${sourceIds.join(", ")}`,
        createdBy: actor.id,
      },
    });
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: targetId, old: target, next });
    for (const source of sources) {
      await writeAuditLog(tx, { userId: actor.id, action: "DELETE", entityId: source.id, old: source, next: null });
    }

    return {
      lead: next,
      mergedSourceIds: sourceIds,
      moved: {
        notes: notes.count,
        statusHistory: statusHistory.count,
        activities: activities.count,
        deals: deals.count,
        creditTransactions: creditTransactions.count,
        notifications: notifications.count,
      },
    };
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
          // Carry demographics from the lead so the fact-find isn't blank post-convert
          gender: lead.gender ?? undefined,
          age: lead.age ?? undefined,
          zipcode: lead.zipcode ?? undefined,
          residentialStatus: lead.residentialStatus ?? undefined,
          incomeRange: lead.incomeRange ?? undefined,
          preferredContactMethod: lead.preferredContactMethod ?? undefined,
          bestTimeToCall: lead.bestTimeToCall ?? undefined,
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
        callbackAt: null,
        callbackAssignedTo: null,
        callbackNote: null,
        callbackNotified: false,
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
  const targeted = input.leadIds && input.leadIds.length > 0;
  const ownershipFilter: Prisma.LeadWhereInput = targeted
    ? { OR: [{ telemarketerOwnerId: null }, { telemarketerOwnerId: actor.id }] }
    : { telemarketerOwnerId: null };
  const dueCallbackFilter: Prisma.LeadWhereInput = {
    callbackAt: { lte: now },
    status: { notIn: ["APPOINTMENT", "AVOID", "NOT_INTERESTED", "OTHERS"] },
    ...(actor.role === "MASTER"
      ? {}
      : { OR: [{ callbackAssignedTo: null }, { callbackAssignedTo: actor.id }] }),
  };
  const available = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      isAbandoned: false,
      // When the client sends specific IDs (filtered session / single-lead call),
      // include still-open leads plus leads already in this caller's own queue.
      // Otherwise pool only unowned leads.
      ...(targeted ? { id: { in: input.leadIds } } : {}),
      AND: [
        ownershipFilter,
        {
          OR: [
            { status: "NA" },
            { status: "COOLDOWN", cooldownUntil: { lte: now } },
            dueCallbackFilter,
          ],
        },
      ],
    },
    orderBy: [
      { lastCallAttemptAt: { sort: "asc", nulls: "first" } },
      { createdAt: "desc" },
    ],
    take: targeted ? undefined : input.count,
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
