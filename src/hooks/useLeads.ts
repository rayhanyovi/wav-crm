import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLeads, fetchLeadById,
  createLead, updateLead, deleteLead,
  fetchLeadNotes, addLeadNote, deleteLeadNote,
  bulkCreateLeads,
  claimLead, returnLead, convertLead,
} from "@/services/leads";
import type { LeadFilters, CreateLeadPayload, UpdateLeadPayload, ConvertLeadPayload } from "@/services/leads";
import type { Lead, LeadNote } from "@/data/types";

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
    mutationFn: ({ id, payload }: { id: string; payload: UpdateLeadPayload }) =>
      updateLead(id, payload),

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useReturnLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, userId }: { leadId: string; userId: string }) =>
      returnLead(leadId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
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
