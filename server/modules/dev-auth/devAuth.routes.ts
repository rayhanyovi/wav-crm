import { Router } from "express";
import type { CrmUser } from "../../../prisma/generated/client/index.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { NotFoundError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { isDevAuthEnabled } from "../../middleware/auth.js";

export const devAuthRouter = Router();

function requireDevAuthEnabled(): void {
  if (!isDevAuthEnabled()) throw new NotFoundError();
}

function toProfile(user: CrmUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    is_active: user.isActive,
    credit_balance: user.creditBalance,
    telemarketer_access: user.telemarketerAccess,
    telemarketer_id: user.telemarketerId,
    leads_access: user.leadsAccess,
    created_at: user.createdAt,
    account_status: user.accountStatus,
    requested_role: user.requestedRole,
    must_change_password: false,
  };
}

devAuthRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    requireDevAuthEnabled();

    const users = await prisma.crmUser.findMany({
      where: {
        isActive: true,
        accountStatus: "ACTIVE",
        role: { in: ["MASTER", "ADVISER", "TELEMARKETER"] },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    res.json({ data: users.map(toProfile) });
  }),
);

devAuthRouter.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    requireDevAuthEnabled();

    const user = await prisma.crmUser.findFirst({
      where: {
        id: req.params.id,
        isActive: true,
        accountStatus: "ACTIVE",
        role: { in: ["MASTER", "ADVISER", "TELEMARKETER"] },
      },
    });
    if (!user) throw new NotFoundError("Dev user not found");

    res.json({ data: toProfile(user) });
  }),
);
