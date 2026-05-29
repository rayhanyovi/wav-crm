import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import seedData from "@/data/seed.json";
import type {
  User, Contact, Lead, LeadNote, ContactNote, Deal, DealProposal, StageHistoryEntry,
  Activity, Comment, Product, Bundle, Campaign, Notification,
  AuditLog, DealStage, AuditAction, CallSession, LeadStatus, CreditTransaction
} from "@/data/types";

function now() {
  return new Date().toISOString();
}

function calculateBundleRisk(products: Product[], productIds: string[], allocations?: Record<string, number>) {
  const bundleProducts = productIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));

  if (bundleProducts.length === 0) return 0;

  const hasAllocations = allocations && productIds.some((id) => allocations[id] != null);
  const weightedRisk = bundleProducts.reduce((total, product) => {
    const weight = hasAllocations ? allocations?.[product.id] ?? 0 : 100 / bundleProducts.length;
    return total + product.risk_score * (weight / 100);
  }, 0);

  return Math.round(weightedRisk);
}

interface CrmState {
  users: User[];
  contacts: Contact[];
  leads: Lead[];
  lead_notes: LeadNote[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_proposals: DealProposal[];
  stage_history: StageHistoryEntry[];
  activities: Activity[];
  comments: Comment[];
  products: Product[];
  bundles: Bundle[];
  campaigns: Campaign[];
  notifications: Notification[];
  audit_logs: AuditLog[];
  call_sessions: CallSession[];

  // ─── Helpers ───────────────────────────────────────────────────────────
  resetToSeed: () => void;

  // ─── Audit ─────────────────────────────────────────────────────────────
  addAuditLog: (userId: string, action: AuditAction, entityType: string, entityId: string, metadata?: Record<string, unknown>) => void;
  addNotification: (recipientId: string, type: string, title: string, message: string, entityType: string, entityId: string) => void;
  // ─── Contacts ──────────────────────────────────────────────────────────
  createContact: (data: Omit<Contact, "id" | "created_at" | "updated_at">, userId: string) => Contact;
  updateContact: (id: string, data: Partial<Contact>, userId: string) => void;
  deleteContact: (id: string, userId: string) => void;

  // ─── Leads ─────────────────────────────────────────────────────────────
  createLead: (data: Omit<Lead, "id" | "created_at" | "updated_at">, userId: string) => Lead;
  updateLead: (id: string, data: Partial<Lead>, userId: string) => void;
  deleteLead: (id: string, userId: string) => void;
  convertLead: (leadId: string, contact: Omit<Contact, "id" | "created_at" | "updated_at">, deal: Omit<Deal, "id" | "created_at" | "updated_at"> | null, userId: string) => { contact: Contact; deal: Deal | null };

  // ─── Deals ─────────────────────────────────────────────────────────────
  createDeal: (data: Omit<Deal, "id" | "created_at" | "updated_at">, userId: string) => Deal;
  updateDeal: (id: string, data: Partial<Deal>, userId: string) => void;
  deleteDeal: (id: string, userId: string) => void;
  moveDealStage: (dealId: string, toStage: DealStage, note: string | undefined, userId: string, lostReason?: string) => void;
  /** Adviser releases a deal: unassigns it (back to pool) or transfers to another adviser. Earns +1 credit. */
  releaseDeal: (dealId: string, releaserId: string, transferToId?: string) => void;

  // ─── Deal Proposals ────────────────────────────────────────────────────
  createDealProposal: (data: Omit<DealProposal, "id" | "created_at" | "updated_at">, userId: string) => DealProposal;
  updateDealProposal: (id: string, data: Partial<Omit<DealProposal, "id" | "deal_id" | "created_by" | "created_at">>, userId: string) => void;
  deleteDealProposal: (id: string, userId: string) => void;

  // ─── Activities ────────────────────────────────────────────────────────
  createActivity: (data: Omit<Activity, "id" | "created_at" | "updated_at">, userId: string) => Activity;
  updateActivity: (id: string, data: Partial<Activity>, userId: string) => void;
  deleteActivity: (id: string, userId: string) => void;
  completeActivity: (id: string, result: string, userId: string) => void;

  // ─── Lead Notes (running log) ───────────────────────────────────────────
  addLeadNote: (leadId: string, content: string, userId: string) => LeadNote;
  deleteLeadNote: (id: string) => void;

  // ─── Contact Notes (running log) ────────────────────────────────────────
  addContactNote: (contactId: string, content: string, userId: string) => ContactNote;
  deleteContactNote: (id: string) => void;

  // ─── Users ─────────────────────────────────────────────────────────────
  updateUser: (id: string, data: Partial<User>) => void;

  // ─── Credits (lead buy-back system) ────────────────────────────────────
  credit_transactions: CreditTransaction[];
  assignCredits: (userId: string, amount: number, adminId: string) => void;
  claimLead: (leadId: string, claimantId: string) => boolean;
  returnLead: (leadId: string, userId: string) => void;

  // ─── Comments ──────────────────────────────────────────────────────────
  addComment: (activityId: string, text: string, userId: string) => Comment;
  updateComment: (id: string, text: string) => void;
  deleteComment: (id: string) => void;

  // ─── Products ──────────────────────────────────────────────────────────
  createProduct: (data: Omit<Product, "id" | "created_at">, userId: string) => Product;
  updateProduct: (id: string, data: Partial<Product>, userId: string) => void;

  // ─── Bundles ───────────────────────────────────────────────────────────
  createBundle: (data: Omit<Bundle, "id" | "created_at">, userId: string) => Bundle;
  updateBundle: (id: string, data: Partial<Bundle>, userId: string) => void;

  // ─── Campaigns ─────────────────────────────────────────────────────────
  createCampaign: (data: Omit<Campaign, "id" | "created_at" | "updated_at">, userId: string) => Campaign;
  updateCampaign: (id: string, data: Partial<Campaign>, userId: string) => void;

  // ─── Notifications ─────────────────────────────────────────────────────
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (userId: string) => void;

  // ─── Call Sessions ─────────────────────────────────────────────────────
  saveCallSession: (session: Omit<CallSession, "id">) => void;
}

export const useCrmStore = create<CrmState>()(
  persist(
    (set, get) => ({
      users: seedData.users as User[],
      contacts: seedData.contacts as Contact[],
      leads: seedData.leads as Lead[],
      lead_notes: [],
      contact_notes: [],
      deals: seedData.deals as Deal[],
      deal_proposals: (seedData as any).deal_proposals as DealProposal[] ?? [],
      stage_history: seedData.stage_history as StageHistoryEntry[],
      activities: seedData.activities as unknown as Activity[],
      comments: seedData.comments as Comment[],
      products: seedData.products as Product[],
      bundles: seedData.bundles as unknown as Bundle[],
      campaigns: seedData.campaigns as Campaign[],
      notifications: seedData.notifications as Notification[],
      audit_logs: seedData.audit_logs as AuditLog[],
      call_sessions: [],
      credit_transactions: [],

      resetToSeed: () =>
        set({
          users: seedData.users as User[],
          contacts: seedData.contacts as Contact[],
          leads: seedData.leads as Lead[],
          lead_notes: [],
          contact_notes: [],
          deals: seedData.deals as Deal[],
          deal_proposals: (seedData as any).deal_proposals as DealProposal[] ?? [],
          stage_history: seedData.stage_history as StageHistoryEntry[],
          activities: seedData.activities as unknown as Activity[],
          comments: seedData.comments as Comment[],
          products: seedData.products as Product[],
          bundles: seedData.bundles as unknown as Bundle[],
          campaigns: seedData.campaigns as Campaign[],
          notifications: seedData.notifications as Notification[],
          audit_logs: seedData.audit_logs as AuditLog[],
          call_sessions: [],
          credit_transactions: [],
        }),

      addAuditLog: (userId, action, entityType, entityId, metadata) =>
        set((s) => ({
          audit_logs: [
            {
              id: `al-${nanoid(6)}`,
              user_id: userId,
              action,
              entity_type: entityType,
              entity_id: entityId,
              metadata,
              created_at: now(),
            },
            ...s.audit_logs,
          ],
        })),

      addNotification: (recipientId, type, title, message, entityType, entityId) =>
        set((s) => ({
          notifications: [
            {
              id: `notif-${nanoid(6)}`,
              recipient_id: recipientId,
              type,
              title,
              message,
              entity_type: entityType,
              entity_id: entityId,
              is_read: false,
              created_at: now(),
            },
            ...s.notifications,
          ],
        })),

      // Contacts
      createContact: (data, userId) => {
        const contact: Contact = { ...data, id: `cnt-${nanoid(6)}`, created_at: now(), updated_at: now() };
        set((s) => ({ contacts: [...s.contacts, contact] }));
        get().addAuditLog(userId, "CREATE", "contact", contact.id, { name: `${contact.first_name} ${contact.last_name}` });
        return contact;
      },
      updateContact: (id, data, userId) => {
        set((s) => ({ contacts: s.contacts.map((c) => c.id === id ? { ...c, ...data, updated_at: now() } : c) }));
        get().addAuditLog(userId, "UPDATE", "contact", id);
      },
      deleteContact: (id, userId) => {
        set((s) => ({ contacts: s.contacts.map((c) => c.id === id ? { ...c, deleted_at: now() } : c) }));
        get().addAuditLog(userId, "DELETE", "contact", id);
      },

      // Leads
      createLead: (data, userId) => {
        const lead: Lead = { ...data, id: `lead-${nanoid(6)}`, created_at: now(), updated_at: now() };
        set((s) => ({ leads: [...s.leads, lead] }));
        get().addAuditLog(userId, "CREATE", "lead", lead.id, { name: `${lead.first_name} ${lead.last_name}` });
        if (lead.assigned_to_id && lead.assigned_to_id !== userId) {
          get().addNotification(lead.assigned_to_id, "LEAD_ASSIGNED", "New lead assigned to you", `${lead.first_name} ${lead.last_name} has been assigned to you.`, "lead", lead.id);
        }
        return lead;
      },
      updateLead: (id, data, userId) => {
        const old = get().leads.find((l) => l.id === id);

        // Auto-timestamp on status change (Task #3)
        const extraUpdates: Partial<Lead> = {};
        if (data.status && old?.status !== data.status) {
          const newEntry: import("@/data/types").StatusHistoryEntry = {
            status: data.status,
            changed_at: now(),
            changed_by: userId,
          };
          extraUpdates.status_history = [...(old?.status_history || []), newEntry];

          // Abandon soft-delete (Task #5)
          if (data.status === "ABANDON") {
            extraUpdates.is_abandoned = true;
            extraUpdates.abandoned_at = now();
          }
        }

        // Detect NO_SHOW bounce: bounce_count increasing
        const isBounce = data.bounce_count != null && data.bounce_count > (old?.bounce_count ?? 0);
        if (isBounce) {
          extraUpdates.last_bounced_at = now();
        }

        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id ? { ...l, ...data, ...extraUpdates, updated_at: now() } : l
          ),
        }));

        if (data.status && old?.status !== data.status) {
          get().addAuditLog(userId, "STATUS_CHANGE", "lead", id, { from: old?.status, to: data.status });
        } else {
          get().addAuditLog(userId, "UPDATE", "lead", id);
        }
        if (data.assigned_to_id && data.assigned_to_id !== old?.assigned_to_id) {
          get().addNotification(data.assigned_to_id, "LEAD_ASSIGNED", "Lead assigned to you", `${old?.first_name} ${old?.last_name} has been re-assigned to you.`, "lead", id);
        }
        // Notify the TM when their lead bounces back from a no-show
        if (isBounce && old?.telemarketer_owner_id) {
          get().addNotification(
            old.telemarketer_owner_id,
            "LEAD_BOUNCED",
            "Lead back in your queue",
            `${old.first_name} ${old.last_name} was a no-show. They've been moved back to your call queue.`,
            "lead",
            id
          );
        }
      },
      deleteLead: (id, userId) => {
        set((s) => ({ leads: s.leads.map((l) => l.id === id ? { ...l, deleted_at: now() } : l) }));
        get().addAuditLog(userId, "DELETE", "lead", id);
      },
      convertLead: (leadId, contactData, dealData, userId) => {
        const contact = get().createContact(contactData, userId);
        let deal: Deal | null = null;
        if (dealData) {
          deal = get().createDeal({ ...dealData, contact_id: contact.id, lead_id: leadId }, userId);
        }
        const status: LeadStatus = "OTHERS"; // lead converted to client — mark as OTHERS (no CONVERTED in new status model)
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === leadId
              ? { ...l, status, converted_contact_id: contact.id, converted_at: now(), updated_at: now() }
              : l
          ),
        }));
        get().addAuditLog(userId, "CONVERSION", "lead", leadId, { contact_id: contact.id });
        return { contact, deal };
      },

      // Deals
      createDeal: (data, userId) => {
        const deal: Deal = { ...data, id: `deal-${nanoid(6)}`, created_at: now(), updated_at: now() };
        set((s) => ({
          deals: [...s.deals, deal],
          stage_history: [
            ...s.stage_history,
            { id: `sh-${nanoid(6)}`, deal_id: deal.id, from_stage: null, to_stage: deal.stage, changed_by: userId, created_at: now() },
          ],
        }));
        get().addAuditLog(userId, "CREATE", "deal", deal.id, { title: deal.title, value: deal.value });
        if (deal.assigned_to_id && deal.assigned_to_id !== userId) {
          get().addNotification(deal.assigned_to_id, "DEAL_ASSIGNED", "Deal assigned to you", `${deal.title} has been assigned to you.`, "deal", deal.id);
        }
        return deal;
      },
      updateDeal: (id, data, userId) => {
        set((s) => ({ deals: s.deals.map((d) => d.id === id ? { ...d, ...data, updated_at: now() } : d) }));
        get().addAuditLog(userId, "UPDATE", "deal", id);
      },
      deleteDeal: (id, userId) => {
        set((s) => ({ deals: s.deals.map((d) => d.id === id ? { ...d, deleted_at: now() } : d) }));
        get().addAuditLog(userId, "DELETE", "deal", id);
      },
      moveDealStage: (dealId, toStage, note, userId, lostReason) => {
        const deal = get().deals.find((d) => d.id === dealId);
        if (!deal) return;
        const fromStage = deal.stage;
        const updates: Partial<Deal> = {
          stage: toStage,
          updated_at: now(),
          ...(toStage === "LOST"      ? { lost_reason: lostReason, closed_at: now() } : {}),
          ...(toStage === "WON"       ? { closed_at: now() } : {}),
          ...(toStage === "SUBMITTED" ? { submitted_at: now() } : {}),
        };
        set((s) => ({
          deals: s.deals.map((d) => d.id === dealId ? { ...d, ...updates } : d),
          stage_history: [
            ...s.stage_history,
            { id: `sh-${nanoid(6)}`, deal_id: dealId, from_stage: fromStage, to_stage: toStage, changed_by: userId, note, created_at: now() },
          ],
        }));
        get().addAuditLog(userId, "STAGE_CHANGE", "deal", dealId, { from: fromStage, to: toStage });
        if (deal.assigned_to_id) {
          const msg = toStage === "WON" ? `Deal "${deal.title}" is now WON! 🎉` : `Deal "${deal.title}" moved to ${toStage}`;
          get().addNotification(deal.assigned_to_id, "DEAL_STAGE_CHANGE", "Deal stage updated", msg, "deal", dealId);
        }
      },

      releaseDeal: (dealId, releaserId, transferToId) => {
        const state = get();
        const deal = state.deals.find((d) => d.id === dealId);
        const releaser = state.users.find((u) => u.id === releaserId);
        if (!deal || !releaser) return;

        // Give +1 credit to the releasing adviser
        const balanceBefore = releaser.credit_balance ?? 0;
        const balanceAfter = balanceBefore + 1;
        const tx: CreditTransaction = {
          id: `ctx-${nanoid(6)}`,
          user_id: releaserId,
          action: "RETURN",
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          created_at: now(),
        };

        const newAssignee = transferToId ?? undefined; // undefined = unassigned (back to pool)
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === dealId ? { ...d, assigned_to_id: newAssignee, updated_at: now() } : d
          ),
          users: s.users.map((u) => u.id === releaserId ? { ...u, credit_balance: balanceAfter } : u),
          credit_transactions: [...s.credit_transactions, tx],
        }));

        get().addAuditLog(releaserId, "ASSIGNMENT_CHANGE", "deal", dealId, {
          action: transferToId ? "transfer" : "release",
          from: releaserId,
          to: transferToId ?? null,
        });

        if (transferToId) {
          get().addNotification(
            transferToId, "DEAL_ASSIGNED", "Deal transferred to you",
            `"${deal.title}" has been transferred to you by ${releaser.name}.`, "deal", dealId
          );
        }
      },

      // Deal Proposals
      createDealProposal: (data, userId) => {
        const proposal: DealProposal = { ...data, id: `prop-${nanoid(6)}`, created_at: now(), updated_at: now() };
        set((s) => ({ deal_proposals: [...s.deal_proposals, proposal] }));
        get().addAuditLog(userId, "CREATE", "deal_proposal", proposal.id, { deal_id: proposal.deal_id, name: proposal.name });
        return proposal;
      },
      updateDealProposal: (id, data, userId) => {
        set((s) => ({
          deal_proposals: s.deal_proposals.map((p) =>
            p.id === id ? { ...p, ...data, updated_at: now() } : p
          ),
        }));
        get().addAuditLog(userId, "UPDATE", "deal_proposal", id);
      },
      deleteDealProposal: (id, userId) => {
        set((s) => ({ deal_proposals: s.deal_proposals.filter((p) => p.id !== id) }));
        get().addAuditLog(userId, "DELETE", "deal_proposal", id);
      },

      // Activities
      createActivity: (data, userId) => {
        const activity: Activity = { ...data, id: `act-${nanoid(6)}`, created_at: now(), updated_at: now() };
        set((s) => ({ activities: [...s.activities, activity] }));
        get().addAuditLog(userId, "CREATE", "activity", activity.id, { type: activity.type, subject: activity.subject });
        return activity;
      },
      updateActivity: (id, data, userId) => {
        set((s) => ({ activities: s.activities.map((a) => a.id === id ? { ...a, ...data, updated_at: now() } : a) }));
        get().addAuditLog(userId, "UPDATE", "activity", id);
      },
      deleteActivity: (id, userId) => {
        set((s) => ({ activities: s.activities.map((a) => a.id === id ? { ...a, deleted_at: now() } : a) }));
        get().addAuditLog(userId, "DELETE", "activity", id);
      },
      completeActivity: (id, result, userId) => {
        set((s) => ({
          activities: s.activities.map((a) =>
            a.id === id ? { ...a, result: result as Activity["result"], completed_at: now(), updated_at: now() } : a
          ),
        }));
        get().addAuditLog(userId, "UPDATE", "activity", id, { action: "complete", result });
      },

      // Lead Notes (running log — Task #11)
      addLeadNote: (leadId, content, userId) => {
        const note: LeadNote = {
          id: `ln-${nanoid(8)}`,
          lead_id: leadId,
          content,
          created_by: userId,
          created_at: now(),
        };
        set((s) => ({ lead_notes: [...s.lead_notes, note] }));
        return note;
      },
      deleteLeadNote: (id) => {
        set((s) => ({ lead_notes: s.lead_notes.filter((n) => n.id !== id) }));
      },

      // Contact Notes (running client log)
      addContactNote: (contactId, content, userId) => {
        const note: ContactNote = {
          id: `cn-${nanoid(8)}`,
          contact_id: contactId,
          content,
          created_by: userId,
          created_at: now(),
        };
        set((s) => ({ contact_notes: [...s.contact_notes, note] }));
        return note;
      },
      deleteContactNote: (id) => {
        set((s) => ({ contact_notes: s.contact_notes.filter((n) => n.id !== id) }));
      },

      // Users — allow Master to update user settings (Task #9)
      updateUser: (id, data) => {
        set((s) => ({ users: s.users.map((u) => u.id === id ? { ...u, ...data } : u) }));
      },

      // Comments
      addComment: (activityId, text, userId) => {
        const comment: Comment = {
          id: `com-${nanoid(6)}`,
          activity_id: activityId,
          text,
          created_by: userId,
          created_at: now(),
          updated_at: now(),
        };
        set((s) => ({ comments: [...s.comments, comment] }));
        const activity = get().activities.find((a) => a.id === activityId);
        if (activity?.assigned_to_id && activity.assigned_to_id !== userId) {
          get().addNotification(activity.assigned_to_id, "COMMENT", "New comment", `New comment on "${activity.subject}"`, "activity", activityId);
        }
        return comment;
      },
      updateComment: (id, text) =>
        set((s) => ({ comments: s.comments.map((c) => c.id === id ? { ...c, text, updated_at: now() } : c) })),
      deleteComment: (id) =>
        set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),

      // Products
      createProduct: (data, userId) => {
        const product: Product = { ...data, id: `prod-${nanoid(6)}`, created_at: now() };
        set((s) => ({ products: [...s.products, product] }));
        get().addAuditLog(userId, "CREATE", "product", product.id, { name: product.name });
        return product;
      },
      updateProduct: (id, data, userId) => {
        set((s) => ({ products: s.products.map((p) => p.id === id ? { ...p, ...data } : p) }));
        get().addAuditLog(userId, "UPDATE", "product", id);
      },

      // Bundles
      createBundle: (data, userId) => {
        const risk_score = calculateBundleRisk(get().products, data.product_ids, data.allocations);
        const bundle: Bundle = { ...data, risk_score, id: `bundle-${nanoid(6)}`, created_at: now() };
        set((s) => ({ bundles: [...s.bundles, bundle] }));
        get().addAuditLog(userId, "CREATE", "bundle", bundle.id, { name: bundle.name });
        return bundle;
      },
      updateBundle: (id, data, userId) => {
        set((s) => ({
          bundles: s.bundles.map((b) => {
            if (b.id !== id) return b;

            const bundle = { ...b, ...data };
            return {
              ...bundle,
              risk_score: calculateBundleRisk(s.products, bundle.product_ids, bundle.allocations),
            };
          }),
        }));
        get().addAuditLog(userId, "UPDATE", "bundle", id);
      },

      // Campaigns
      createCampaign: (data, userId) => {
        const campaign: Campaign = { ...data, id: `camp-${nanoid(6)}`, created_at: now(), updated_at: now() };
        set((s) => ({ campaigns: [...s.campaigns, campaign] }));
        get().addAuditLog(userId, "CREATE", "campaign", campaign.id, { name: campaign.name });
        return campaign;
      },
      updateCampaign: (id, data, userId) => {
        set((s) => ({ campaigns: s.campaigns.map((c) => c.id === id ? { ...c, ...data, updated_at: now() } : c) }));
        get().addAuditLog(userId, "UPDATE", "campaign", id);
      },

      // Notifications
      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true, read_at: now() } : n
          ),
        })),
      markAllNotificationsRead: (userId) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.recipient_id === userId && !n.is_read ? { ...n, is_read: true, read_at: now() } : n
          ),
        })),

      // Credits
      assignCredits: (userId, amount, adminId) => {
        const user = get().users.find((u) => u.id === userId);
        if (!user) return;
        const balanceBefore = user.credit_balance ?? 0;
        const balanceAfter = Math.max(0, balanceBefore + amount);
        const tx: CreditTransaction = {
          id: `ctx-${nanoid(6)}`,
          user_id: userId,
          action: "ADMIN_ASSIGN",
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          created_at: now(),
        };
        set((s) => ({
          users: s.users.map((u) => u.id === userId ? { ...u, credit_balance: balanceAfter } : u),
          credit_transactions: [...s.credit_transactions, tx],
        }));
        get().addAuditLog(adminId, "UPDATE", "user_credit", userId, { amount, balanceBefore, balanceAfter });
      },

      claimLead: (leadId, claimantId) => {
        const state = get();
        const user = state.users.find((u) => u.id === claimantId);
        if (!user || (user.credit_balance ?? 0) < 1) return false;
        const balanceBefore = user.credit_balance ?? 0;
        const balanceAfter = balanceBefore - 1;
        const tx: CreditTransaction = {
          id: `ctx-${nanoid(6)}`,
          user_id: claimantId,
          lead_id: leadId,
          action: "CLAIM",
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          created_at: now(),
        };
        set((s) => ({
          users: s.users.map((u) => u.id === claimantId ? { ...u, credit_balance: balanceAfter } : u),
          leads: s.leads.map((l) => l.id === leadId ? { ...l, assigned_to_id: claimantId, updated_at: now() } : l),
          credit_transactions: [...s.credit_transactions, tx],
        }));
        get().addAuditLog(claimantId, "UPDATE", "lead", leadId, { action: "CLAIM", balanceBefore, balanceAfter });
        return true;
      },

      returnLead: (leadId, userId) => {
        const state = get();
        const user = state.users.find((u) => u.id === userId);
        if (!user) return;
        const balanceBefore = user.credit_balance ?? 0;
        const balanceAfter = balanceBefore + 1;
        const tx: CreditTransaction = {
          id: `ctx-${nanoid(6)}`,
          user_id: userId,
          lead_id: leadId,
          action: "RETURN",
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          created_at: now(),
        };
        set((s) => ({
          users: s.users.map((u) => u.id === userId ? { ...u, credit_balance: balanceAfter } : u),
          leads: s.leads.map((l) => l.id === leadId ? { ...l, assigned_to_id: undefined, updated_at: now() } : l),
          credit_transactions: [...s.credit_transactions, tx],
        }));
        get().addAuditLog(userId, "UPDATE", "lead", leadId, { action: "RETURN", balanceBefore, balanceAfter });
      },

      // Call Sessions
      saveCallSession: (session) => {
        const cs: CallSession = { ...session, id: `cs-${nanoid(6)}` };
        set((s) => ({ call_sessions: [...s.call_sessions, cs] }));
      },
    }),
    {
      name: "crm-prototype-v1",
      partialize: (state) => ({
        users: state.users,
        contacts: state.contacts,
        leads: state.leads,
        lead_notes: state.lead_notes,
        contact_notes: state.contact_notes,
        deals: state.deals,
        deal_proposals: state.deal_proposals,
        stage_history: state.stage_history,
        activities: state.activities,
        comments: state.comments,
        products: state.products,
        bundles: state.bundles,
        campaigns: state.campaigns,
        notifications: state.notifications,
        audit_logs: state.audit_logs,
        call_sessions: state.call_sessions,
        credit_transactions: state.credit_transactions,
      }),
    }
  )
);
