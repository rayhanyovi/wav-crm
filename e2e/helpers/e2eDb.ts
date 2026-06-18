import { PrismaClient } from "../../prisma/generated/client/index.js";
import dotenv from "dotenv";
import type { Page } from "@playwright/test";

dotenv.config({ path: ".env.local" });

export const prisma = new PrismaClient();

export const ids = {
  master: "e2e-master",
  tmA: "e2e-tm-a",
  tmB: "e2e-tm-b",
  bulkCallOne: "e2e-bulk-call-one",
  bulkCallTwo: "e2e-bulk-call-two",
  mergeKeep: "e2e-merge-keep",
  mergeWorked: "e2e-merge-worked",
  callbackLead: "e2e-callback-lead",
  uploadedOwn: "e2e-uploaded-own",
  uploadedOther: "e2e-uploaded-other",
};

const leadIds = [
  ids.bulkCallOne,
  ids.bulkCallTwo,
  ids.mergeKeep,
  ids.mergeWorked,
  ids.callbackLead,
  ids.uploadedOwn,
  ids.uploadedOther,
];

const userIds = [ids.master, ids.tmA, ids.tmB];

export async function cleanupE2eData(): Promise<void> {
  await prisma.activity.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.deal.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.creditTransaction.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { entityType: "lead", entityId: { in: leadIds } },
        { recipientId: { in: userIds } },
      ],
    },
  });
  await prisma.leadStatusHistory.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.leadNote.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  await prisma.auditLog.deleteMany({
    where: { OR: [{ entityId: { in: leadIds } }, { userId: { in: userIds } }] },
  });
  await prisma.crmUser.deleteMany({ where: { id: { in: userIds } } });
}

export async function seedE2eData(): Promise<void> {
  await cleanupE2eData();

  await prisma.crmUser.createMany({
    data: [
      {
        id: ids.master,
        name: "E2E Master",
        email: "e2e-master@example.test",
        role: "MASTER",
        isActive: true,
        accountStatus: "ACTIVE",
        leadsAccess: true,
      },
      {
        id: ids.tmA,
        name: "E2E TM A",
        email: "e2e-tm-a@example.test",
        role: "TELEMARKETER",
        isActive: true,
        accountStatus: "ACTIVE",
        leadsAccess: true,
      },
      {
        id: ids.tmB,
        name: "E2E TM B",
        email: "e2e-tm-b@example.test",
        role: "TELEMARKETER",
        isActive: true,
        accountStatus: "ACTIVE",
        leadsAccess: true,
      },
    ],
  });

  await prisma.lead.createMany({
    data: [
      {
        id: ids.bulkCallOne,
        firstName: "E2E Bulk",
        lastName: "Call One",
        phone: "6599001101",
        source: "OTHERS",
        status: "NA",
        createdBy: ids.tmA,
      },
      {
        id: ids.bulkCallTwo,
        firstName: "E2E Bulk",
        lastName: "Call Two",
        phone: "6599001102",
        source: "OTHERS",
        status: "NA",
        createdBy: ids.tmA,
      },
      {
        id: ids.mergeKeep,
        firstName: "E2E Merge",
        lastName: "Keep",
        phone: "6599001000",
        source: "OTHERS",
        status: "NA",
        createdBy: ids.tmA,
      },
      {
        id: ids.mergeWorked,
        firstName: "E2E Merge",
        lastName: "Worked",
        phone: "+65 9900 1000",
        email: "e2e-merge-worked@example.test",
        source: "OTHERS",
        status: "KIV",
        notes: "Worked duplicate should be preserved",
        createdBy: ids.tmA,
        telemarketerOwnerId: ids.tmA,
        lastContactedAt: new Date(),
      },
      {
        id: ids.callbackLead,
        firstName: "E2E Callback",
        lastName: "Prospect",
        phone: "6599002000",
        source: "OTHERS",
        status: "NA",
        createdBy: ids.tmA,
      },
      {
        id: ids.uploadedOwn,
        firstName: "E2E Uploaded",
        lastName: "Own",
        phone: "6599003000",
        source: "OTHERS",
        status: "NA",
        createdBy: ids.tmA,
      },
      {
        id: ids.uploadedOther,
        firstName: "E2E Uploaded",
        lastName: "Other",
        phone: "6599004000",
        source: "OTHERS",
        status: "NA",
        createdBy: ids.master,
      },
    ],
  });

  await prisma.leadNote.create({
    data: {
      leadId: ids.mergeKeep,
      content: "Note that must move during merge",
      createdBy: ids.tmA,
    },
  });
}

export async function loginAs(page: Page, userId: string): Promise<void> {
  await page.addInitScript((id) => {
    window.localStorage.clear();
    window.localStorage.setItem("crm-dev-user-id", id);
  }, userId);
}
