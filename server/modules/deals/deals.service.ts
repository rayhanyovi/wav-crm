import { randomUUID } from "node:crypto";
import type {
  Deal,
  DealProposal,
  DealProposalLine,
  DealStage,
  Prisma,
  StageHistory,
} from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors.js";
import type { Actor } from "../../middleware/context.js";
import {
  canClaimDeal,
  canCreateDeal,
  canDeleteDeal,
  canListDeals,
  canMutateDeal,
  canViewDeal,
} from "./deals.authz.js";
import type {
  AddProposalLineInput,
  CreateDealInput,
  CreateProposalInput,
  ListQuery,
  StageTransitionInput,
  UpdateDealInput,
  UpdateProposalInput,
} from "./deals.schema.js";
import {
  emitDealNotifications,
  recordStageHistory,
  writeAuditLog,
} from "./deals.sideEffects.js";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

// ─── Stage machine ────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<DealStage, DealStage[]> = {
  CALLING: ["APPOINTMENT", "LOST"],
  APPOINTMENT: ["PROPOSAL", "LOST"],
  PROPOSAL: ["SUBMITTED", "LOST"],
  SUBMITTED: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

function assertValidTransition(from: DealStage, to: DealStage): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new BadRequestError(`Cannot transition from ${from} to ${to}`);
  }
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listDeals(actor: Actor, query: ListQuery): Promise<Paginated<Deal>> {
  if (!canListDeals(actor)) throw new ForbiddenError("Not allowed to view deals");

  const where: Prisma.DealWhereInput = { deletedAt: null };

  // Role-based filtering
  if (actor.role === "ADVISER") {
    where.OR = [{ assignedToId: actor.id }, { assignedToId: null }];
  } else if (actor.role === "TELEMARKETER") {
    where.telemarketerId = actor.id;
  }
  // MASTER: no extra filter — sees all deals

  if (query.stage) where.stage = query.stage;
  if (query.search) {
    const searchFilter: Prisma.DealWhereInput = {
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
      ],
    };
    // Merge with existing OR if present
    if (where.OR) {
      where.AND = [{ OR: where.OR as Prisma.DealWhereInput[] }, searchFilter];
      delete where.OR;
    } else {
      Object.assign(where, searchFilter);
    }
  }

  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.deal.count({ where }),
  ]);

  return { data, total, page: query.page, pageSize: query.pageSize };
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getDeal(actor: Actor, id: string): Promise<Deal> {
  const deal = await prisma.deal.findFirst({ where: { id, deletedAt: null } });
  if (!deal) throw new NotFoundError("Deal not found");
  if (!canViewDeal(actor, deal)) throw new ForbiddenError("Not allowed to view this deal");
  return deal;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createDeal(actor: Actor, input: CreateDealInput): Promise<Deal> {
  if (!canCreateDeal(actor)) throw new ForbiddenError("Not allowed to create deals");

  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.create({
      data: {
        id: randomUUID(),
        title: input.title,
        value: input.value ?? 0,
        contactId: input.contact_id,
        leadId: input.lead_id,
        telemarketerId: input.telemarketer_id,
        assignedToId: input.assigned_to_id ?? (actor.role === "ADVISER" ? actor.id : undefined),
        createdBy: actor.id,
      },
    });

    await writeAuditLog(tx, { userId: actor.id, action: "CREATE", entityId: deal.id, old: null, next: deal });
    return deal;
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateDeal(actor: Actor, id: string, input: UpdateDealInput): Promise<Deal> {
  return prisma.$transaction(async (tx) => {
    const prev = await tx.deal.findFirst({ where: { id, deletedAt: null } });
    if (!prev) throw new NotFoundError("Deal not found");
    if (!canMutateDeal(actor, prev)) throw new ForbiddenError("Not allowed to update this deal");

    const data: Prisma.DealUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.value !== undefined) data.value = input.value ?? undefined;
    if (input.expected_close_date !== undefined) data.expectedCloseDate = input.expected_close_date ?? undefined;
    if (input.financial_goal !== undefined) data.financialGoal = input.financial_goal ?? undefined;
    if (input.risk_tolerance !== undefined) data.riskTolerance = input.risk_tolerance ?? undefined;
    if (input.investment_horizon !== undefined) data.investmentHorizon = input.investment_horizon ?? undefined;
    if (input.monthly_investable !== undefined) data.monthlyInvestable = input.monthly_investable ?? undefined;
    if (input.existing_investments !== undefined) data.existingInvestments = input.existing_investments ?? undefined;
    if (input.fact_find_notes !== undefined) data.factFindNotes = input.fact_find_notes ?? undefined;
    if (input.fact_find_done !== undefined) data.factFindDone = input.fact_find_done ?? undefined;

    const next = await tx.deal.update({ where: { id }, data });
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: prev, next });
    return next;
  });
}

