import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLeads, fetchLeadById,
  createLead, updateLead, deleteLead,
  fetchLeadNotes, addLeadNote, deleteLeadNote,
  bulkCreateLeads,
  claimLead, returnLead, convertLead, claimLeadsForCall,
  mergeDuplicateLeads,
} from "@/services/leads";
import type { LeadFilters, CreateLeadPayload, UpdateLeadPayload, ConvertLeadPayload } from "@/services/leads";
import type { Lead, LeadNote } from "@/data/types";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/store/useToastStore";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const leadKeys = {
  all:    ["leads"] as const,
  lists:  (f?: LeadFilters) => ["leads", "list", f ?? {}] as const,
  detail: (id: string) => ["leads", "detail", id] as const,
  notes:  (id: string) => ["leads", "notes", id] as const,
};

// ─── Leads ───────────────────────────────────────────────────────────────────

export function useLeads(filters?: LeadFilters) {
  return useQuery({
    queryKey: leadKeys.lists(filters),
    queryFn:  () => fetchLeads(filters),
  });
}

/** Fetch ALL leads including abandoned — for dashboards, stats, etc. */
export function useAllLeads() {
  return useQuery({
    queryKey: leadKeys.lists({ includeAbandoned: true }),
    queryFn:  () => fetchLeads({ includeAbandoned: true }),
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: leadKeys.detail(id ?? ""),
    queryFn:  () => fetchLeadById(id!),
    enabled:  !!id,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLeadPayload) => createLead(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload, userId }: { id: string; payload: UpdateLeadPayload; userId: string }) =>
      updateLead(id, payload, userId),

    // Optimistic update for the list cache
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: ["leads"] });
      const snapshots: [unknown, Lead[]][] = [];

      qc.getQueriesData<Lead[]>({ queryKey: ["leads", "list"] }).forEach(([key, data]) => {
        if (data) {
          snapshots.push([key, data]);
          qc.setQueryData<Lead[]>(key as Parameters<typeof qc.setQueryData>[0], (old) =>
            old?.map((l) => (l.id === id ? { ...l, ...payload } : l)) ?? []
          );
        }
      });

      // Also update the detail cache if present
      const prevDetail = qc.getQueryData<Lead>(leadKeys.detail(id));
      if (prevDetail) {
        qc.setQueryData<Lead>(leadKeys.detail(id), { ...prevDetail, ...payload });
      }

      return { snapshots, prevDetail };
    },

    onError: (_err, { id }, ctx) => {
      if (ctx?.snapshots) {
        ctx.snapshots.forEach(([key, data]) =>
          qc.setQueryData(key as Parameters<typeof qc.setQueryData>[0], data)
        );
      }
      if (ctx?.prevDetail) qc.setQueryData(leadKeys.detail(id), ctx.prevDetail);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useBulkCreateLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leads: CreateLeadPayload[]) => bulkCreateLeads(leads),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

interface BulkResult { ok: number; failed: number }

/** Soft-delete many leads via the per-lead endpoint (reuses its authz). Reports
 *  how many succeeded vs. failed (e.g. rows the actor doesn't own). */
export function useBulkDeleteLeads() {
  const qc = useQueryClient();
  return useMutation<BulkResult, Error, string[]>({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(ids.map((id) => deleteLead(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      return { ok: ids.length - failed, failed };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

/** Change status on many leads via the per-lead PATCH (fires the same side
 *  effects — status history, abandonment, auto-note — as a single change). */
export function useBulkUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation<BulkResult, Error, { ids: string[]; status: Lead["status"]; userId: string }>({
    mutationFn: async ({ ids, status, userId }) => {
      const results = await Promise.allSettled(ids.map((id) => updateLead(id, { status }, userId)));
      const failed = results.filter((r) => r.status === "rejected").length;
      return { ok: ids.length - failed, failed };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useMergeDuplicateLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, sourceIds }: { targetId: string; sourceIds: string[] }) =>
      mergeDuplicateLeads(targetId, sourceIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ─── Lead Notes ──────────────────────────────────────────────────────────────

export function useLeadNotes(leadId: string | undefined) {
  return useQuery({
    queryKey: leadKeys.notes(leadId ?? ""),
    queryFn:  () => fetchLeadNotes(leadId!),
    enabled:  !!leadId,
  });
}

export function useAddLeadNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, content, createdBy }: { leadId: string; content: string; createdBy: string }) =>
      addLeadNote(leadId, content, createdBy),
    onSuccess: (_data, { leadId }) => {
      qc.invalidateQueries({ queryKey: leadKeys.notes(leadId) });
    },
  });
}

export function useDeleteLeadNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, leadId }: { noteId: string; leadId: string }) =>
      deleteLeadNote(noteId),
    onSuccess: (_data, { leadId }) => {
      qc.invalidateQueries({ queryKey: leadKeys.notes(leadId) });
    },
  });
}

// ─── RPC mutations ───────────────────────────────────────────────────────────

export function useClaimLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, userId }: { leadId: string; userId: string }) =>
      claimLead(leadId, userId),
    onSuccess: (data) => {
      // Keep the auth-store balance in sync so the credit count updates live
      // (currentUser is loaded once at login and isn't part of the users query).
      if (typeof data?.new_balance === "number")
        useAuthStore.getState().setCreditBalance(data.new_balance);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      toast.error(`Couldn't claim lead: ${err instanceof Error ? err.message : "unknown error"}`),
  });
}

/** Claim a batch of pooled leads for a TM calling session (best-effort, no locking). */
export function useClaimLeadsForCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadIds, userId }: { leadIds: string[]; userId: string }) =>
      claimLeadsForCall(leadIds, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useReturnLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, userId }: { leadId: string; userId: string }) =>
      returnLead(leadId, userId),
    onSuccess: (data) => {
      if (typeof data?.new_balance === "number")
        useAuthStore.getState().setCreditBalance(data.new_balance);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      toast.error(`Couldn't return lead: ${err instanceof Error ? err.message : "unknown error"}`),
  });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, payload, userId }: { leadId: string; payload: ConvertLeadPayload; userId: string }) =>
      convertLead(leadId, payload, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}