// ─── Soft delete ──────────────────────────────────────────────────────────────

export async function softDeleteDeal(actor: Actor, id: string): Promise<void> {
  if (!canDeleteDeal(actor)) throw new ForbiddenError("Only MASTER can delete deals");

  await prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findFirst({ where: { id, deletedAt: null } });
    if (!deal) throw new NotFoundError("Deal not found");

    await tx.deal.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(tx, { userId: actor.id, action: "DELETE", entityId: id, old: deal, next: null });
  });
}

// ─── Stage transition ─────────────────────────────────────────────────────────

export async function advanceStage(
  actor: Actor,
  id: string,
  input: StageTransitionInput,
): Promise<Deal> {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findFirst({ where: { id, deletedAt: null } });
    if (!deal) throw new NotFoundError("Deal not found");
    if (!canMutateDeal(actor, deal)) throw new ForbiddenError("Not allowed to change this deal's stage");

    const toStage = input.to_stage as DealStage;
    assertValidTransition(deal.stage, toStage);

    // Conditional required fields
    if (toStage === "SUBMITTED" && (!input.insurer || !input.insurer_ref)) {
      throw new BadRequestError("insurer and insurer_ref are required when moving to SUBMITTED");
    }
    if (toStage === "WON" && !input.policy_number) {
      throw new BadRequestError("policy_number is required when moving to WON");
    }
    if (toStage === "LOST" && !input.lost_reason) {
      throw new BadRequestError("lost_reason is required when moving to LOST");
    }

    const extraData: Prisma.DealUpdateInput = {};
    if (toStage === "SUBMITTED") {
      extraData.insurer = input.insurer;
      extraData.insurerRef = input.insurer_ref;
      extraData.submittedAt = new Date();
    }
    if (toStage === "WON") {
      extraData.policyNumber = input.policy_number;
      extraData.closedAt = new Date();
    }
    if (toStage === "LOST") {
      extraData.lostReason = input.lost_reason;
      extraData.closedAt = new Date();
    }

    const next = await tx.deal.update({ where: { id }, data: { stage: toStage, ...extraData } });

    await recordStageHistory(tx, {
      dealId: id,
      fromStage: deal.stage,
      toStage,
      changedBy: actor.id,
      note: input.note,
    });
    await emitDealNotifications(tx, next, toStage);
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: deal, next });

    return next;
  });
}

// ─── Claim ────────────────────────────────────────────────────────────────────

export async function claimDeal(actor: Actor, id: string): Promise<Deal> {
  if (!canClaimDeal(actor)) throw new ForbiddenError("Only advisers can claim deals");

  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findFirst({ where: { id, deletedAt: null } });
    if (!deal) throw new NotFoundError("Deal not found");
    if (deal.stage !== "APPOINTMENT") {
      throw new ConflictError("Only APPOINTMENT deals can be claimed");
    }
    if (deal.assignedToId && deal.assignedToId !== actor.id) {
      throw new ConflictError("Deal is already claimed by another adviser");
    }
    if (deal.assignedToId === actor.id) return deal; // idempotent

    const user = await tx.crmUser.findUniqueOrThrow({ where: { id: actor.id } });

    // MASTER can claim without spending credits
    if (actor.role === "ADVISER" && user.creditBalance <= 0) {
      throw new ConflictError("Insufficient credits");
    }

    const next = await tx.deal.update({ where: { id }, data: { assignedToId: actor.id } });

    if (actor.role === "ADVISER") {
      await tx.crmUser.update({
        where: { id: actor.id },
        data: { creditBalance: { decrement: 1 } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: actor.id,
          action: "CLAIM",
          balanceBefore: user.creditBalance,
          balanceAfter: user.creditBalance - 1,
        },
      });
    }

    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: deal, next });
    return next;
  });
}

// ─── Release ──────────────────────────────────────────────────────────────────

export async function releaseDeal(actor: Actor, id: string): Promise<Deal> {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findFirst({ where: { id, deletedAt: null } });
    if (!deal) throw new NotFoundError("Deal not found");

    if (actor.role !== "MASTER" && deal.assignedToId !== actor.id) {
      throw new ForbiddenError("You don't own this deal");
    }
    if (!deal.assignedToId) return deal; // nothing to release

    const prevOwnerId = deal.assignedToId;
    const prevOwner = await tx.crmUser.findUniqueOrThrow({ where: { id: prevOwnerId } });

    const next = await tx.deal.update({ where: { id }, data: { assignedToId: null } });

    // Refund credit to whoever owned the deal (skip for MASTER owners — they never spent one)
    if (prevOwner.role === "ADVISER") {
      await tx.crmUser.update({
        where: { id: prevOwnerId },
        data: { creditBalance: { increment: 1 } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: prevOwnerId,
          action: "RETURN",
          balanceBefore: prevOwner.creditBalance,
          balanceAfter: prevOwner.creditBalance + 1,
        },
      });
    }

    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: deal, next });
    return next;
  });
}

// ─── Proposals ────────────────────────────────────────────────────────────────

export async function getProposals(actor: Actor, dealId: string): Promise<DealProposal[]> {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) throw new NotFoundError("Deal not found");
  if (!canViewDeal(actor, deal)) throw new ForbiddenError("Not allowed to view this deal");

  return prisma.dealProposal.findMany({
    where: { dealId },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createProposal(
  actor: Actor,
  dealId: string,
  input: CreateProposalInput,
): Promise<DealProposal> {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findFirst({ where: { id: dealId, deletedAt: null } });
    if (!deal) throw new NotFoundError("Deal not found");
    if (!canMutateDeal(actor, deal)) throw new ForbiddenError("Not allowed to add proposals to this deal");

    return tx.dealProposal.create({
      data: {
        id: randomUUID(),
        dealId,
        name: input.name,
        notes: input.notes,
        createdBy: actor.id,
      },
    });
  });
}

export async function updateProposal(
  actor: Actor,
  dealId: string,
  proposalId: string,
  input: UpdateProposalInput,
): Promise<DealProposal> {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findFirst({ where: { id: dealId, deletedAt: null } });
    if (!deal) throw new NotFoundError("Deal not found");
    if (!canMutateDeal(actor, deal)) throw new ForbiddenError("Not allowed to update proposals for this deal");

    const proposal = await tx.dealProposal.findFirst({ where: { id: proposalId, dealId } });
    if (!proposal) throw new NotFoundError("Proposal not found");

    const data: Prisma.DealProposalUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.status !== undefined) data.status = input.status;
    if (input.notes !== undefined) data.notes = input.notes ?? undefined;

    return tx.dealProposal.update({ where: { id: proposalId }, data });
  });
}

// ─── Proposal lines ───────────────────────────────────────────────────────────

export async function addProposalLine(
  actor: Actor,
  dealId: string,
  proposalId: string,
  input: AddProposalLineInput,
): Promise<DealProposalLine> {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findFirst({ where: { id: dealId, deletedAt: null } });
    if (!deal) throw new NotFoundError("Deal not found");
    if (!canMutateDeal(actor, deal)) throw new ForbiddenError("Not allowed to modify this deal");

    const proposal = await tx.dealProposal.findFirst({ where: { id: proposalId, dealId } });
    if (!proposal) throw new NotFoundError("Proposal not found");

    return tx.dealProposalLine.create({
      data: {
        id: randomUUID(),
        proposalId,
        fundIsin: input.fund_isin,
        fundName: input.fund_name,
        riskRating: input.risk_rating,
        allocationPct: input.allocation_pct,
      },
    });
  });
}

export async function removeProposalLine(
  actor: Actor,
  dealId: string,
  proposalId: string,
  lineId: string,
): Promise<void> {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findFirst({ where: { id: dealId, deletedAt: null } });
    if (!deal) throw new NotFoundError("Deal not found");
    if (!canMutateDeal(actor, deal)) throw new ForbiddenError("Not allowed to modify this deal");

    const line = await tx.dealProposalLine.findFirst({ where: { id: lineId, proposalId } });
    if (!line) throw new NotFoundError("Proposal line not found");

    await tx.dealProposalLine.delete({ where: { id: lineId } });
  });
}

// ─── Stage history ────────────────────────────────────────────────────────────

export async function getStageHistory(actor: Actor, dealId: string): Promise<StageHistory[]> {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) throw new NotFoundError("Deal not found");
  if (!canViewDeal(actor, deal)) throw new ForbiddenError("Not allowed to view this deal");

  return prisma.stageHistory.findMany({
    where: { dealId },
    orderBy: { createdAt: "desc" },
  });
}
